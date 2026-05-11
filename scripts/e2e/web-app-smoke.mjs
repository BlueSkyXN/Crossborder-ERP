import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import net from "node:net";

const WEB_APP_URL = process.env.WEB_APP_URL || "http://127.0.0.1:3000";
const USER_DATA_DIR =
  process.env.BROWSER_E2E_USER_DATA_DIR ||
  path.join(process.env.BROWSER_E2E_TMP_DIR || tmpdir(), "crossborder-web-app-e2e-profile");

function chromeCandidates() {
  const envPath = process.env.BROWSER_E2E_CHROME;
  return [
    envPath,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/google/chrome/chrome",
  ].filter(Boolean);
}

function findChrome() {
  const chromePath = chromeCandidates().find((candidate) => existsSync(candidate));
  if (!chromePath) {
    throw new Error("No Chrome/Chromium executable found. Set BROWSER_E2E_CHROME to a system Chrome executable.");
  }
  return chromePath;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForJson(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

class CdpConnection {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
  }

  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.handleMessage(event));
    this.ws.addEventListener("close", () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error("CDP websocket closed"));
      }
      this.pending.clear();
    });
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        return;
      }
      pending.resolve(message.result || {});
      return;
    }
    const handlers = this.handlers.get(message.method) || [];
    for (const handler of handlers) {
      handler(message.params || {});
    }
  }

  on(method, handler) {
    const handlers = this.handlers.get(method) || [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
    });
  }

  close() {
    this.ws?.close();
  }
}

async function launchChrome() {
  mkdirSync(USER_DATA_DIR, { recursive: true });
  const debugPort = await freePort();
  const chromePath = findChrome();
  const args = [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--window-size=1366,900",
    "about:blank",
  ];
  if (process.platform === "linux") {
    args.splice(args.length - 1, 0, "--no-sandbox");
  }
  const chrome = spawn(chromePath, args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  chrome.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(stderr);
    }
  });
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  return { chrome, debugPort };
}

async function createPage(debugPort) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
  if (!response.ok) {
    throw new Error(`Failed to create browser page: ${response.status}`);
  }
  const target = await response.json();
  const cdp = new CdpConnection(target.webSocketDebuggerUrl);
  await cdp.open();
  const issues = [];
  cdp.on("Runtime.exceptionThrown", (params) => {
    issues.push(`exception: ${params.exceptionDetails?.text || "runtime exception"}`);
  });
  cdp.on("Runtime.consoleAPICalled", (params) => {
    if (["error", "warning", "assert"].includes(params.type)) {
      const text = (params.args || []).map((arg) => arg.value || arg.description || "").join(" ");
      issues.push(`console ${params.type}: ${text}`);
    }
  });
  cdp.on("Log.entryAdded", (params) => {
    if (["error", "warning"].includes(params.entry?.level)) {
      issues.push(`log ${params.entry.level}: ${params.entry.text}`);
    }
  });
  cdp.on("Network.responseReceived", (params) => {
    const responseData = params.response;
    if (responseData?.status >= 400) {
      issues.push(`network ${responseData.status}: ${responseData.url}`);
    }
  });
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Log.enable");
  return { cdp, issues };
}

async function evaluate(page, expression) {
  const result = await page.cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(description || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function pageSnapshot(page) {
  try {
    return await evaluate(
      page,
      `(() => ({
        href: window.location.href,
        readyState: document.readyState,
        text: (document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 1000)
      }))()`,
    );
  } catch (error) {
    return { error: error.message };
  }
}

async function waitFor(page, description, predicate, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await predicate();
    if (lastValue) {
      return lastValue;
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${description}. Last value: ${JSON.stringify(lastValue)}`);
}

async function waitForText(page, text, timeoutMs = 30_000) {
  try {
    return await waitFor(
      page,
      `text ${text}`,
      () => evaluate(page, `document.body?.innerText.includes(${JSON.stringify(text)})`),
      timeoutMs,
    );
  } catch (error) {
    const snapshot = await pageSnapshot(page);
    throw new Error(`${error.message}. Page snapshot: ${JSON.stringify(snapshot)}`);
  }
}

async function waitForDocumentReady(page, url) {
  return waitFor(page, `document ready for ${url}`, () =>
    evaluate(page, `document.body !== null && ["interactive", "complete"].includes(document.readyState)`),
  );
}

async function navigate(page, pathname, requiredText) {
  const url = new URL(pathname, WEB_APP_URL).href;
  await page.cdp.send("Page.navigate", { url });
  await waitForDocumentReady(page, url);
  if (requiredText) {
    await waitForText(page, requiredText);
  }
}

async function fillByPlaceholder(page, placeholder, value) {
  const result = await evaluate(
    page,
    `(() => {
      const normalized = (input) => (input || "").replace(/\\s+/g, " ").trim();
      const target = ${JSON.stringify(placeholder)};
      const element = Array.from(document.querySelectorAll("input,textarea")).find(
        (candidate) => normalized(candidate.getAttribute("placeholder")).includes(target)
      );
      if (!element) {
        throw new Error("Input placeholder not found: " + target);
      }
      element.focus();
      element.select?.();
      return { placeholder: element.getAttribute("placeholder") };
    })()`,
  );
  await page.cdp.send("Input.insertText", { text: value });
  await delay(100);
  return result;
}

async function fillByLabel(page, labelText, value) {
  const result = await evaluate(
    page,
    `(() => {
      const normalized = (input) => (input || "").replace(/\\s+/g, " ").trim();
      const compact = (input) => normalized(input).replace(/\\s+/g, "");
      const targetCompact = compact(${JSON.stringify(labelText)});
      const label = Array.from(document.querySelectorAll("label")).find((candidate) =>
        compact(candidate.textContent).includes(targetCompact)
      );
      if (!label) {
        throw new Error("Label not found: " + ${JSON.stringify(labelText)});
      }
      const formItem = label.closest(".ant-form-item");
      const control = formItem?.querySelector("input,textarea,select");
      if (!control) {
        throw new Error("Control not found for label: " + ${JSON.stringify(labelText)});
      }
      control.focus();
      control.select?.();
      return { label: normalized(label.textContent) };
    })()`,
  );
  await page.cdp.send("Input.insertText", { text: value });
  await delay(100);
  return result;
}

async function clickExactButtonText(page, text) {
  const clicked = await evaluate(
    page,
    `(() => {
      const normalized = (value) => (value || "").replace(/\\s+/g, " ").trim();
      const compact = (value) => normalized(value).replace(/\\s+/g, "");
      const targetText = ${JSON.stringify(text)};
      const targetCompact = compact(targetText);
      const candidates = Array.from(document.querySelectorAll("button,a,[role='button']"));
      const element = candidates.find((candidate) => compact(candidate.textContent).includes(targetCompact));
      if (!element) {
        throw new Error("Clickable text not found: " + targetText);
      }
      element.click();
      return normalized(element.textContent);
    })()`,
  );
  await delay(300);
  return clicked;
}

async function clickSubmitButton(page, text) {
  const clicked = await evaluate(
    page,
    `(() => {
      const normalized = (value) => (value || "").replace(/\\s+/g, " ").trim();
      const compact = (value) => normalized(value).replace(/\\s+/g, "");
      const targetText = ${JSON.stringify(text)};
      const targetCompact = compact(targetText);
      const candidates = Array.from(document.querySelectorAll("button[type='submit']"));
      const element = candidates.find((candidate) => compact(candidate.textContent).includes(targetCompact));
      if (!element) {
        throw new Error("Submit button not found: " + targetText);
      }
      element.click();
      return normalized(element.textContent);
    })()`,
  );
  await delay(300);
  return clicked;
}

async function assertNoBrowserIssues(page) {
  await delay(500);
  const filtered = page.issues.filter((issue) => !issue.includes("/@vite/client"));
  if (filtered.length > 0) {
    const snapshot = await pageSnapshot(page);
    throw new Error(`Browser issues detected: ${filtered.join(" | ")}. Snapshot: ${JSON.stringify(snapshot)}`);
  }
}

async function loginMember(page) {
  await navigate(page, "/login", "会员登录");
  await fillByPlaceholder(page, "邮箱", "user@example.com");
  await fillByPlaceholder(page, "密码", "password123");
  await clickSubmitButton(page, "登录");
  await waitFor(page, "member token", () => evaluate(page, `Boolean(localStorage.getItem("member_token"))`));
}

async function loginAdmin(page) {
  await navigate(page, "/admin/login", "后台管理登录");
  await fillByPlaceholder(page, "邮箱", "admin@example.com");
  await fillByPlaceholder(page, "密码", "password123");
  await clickSubmitButton(page, "登录");
  await waitFor(page, "admin token", () => evaluate(page, `Boolean(localStorage.getItem("admin_token"))`));
  await waitForText(page, "控制台");
}

async function createIamFixturesFromBrowserSession(page) {
  const suffix = Date.now();
  return evaluate(
    page,
    `(async () => {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        throw new Error("Missing admin token for IAM fixture");
      }
      const headers = {
        Authorization: \`Bearer \${token}\`,
        "Content-Type": "application/json",
      };
      const readJson = async (response, label) => {
        const payload = await response.json();
        if (!response.ok || payload.code !== "OK") {
          throw new Error(label + " failed: " + JSON.stringify(payload));
        }
        return payload.data;
      };
      const permissions = await readJson(await fetch("/api/v1/admin/permissions", { headers }), "permissions");
      const permissionCode = permissions.items.find((item) => item.code === "dashboard.view")?.code || permissions.items[0]?.code;
      if (!permissionCode) {
        throw new Error("No permission available for IAM fixture");
      }
      const roleCode = "smoke_role_${suffix}";
      const roleName = "Smoke Role ${suffix}";
      const role = await readJson(
        await fetch("/api/v1/admin/roles", {
          method: "POST",
          headers,
          body: JSON.stringify({
            code: roleCode,
            name: roleName,
            description: "web-app smoke role",
            permission_codes: [permissionCode],
          }),
        }),
        "create role"
      );
      const adminEmail = "smoke-admin-${suffix}@example.com";
      const account = await readJson(
        await fetch("/api/v1/admin/admin-users", {
          method: "POST",
          headers,
          body: JSON.stringify({
            email: adminEmail,
            name: "Smoke Admin ${suffix}",
            password: "SmokePass123",
            status: "ACTIVE",
            role_codes: [roleCode],
          }),
        }),
        "create admin account"
      );
      return { roleId: role.id, roleCode, roleName, accountId: account.id, adminEmail };
    })()`,
  );
}

async function cleanupIamFixtures(page, fixture) {
  return evaluate(
    page,
    `(async () => {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        throw new Error("Missing admin token for IAM fixture cleanup");
      }
      const headers = { Authorization: \`Bearer \${token}\` };
      const accountResponse = await fetch("/api/v1/admin/admin-users/${fixture.accountId}", {
        method: "DELETE",
        headers,
      });
      if (!accountResponse.ok) {
        throw new Error("delete admin account failed: " + accountResponse.status);
      }
      const roleResponse = await fetch("/api/v1/admin/roles/${fixture.roleId}", {
        method: "DELETE",
        headers,
      });
      if (!roleResponse.ok) {
        throw new Error("delete role failed: " + roleResponse.status);
      }
      return true;
    })()`,
  );
}

async function createAddress(page) {
  await navigate(page, "/account/addresses", "海外收件地址");
  await clickExactButtonText(page, "新增地址");
  await waitForText(page, "新增海外收件地址");
  await fillByLabel(page, "收件人", "Smoke Receiver");
  await fillByLabel(page, "联系电话", "15500001111");
  await fillByLabel(page, "国家/地区", "US");
  await fillByLabel(page, "州/省", "CA");
  await fillByLabel(page, "城市", "Los Angeles");
  await fillByLabel(page, "邮政编码", "90001");
  await fillByLabel(page, "详细地址", "100 Smoke Test Ave");
  await fillByLabel(page, "公司/门牌补充", "Suite 5");
  await clickSubmitButton(page, "保存");
  await waitForText(page, "Smoke Receiver");
}

async function main() {
  const { chrome, debugPort } = await launchChrome();
  let page;
  try {
    page = await createPage(debugPort);
    await loginMember(page);
    await navigate(page, "/warehouse-address", "仓库地址");
    await waitForText(page, "查看收货地址");
    await clickExactButtonText(page, "查看收货地址");
    await waitForText(page, "会员专属识别码");
    await createAddress(page);
    await navigate(page, "/waybills/create", "创建运单");
    await waitForText(page, "地址簿");
    await waitForText(page, "Smoke Receiver");
    await loginAdmin(page);
    const iamFixture = await createIamFixturesFromBrowserSession(page);
    await navigate(page, "/admin/roles", "角色权限");
    await waitForText(page, iamFixture.roleCode);
    await navigate(page, "/admin/admin-users", "管理员账号");
    await waitForText(page, iamFixture.adminEmail);
    await cleanupIamFixtures(page, iamFixture);
    await assertNoBrowserIssues(page);
  } finally {
    page?.cdp.close();
    chrome.kill();
  }
}

await main();
