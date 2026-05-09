import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import net from "node:net";

const ADMIN_URL = "http://127.0.0.1:3001";
const USER_URL = "http://127.0.0.1:3002";
const MOBILE_URL = "http://127.0.0.1:3003";
const USER_DATA_DIR =
  process.env.BROWSER_E2E_USER_DATA_DIR ||
  path.join(process.env.BROWSER_E2E_TMP_DIR || tmpdir(), "crossborder-browser-e2e-profile");

function chromeCandidates() {
  const envPath = process.env.BROWSER_E2E_CHROME;
  const candidates = [
    envPath,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/google/chrome/chrome",
  ];
  return candidates.filter(Boolean);
}

function findChrome() {
  const chromePath = chromeCandidates().find((candidate) => existsSync(candidate));
  if (!chromePath) {
    throw new Error(
      [
        "No Chrome/Chromium executable found.",
        "Set BROWSER_E2E_CHROME to a system Chrome executable.",
        "This smoke intentionally does not download browser binaries.",
      ].join(" "),
    );
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
  const chrome = spawn(chromePath, args, {
    stdio: ["ignore", "ignore", "pipe"],
  });
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
  return { chrome, debugPort, chromePath };
}

async function createPage(debugPort, { mobile = false } = {}) {
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
  if (mobile) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await cdp.send("Emulation.setUserAgentOverride", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
  }
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

async function waitFor(page, description, predicate, timeoutMs = 15_000) {
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

async function navigate(page, url, text) {
  await page.cdp.send("Page.navigate", { url });
  await waitFor(page, `readyState complete for ${url}`, () =>
    evaluate(page, "document.readyState === 'complete'"),
  );
  if (text) {
    await waitForText(page, text);
  }
}

async function waitForText(page, text, timeoutMs = 45_000) {
  return waitFor(
    page,
    `text ${text}`,
    () => evaluate(page, `document.body?.innerText.includes(${JSON.stringify(text)})`),
    timeoutMs,
  );
}

async function waitForPath(page, pathName, timeoutMs = 45_000) {
  return waitFor(page, `path ${pathName}`, () =>
    evaluate(page, `window.location.pathname === ${JSON.stringify(pathName)}`),
    timeoutMs,
  );
}

async function clickByText(page, text) {
  const clicked = await evaluate(
    page,
    `(() => {
      const normalized = (value) => (value || "").replace(/\\s+/g, " ").trim();
      const compact = (value) => normalized(value).replace(/\\s+/g, "");
      const targetText = ${JSON.stringify(text)};
      const targetCompact = compact(targetText);
      const candidates = Array.from(document.querySelectorAll("button,a,[role='button'],[role='tab']"));
      const element = candidates.find((candidate) => compact(candidate.textContent).includes(targetCompact));
      if (!element) {
        throw new Error("Clickable text not found: " + targetText);
      }
      element.click();
      return normalized(element.textContent);
    })()`,
  );
  await delay(250);
  return clicked;
}

async function fillByLabel(page, labelText, value) {
  return evaluate(
    page,
    `(() => {
      const normalized = (input) => (input || "").replace(/\\s+/g, " ").trim();
      const compact = (input) => normalized(input).replace(/\\s+/g, "");
      const targetCompact = compact(${JSON.stringify(labelText)});
      const value = ${JSON.stringify(value)};
      const setNativeValue = (element, nextValue) => {
        const prototype = Object.getPrototypeOf(element);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
        if (descriptor?.set) {
          descriptor.set.call(element, nextValue);
        } else {
          element.value = nextValue;
        }
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const findControl = (label) => {
        if (label.control) {
          return label.control;
        }
        const htmlFor = label.getAttribute("for");
        if (htmlFor) {
          const byId = document.getElementById(htmlFor);
          if (byId) {
            return byId;
          }
        }
        const nested = label.querySelector("input,textarea,select");
        if (nested) {
          return nested;
        }
        const formItem = label.closest(".ant-form-item");
        return formItem?.querySelector("input,textarea,select") || null;
      };
      const label = Array.from(document.querySelectorAll("label")).find((candidate) =>
        compact(candidate.textContent).includes(targetCompact)
      );
      if (!label) {
        throw new Error("Label not found: " + ${JSON.stringify(labelText)});
      }
      const control = findControl(label);
      if (!control) {
        throw new Error("Control not found for label: " + ${JSON.stringify(labelText)});
      }
      control.focus();
      setNativeValue(control, value);
      return { label: normalized(label.textContent), value: control.value };
    })()`,
  );
}

async function fillByPlaceholder(page, placeholder, value) {
  return evaluate(
    page,
    `(() => {
      const normalized = (input) => (input || "").replace(/\\s+/g, " ").trim();
      const target = ${JSON.stringify(placeholder)};
      const value = ${JSON.stringify(value)};
      const element = Array.from(document.querySelectorAll("input,textarea")).find(
        (candidate) => normalized(candidate.getAttribute("placeholder")).includes(target)
      );
      if (!element) {
        throw new Error("Input placeholder not found: " + target);
      }
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      if (descriptor?.set) {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return { placeholder: element.getAttribute("placeholder"), value: element.value };
    })()`,
  );
}

async function waitForPlaceholder(page, placeholder) {
  return waitFor(page, `input placeholder ${placeholder}`, () =>
    evaluate(
      page,
      `(() => {
        const normalized = (input) => (input || "").replace(/\\s+/g, " ").trim();
        const target = ${JSON.stringify(placeholder)};
        return Array.from(document.querySelectorAll("input,textarea")).some((candidate) =>
          normalized(candidate.getAttribute("placeholder")).includes(target)
        );
      })()`,
    ),
  );
}

async function waitForFormOption(page, labelText) {
  return waitFor(page, `select option for ${labelText}`, () =>
    evaluate(
      page,
      `(() => {
        const compact = (input) => (input || "").replace(/\\s+/g, "").trim();
        const target = compact(${JSON.stringify(labelText)});
        const label = Array.from(document.querySelectorAll("label")).find((candidate) =>
          compact(candidate.textContent).includes(target)
        );
        const control = label?.control || label?.querySelector("select");
        if (!control || control.tagName.toLowerCase() !== "select") {
          return false;
        }
        return Array.from(control.options).some((option) => option.value);
      })()`,
    ),
  );
}

function assertNoIssues(pageName, issues) {
  if (issues.length > 0) {
    throw new Error(`${pageName} browser issues:\n- ${issues.join("\n- ")}`);
  }
}

async function runAdmin(debugPort, journey) {
  const page = await createPage(debugPort);
  await navigate(page, `${ADMIN_URL}/login?redirect=%2Fparcels`, "管理员登录");
  await clickByText(page, "登录");
  await waitForPath(page, "/parcels");
  await waitForText(page, "导出 CSV");
  await waitForText(page, "包裹入库");
  await clickByText(page, "扫描入库");
  await waitForText(page, "搜索并入库");
  await fillByLabel(page, "快递单号", journey.trackingNo);
  await fillByLabel(page, "重量 kg", "1.250");
  await fillByLabel(page, "长 cm", "20");
  await fillByLabel(page, "宽 cm", "15");
  await fillByLabel(page, "高 cm", "10");
  await clickByText(page, "搜索并入库");
  await waitForText(page, journey.trackingNo);
  await waitForText(page, "已入库");
  await clickByText(page, "在库包裹");
  await waitForText(page, journey.trackingNo);
  await navigate(page, `${ADMIN_URL}/waybills`, "运单处理");
  await waitForText(page, "发货批次");
  await waitForText(page, "创建批次");
  await navigate(page, `${ADMIN_URL}/finance`, "财务管理");
  await waitForText(page, "应付款");
  await waitForText(page, "供应商");
  await waitForText(page, "新建应付款");
  await navigate(page, `${ADMIN_URL}/members`, "会员管理");
  await waitForText(page, "user@example.com");
  await clickByText(page, "详情");
  await waitForText(page, "积分推广");
  await waitForText(page, "当前积分");
  await navigate(page, `${ADMIN_URL}/audit-logs`, "操作审计");
  await waitForText(page, "admin-login");
  await waitForText(page, "导出 CSV");
  await waitForText(page, "敏感字段");
  assertNoIssues("Admin Web", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-002] Admin Web scanned the browser-created parcel into stock");
  console.log("[QA-BROWSER-001] Admin Web login, parcels, shipping batch, finance payable, growth, and audit smoke passed");
}

async function runUser(debugPort, journey) {
  const page = await createPage(debugPort);
  await navigate(page, `${USER_URL}/login?redirect=%2Fparcels`, "会员登录");
  await clickByText(page, "登录");
  await waitForPath(page, "/parcels");
  await waitForText(page, "批量预报");
  await waitForText(page, "Excel 模板");
  await waitForText(page, "选择 CSV / Excel 文件");
  await waitForText(page, "导出");
  await waitForFormOption(page, "入库仓库");
  await fillByLabel(page, "快递单号", journey.trackingNo);
  await fillByLabel(page, "承运商", "QA-CDP");
  await fillByLabel(page, "商品名称", "Browser Journey Item");
  await fillByLabel(page, "数量", "2");
  await fillByLabel(page, "申报价值", "18.50");
  await fillByLabel(page, "备注", "QA-BROWSER-002");
  await clickByText(page, "提交预报");
  await waitForText(page, journey.trackingNo);
  await navigate(page, `${USER_URL}/dashboard`, "会员中心");
  await waitForText(page, "积分推广");
  await waitForText(page, "邀请码");
  assertNoIssues("User Web", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-002] User Web created a parcel forecast through the browser form");
  console.log("[QA-BROWSER-001] User Web login, parcels, and growth smoke passed");
}

async function verifyUserParcelInStock(debugPort, journey) {
  const page = await createPage(debugPort);
  await navigate(page, `${USER_URL}/parcels`, "包裹中心");
  await waitForPlaceholder(page, "搜索包裹号或快递单号");
  await fillByPlaceholder(page, "搜索包裹号或快递单号", journey.trackingNo);
  await waitForText(page, journey.trackingNo);
  await clickByText(page, journey.trackingNo);
  await waitForText(page, "在库");
  await waitForText(page, "申请打包");
  assertNoIssues("User Web stock verification", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-002] User Web verified the scanned parcel is in stock and packable");
}

async function runMobile(debugPort) {
  const page = await createPage(debugPort, { mobile: true });
  await navigate(page, `${MOBILE_URL}/login?redirect=%2Fship`, "登录");
  await clickByText(page, "登录");
  await waitForPath(page, "/ship");
  await waitForText(page, "复制地址");
  await waitForText(page, "我的包裹");
  await navigate(page, `${MOBILE_URL}/me`, "我的");
  await waitForText(page, "积分推广");
  await waitForText(page, "邀请码");
  assertNoIssues("Mobile H5", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-001] Mobile H5 login, ship, and growth smoke passed");
}

let launched;
try {
  launched = await launchChrome();
  const journey = { trackingNo: `BRW-${Date.now()}` };
  console.log(`[QA-BROWSER-001] using Chrome: ${launched.chromePath}`);
  console.log(`[QA-BROWSER-001] using remote debugging port: ${launched.debugPort}`);
  console.log(`[QA-BROWSER-001] using temporary profile: ${USER_DATA_DIR}`);
  console.log(`[QA-BROWSER-002] using browser journey tracking number: ${journey.trackingNo}`);
  await runUser(launched.debugPort, journey);
  await runAdmin(launched.debugPort, journey);
  await verifyUserParcelInStock(launched.debugPort, journey);
  await runMobile(launched.debugPort);
} finally {
  if (launched?.chrome && !launched.chrome.killed) {
    launched.chrome.kill();
    await Promise.race([once(launched.chrome, "exit"), delay(3_000)]);
  }
}
