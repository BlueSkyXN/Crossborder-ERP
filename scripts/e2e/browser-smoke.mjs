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
      const candidates = Array.from(document.querySelectorAll("button,a,[role='button']"));
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

function assertNoIssues(pageName, issues) {
  if (issues.length > 0) {
    throw new Error(`${pageName} browser issues:\n- ${issues.join("\n- ")}`);
  }
}

async function runAdmin(debugPort) {
  const page = await createPage(debugPort);
  await navigate(page, `${ADMIN_URL}/login?redirect=%2Fparcels`, "管理员登录");
  await clickByText(page, "登录");
  await waitForPath(page, "/parcels");
  await waitForText(page, "导出 CSV");
  await waitForText(page, "包裹入库");
  await navigate(page, `${ADMIN_URL}/waybills`, "运单处理");
  await waitForText(page, "发货批次");
  await waitForText(page, "创建批次");
  await navigate(page, `${ADMIN_URL}/finance`, "财务管理");
  await waitForText(page, "应付款");
  await waitForText(page, "供应商");
  await waitForText(page, "新建应付款");
  assertNoIssues("Admin Web", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-001] Admin Web login, parcels, shipping batch, and finance payable smoke passed");
}

async function runUser(debugPort) {
  const page = await createPage(debugPort);
  await navigate(page, `${USER_URL}/login?redirect=%2Fparcels`, "会员登录");
  await clickByText(page, "登录");
  await waitForPath(page, "/parcels");
  await waitForText(page, "批量预报");
  await waitForText(page, "选择 CSV 文件");
  await waitForText(page, "导出");
  assertNoIssues("User Web", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-001] User Web login and parcels smoke passed");
}

async function runMobile(debugPort) {
  const page = await createPage(debugPort, { mobile: true });
  await navigate(page, `${MOBILE_URL}/login?redirect=%2Fship`, "登录");
  await clickByText(page, "登录");
  await waitForPath(page, "/ship");
  await waitForText(page, "复制地址");
  await waitForText(page, "我的包裹");
  assertNoIssues("Mobile H5", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-001] Mobile H5 login and ship smoke passed");
}

let launched;
try {
  launched = await launchChrome();
  console.log(`[QA-BROWSER-001] using Chrome: ${launched.chromePath}`);
  console.log(`[QA-BROWSER-001] using remote debugging port: ${launched.debugPort}`);
  console.log(`[QA-BROWSER-001] using temporary profile: ${USER_DATA_DIR}`);
  await runAdmin(launched.debugPort);
  await runUser(launched.debugPort);
  await runMobile(launched.debugPort);
} finally {
  if (launched?.chrome && !launched.chrome.killed) {
    launched.chrome.kill();
    await Promise.race([once(launched.chrome, "exit"), delay(3_000)]);
  }
}
