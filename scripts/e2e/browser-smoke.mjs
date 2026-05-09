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

async function pageSnapshot(page) {
  try {
    return await evaluate(
      page,
      `(() => ({
        href: window.location.href,
        readyState: document.readyState,
        title: document.title,
        text: (document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 800)
      }))()`,
    );
  } catch (error) {
    return { error: error.message };
  }
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

async function waitForUrl(page, url) {
  const expected = new URL(url).href;
  return waitFor(page, `URL ${expected}`, () =>
    evaluate(page, `window.location.href === ${JSON.stringify(expected)}`),
  );
}

async function waitForDocumentReady(page, url) {
  return waitFor(page, `document ready for ${url}`, () =>
    evaluate(page, `document.body !== null && ["interactive", "complete"].includes(document.readyState)`),
  );
}

async function navigate(page, url, text) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.cdp.send("Page.navigate", { url });
    try {
      await waitForUrl(page, url);
      await waitForDocumentReady(page, url);
      if (text) {
        await waitForText(page, text);
      }
      return;
    } catch (error) {
      lastError = error;
      const snapshot = await pageSnapshot(page);
      if (attempt === 2) {
        throw new Error(
          `Navigation to ${url} failed after ${attempt} attempts: ${error.message}. Page snapshot: ${JSON.stringify(
            snapshot,
          )}`,
        );
      }
      console.warn(
        `[QA-BROWSER-001] retrying navigation to ${url}: ${error.message}. Snapshot: ${JSON.stringify(snapshot)}`,
      );
      await page.cdp.send("Page.reload", { ignoreCache: true }).catch(() => undefined);
      await delay(1_000);
    }
  }
  throw lastError;
}

async function waitForText(page, text, timeoutMs = 45_000) {
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

async function verifyRouteText(page, url, texts) {
  await navigate(page, url, texts[0]);
  for (const text of texts.slice(1)) {
    await waitForText(page, text);
  }
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

async function clickExactButtonText(page, text) {
  const clicked = await evaluate(
    page,
    `(() => {
      const normalized = (value) => (value || "").replace(/\\s+/g, " ").trim();
      const targetText = ${JSON.stringify(text)};
      const candidates = Array.from(document.querySelectorAll("button,a,[role='button']"));
      const element = candidates.find((candidate) => normalized(candidate.textContent) === targetText);
      if (!element) {
        throw new Error("Exact clickable text not found: " + targetText);
      }
      element.click();
      return normalized(element.textContent);
    })()`,
  );
  await delay(250);
  return clicked;
}

async function clickButtonByTitle(page, title) {
  const clicked = await evaluate(
    page,
    `(() => {
      const normalized = (value) => (value || "").replace(/\\s+/g, " ").trim();
      const targetTitle = ${JSON.stringify(title)};
      const candidates = Array.from(document.querySelectorAll("button,a,[role='button']"));
      const element = candidates.find((candidate) => normalized(candidate.getAttribute("title")) === targetTitle);
      if (!element) {
        throw new Error("Button title not found: " + targetTitle);
      }
      element.click();
      return normalized(element.getAttribute("title") || element.textContent);
    })()`,
  );
  await delay(250);
  return clicked;
}

async function clickButtonByTitleInRow(page, rowText, title) {
  const clicked = await evaluate(
    page,
    `(() => {
      const normalized = (value) => (value || "").replace(/\\s+/g, " ").trim();
      const compact = (value) => normalized(value).replace(/\\s+/g, "");
      const rowTarget = compact(${JSON.stringify(rowText)});
      const titleTarget = compact(${JSON.stringify(title)});
      const rowSelectors = [
        "tr",
        "article",
        ".ant-table-row",
        "[role='row']",
        "[class*='Row']",
        "[class*='row']"
      ].join(",");
      const row = Array.from(document.querySelectorAll(rowSelectors)).find((candidate) =>
        compact(candidate.textContent).includes(rowTarget)
      );
      if (!row) {
        throw new Error("Row text not found: " + ${JSON.stringify(rowText)});
      }
      const candidates = Array.from(row.querySelectorAll("button,a,[role='button']"));
      const element = candidates.find((candidate) => {
        const candidateTitle = candidate.getAttribute("title") || candidate.getAttribute("aria-label") || "";
        return compact(candidateTitle).includes(titleTarget) || compact(candidate.textContent).includes(titleTarget);
      });
      if (!element) {
        throw new Error("Button title not found: " + ${JSON.stringify(title)} + " in row " + ${JSON.stringify(rowText)});
      }
      element.click();
      return {
        row: normalized(row.textContent).slice(0, 240),
        title: element.getAttribute("title") || element.getAttribute("aria-label") || normalized(element.textContent),
      };
    })()`,
  );
  await delay(250);
  return clicked;
}

async function clickCheckboxNearText(page, text) {
  const clicked = await evaluate(
    page,
    `(() => {
      const normalized = (value) => (value || "").replace(/\\s+/g, " ").trim();
      const targetText = ${JSON.stringify(text)};
      const labels = Array.from(document.querySelectorAll("label"));
      const label = labels.find((candidate) => normalized(candidate.textContent).includes(targetText));
      if (!label) {
        throw new Error("Checkbox label text not found: " + targetText);
      }
      const checkbox = label.querySelector("input[type='checkbox']");
      if (!checkbox) {
        throw new Error("Checkbox not found near: " + targetText);
      }
      checkbox.click();
      return normalized(label.textContent);
    })()`,
  );
  await delay(250);
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

async function createMemberRemittanceFromBrowserSession(page, journey) {
  return evaluate(
    page,
    `(async () => {
      const persisted = JSON.parse(localStorage.getItem("crossborder-user-auth") || "{}");
      const token = persisted?.state?.token;
      if (!token) {
        throw new Error("Missing member auth token for browser remittance");
      }
      const authHeader = { Authorization: \`Bearer \${token}\` };
      const form = new FormData();
      form.append("usage", "REMITTANCE_PROOF");
      form.append(
        "file",
        new File(["%PDF-1.4\\n% QA-BROWSER-004 remittance proof\\n%%EOF"], "qa-browser-004-remittance.pdf", {
          type: "application/pdf",
        })
      );
      const uploadResponse = await fetch("/api/v1/files", {
        method: "POST",
        headers: authHeader,
        body: form,
      });
      const uploadPayload = await uploadResponse.json();
      if (!uploadResponse.ok || uploadPayload.code !== "OK") {
        throw new Error("Browser remittance proof upload failed: " + JSON.stringify(uploadPayload));
      }
      const remittanceResponse = await fetch("/api/v1/remittances", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: "18.88",
          currency: "CNY",
          proof_file_id: uploadPayload.data.file_id,
          remark: ${JSON.stringify(journey.remittanceRemark)},
        }),
      });
      const remittancePayload = await remittanceResponse.json();
      if (!remittanceResponse.ok || remittancePayload.code !== "OK") {
        throw new Error("Browser remittance create failed: " + JSON.stringify(remittancePayload));
      }
      return remittancePayload.data.request_no;
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

async function waitForRowTexts(page, rowText, texts = [], timeoutMs = 45_000) {
  const allTexts = [rowText, ...texts];
  return waitFor(
    page,
    `row containing ${allTexts.join(", ")}`,
    () =>
      evaluate(
        page,
        `(() => {
          const compact = (input) => (input || "").replace(/\\s+/g, "").trim();
          const targets = ${JSON.stringify(allTexts)}.map(compact);
          const rowSelectors = [
            "tr",
            "article",
            ".ant-table-row",
            "[role='row']",
            "[class*='Row']",
            "[class*='row']"
          ].join(",");
          return Array.from(document.querySelectorAll(rowSelectors)).some((candidate) => {
            const text = compact(candidate.textContent);
            return targets.every((target) => text.includes(target));
          });
        })()`,
      ),
    timeoutMs,
  );
}

async function getMemberWaybillByTracking(page, trackingNo) {
  return evaluate(
    page,
    `(async () => {
      const persisted = JSON.parse(localStorage.getItem("crossborder-user-auth") || "{}");
      const token = persisted?.state?.token;
      if (!token) {
        throw new Error("Missing member auth token for waybill lookup");
      }
      const response = await fetch("/api/v1/waybills", {
        headers: { Authorization: \`Bearer \${token}\` },
      });
      const payload = await response.json();
      if (!response.ok || payload.code !== "OK") {
        throw new Error("Waybill lookup failed: " + JSON.stringify(payload));
      }
      const waybill = payload.data.items.find((item) =>
        item.parcels.some((parcel) => parcel.tracking_no === ${JSON.stringify(trackingNo)})
      );
      if (!waybill) {
        throw new Error("Waybill not found for tracking number: " + ${JSON.stringify(trackingNo)});
      }
      return {
        id: waybill.id,
        waybill_no: waybill.waybill_no,
        status: waybill.status,
        fee_total: waybill.fee_total,
        tracking_events: waybill.tracking_events.map((event) => event.status_text),
      };
    })()`,
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
  await clickSubmitButton(page, "搜索并入库");
  await waitForText(page, journey.trackingNo);
  await waitForText(page, "已入库");
  await clickByText(page, "在库包裹");
  await fillByPlaceholder(page, "搜索包裹号、快递单号、会员或仓库", journey.trackingNo);
  await waitForText(page, journey.trackingNo);
  await navigate(page, `${ADMIN_URL}/waybills`, "运单处理");
  await waitForText(page, "发货批次");
  await waitForText(page, "创建批次");
  await navigate(page, `${ADMIN_URL}/finance`, "财务管理");
  await waitForText(page, "应付款");
  await waitForText(page, "供应商");
  await waitForText(page, "新建应付款");
  await clickByText(page, "线下汇款");
  await waitForText(page, "汇款审核");
  await fillByPlaceholder(page, "搜索单号、会员、凭证", journey.remittanceRemark);
  await waitForText(page, journey.remittanceRemark);
  await clickByText(page, "通过");
  await waitForText(page, "审核通过线下汇款");
  await fillByLabel(page, "审核备注", "QA-BROWSER-004 财务浏览器审核入账");
  await clickByText(page, "确认入账");
  await clickByText(page, "已入账");
  await waitForText(page, journey.remittanceRemark);
  await navigate(page, `${ADMIN_URL}/members`, "会员管理");
  await waitForText(page, "user@example.com");
  await clickByText(page, "详情");
  await waitForText(page, "积分推广");
  await waitForText(page, "当前积分");
  await navigate(page, `${ADMIN_URL}/tickets`, "客服工单");
  await fillByPlaceholder(page, "搜索单号、会员、标题", journey.ticketTitle);
  await waitForText(page, journey.ticketTitle);
  await clickExactButtonText(page, "处理");
  await waitForText(page, "客服回复");
  await fillByLabel(page, "回复内容", journey.adminTicketReply);
  await clickByText(page, "发送回复");
  await waitForText(page, journey.adminTicketReply);
  await navigate(page, `${ADMIN_URL}/audit-logs`, "操作审计");
  await waitForText(page, "admin-login");
  await waitForText(page, "导出 CSV");
  await waitForText(page, "敏感字段");
  await verifyRouteText(page, `${ADMIN_URL}/dashboard`, ["运营控制台", "实时工作队列", "模块健康概览"]);
  await verifyRouteText(page, `${ADMIN_URL}/warehouses`, ["基础配置", "仓库", "渠道"]);
  await verifyRouteText(page, `${ADMIN_URL}/purchases`, ["代购处理", "待采购", "异常单"]);
  await verifyRouteText(page, `${ADMIN_URL}/products`, ["商品管理", "启用商品", "启用 SKU"]);
  await verifyRouteText(page, `${ADMIN_URL}/tickets`, ["客服工单", "待处理工单", "处理中"]);
  await verifyRouteText(page, `${ADMIN_URL}/content`, ["内容管理", "已发布", "草稿"]);
  await verifyRouteText(page, `${ADMIN_URL}/roles`, ["角色权限", "权限覆盖矩阵", "super_admin", "新增角色", "删除"]);
  await verifyRouteText(page, `${ADMIN_URL}/admin-users`, ["管理员账号", "账号列表", "新增管理员", "删除"]);
  assertNoIssues("Admin Web", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-002] Admin Web scanned the browser-created parcel into stock");
  console.log("[QA-BROWSER-004] Admin Web approved the browser-created remittance and replied to the browser-created ticket");
  console.log("[QA-BROWSER-001] Admin Web login, parcels, shipping batch, finance payable, growth, and audit smoke passed");
  console.log(
    "[ADMIN-PANELS-001] Admin Web dashboard, roles, admin users, warehouses, purchases, products, tickets, and content panels passed",
  );
}

async function runUser(debugPort, journey) {
  const page = await createPage(debugPort);
  await navigate(page, `${USER_URL}/login?redirect=%2Fparcels`, "会员登录");
  await waitForText(page, "找回密码");
  await clickSubmitButton(page, "登录");
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
  await navigate(page, `${USER_URL}/finance`, "财务中心");
  await waitForText(page, "提交线下汇款");
  await fillByLabel(page, "汇款金额 CNY", "18.88");
  await fillByLabel(page, "备注", journey.remittanceRemark);
  journey.remittanceNo = await createMemberRemittanceFromBrowserSession(page, journey);
  await navigate(page, `${USER_URL}/finance`, "财务中心");
  await waitForText(page, journey.remittanceRemark);
  await waitForText(page, "待审核");
  await navigate(page, `${USER_URL}/tickets`, "消息中心");
  await waitForText(page, "创建工单");
  await fillByLabel(page, "标题", journey.ticketTitle);
  await fillByLabel(page, "问题描述", journey.ticketContent);
  await clickSubmitButton(page, "提交工单");
  await waitForText(page, journey.ticketTitle);
  await waitForText(page, "待处理");
  await navigate(page, `${USER_URL}/dashboard`, "会员中心");
  await waitForText(page, "积分推广");
  await waitForText(page, "邀请码");
  await navigate(page, `${USER_URL}/settings`, "账户设置");
  await waitForText(page, "保存资料");
  await waitForText(page, "更新密码");
  await navigate(page, `${USER_URL}/purchases?tab=manual`, "手工代购");
  await waitForText(page, "解析链接");
  assertNoIssues("User Web", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-002] User Web created a parcel forecast through the browser form");
  console.log("[QA-BROWSER-004] User Web created a browser-authenticated remittance and support ticket");
  console.log("[QA-BROWSER-001] User Web login, parcels, and growth smoke passed");
}

async function verifyUserTicketReply(debugPort, journey) {
  const page = await createPage(debugPort);
  await navigate(page, `${USER_URL}/tickets`, "消息中心");
  await waitForPlaceholder(page, "搜索单号、标题或内容");
  await fillByPlaceholder(page, "搜索单号、标题或内容", journey.ticketTitle);
  await waitForText(page, journey.ticketTitle);
  await waitForText(page, journey.adminTicketReply);
  assertNoIssues("User Web ticket reply verification", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-004] User Web verified the admin ticket reply through the browser");
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

async function createUserWaybillFromStock(debugPort, journey) {
  const page = await createPage(debugPort);
  await navigate(page, `${USER_URL}/waybills`, "运单中心");
  await waitForText(page, "申请打包");
  await waitForText(page, journey.trackingNo);
  await clickCheckboxNearText(page, journey.trackingNo);
  await fillByLabel(page, "收件人", "QA Browser Receiver");
  await fillByLabel(page, "电话", "13800000005");
  await fillByLabel(page, "收件地址", "500 Browser Smoke Way, Los Angeles, CA");
  await fillByLabel(page, "邮编", "90001");
  await fillByLabel(page, "备注", journey.waybillRemark);
  await clickSubmitButton(page, "提交运单");
  await waitForText(page, "已提交，等待后台审核计费");
  const waybill = await getMemberWaybillByTracking(page, journey.trackingNo);
  if (waybill.status !== "PENDING_REVIEW") {
    throw new Error(`Expected new waybill to be PENDING_REVIEW, got ${waybill.status}`);
  }
  journey.waybillId = waybill.id;
  journey.waybillNo = waybill.waybill_no;
  assertNoIssues("User Web waybill creation", page.issues);
  page.cdp.close();
  console.log(`[QA-BROWSER-005] User Web created waybill ${journey.waybillNo} from the scanned parcel`);
}

async function reviewAndFeeWaybillInAdmin(debugPort, journey) {
  const page = await createPage(debugPort);
  await navigate(page, `${ADMIN_URL}/waybills`, "运单处理");
  await waitForPlaceholder(page, "搜索运单号、会员、仓库、渠道或包裹");
  await fillByPlaceholder(page, "搜索运单号、会员、仓库、渠道或包裹", journey.waybillNo);
  await waitForRowTexts(page, journey.waybillNo, ["待审核"]);
  await clickButtonByTitleInRow(page, journey.waybillNo, "审核");
  await waitForText(page, "审核备注");
  await fillByLabel(page, "审核备注", "QA-BROWSER-005 后台浏览器审核通过");
  await clickExactButtonText(page, "审核通过");
  await waitForText(page, `${journey.waybillNo} 已审核`);
  await waitForRowTexts(page, journey.waybillNo, ["待打包"]);
  await clickButtonByTitleInRow(page, journey.waybillNo, "设置费用");
  await waitForText(page, "应收合计 CNY");
  await fillByLabel(page, "应收合计 CNY", journey.waybillFee);
  await fillByLabel(page, "运费", journey.waybillFee);
  await fillByLabel(page, "包装费", "0.00");
  await fillByLabel(page, "服务费", "0.00");
  await fillByLabel(page, "费用说明", "QA-BROWSER-005 浏览器计费");
  await fillByLabel(page, "内部备注", "QA-BROWSER-005 后台设置运单费用");
  await clickExactButtonText(page, "确认计费");
  await waitForText(page, `${journey.waybillNo} 已进入待付款`);
  await waitForRowTexts(page, journey.waybillNo, ["待付款"]);
  await clickButtonByTitleInRow(page, journey.waybillNo, "人工充值");
  await waitForText(page, `${journey.waybillNo} 当前费用`);
  await fillByLabel(page, "充值金额 CNY", journey.waybillRechargeAmount);
  await fillByLabel(page, "备注", journey.waybillRechargeRemark);
  await clickExactButtonText(page, "确认充值");
  await waitForText(page, "充值完成");
  await waitForRowTexts(page, journey.waybillNo, ["待付款"]);
  assertNoIssues("Admin Web waybill review, fee, and recharge", page.issues);
  page.cdp.close();
  console.log(`[QA-BROWSER-005] Admin Web reviewed, billed, and recharged waybill ${journey.waybillNo}`);
}

async function payUserWaybill(debugPort, journey) {
  const page = await createPage(debugPort);
  await navigate(page, `${USER_URL}/waybills`, "运单中心");
  await waitForPlaceholder(page, "搜索运单号或包裹号");
  await fillByPlaceholder(page, "搜索运单号或包裹号", journey.waybillNo);
  await waitForRowTexts(page, journey.waybillNo, ["待付款"]);
  await clickByText(page, journey.waybillNo);
  await waitForText(page, journey.waybillFee);
  await clickExactButtonText(page, "余额支付");
  await waitForText(page, "确认支付");
  await waitForText(page, journey.waybillFee);
  await clickExactButtonText(page, "确认支付");
  await waitForText(page, "已余额支付");
  const waybill = await getMemberWaybillByTracking(page, journey.trackingNo);
  if (waybill.status !== "PENDING_SHIPMENT") {
    throw new Error(`Expected paid waybill to be PENDING_SHIPMENT, got ${waybill.status}`);
  }
  await waitForRowTexts(page, journey.waybillNo, ["待发货"]);
  assertNoIssues("User Web waybill payment", page.issues);
  page.cdp.close();
  console.log(`[QA-BROWSER-005] User Web paid waybill ${journey.waybillNo} with wallet balance`);
}

async function shipWaybillInAdmin(debugPort, journey) {
  const page = await createPage(debugPort);
  await navigate(page, `${ADMIN_URL}/waybills`, "运单处理");
  await waitForPlaceholder(page, "搜索运单号、会员、仓库、渠道或包裹");
  await fillByPlaceholder(page, "搜索运单号、会员、仓库、渠道或包裹", journey.waybillNo);
  await waitForRowTexts(page, journey.waybillNo, ["待发货"]);
  await clickButtonByTitleInRow(page, journey.waybillNo, "发货");
  await waitForText(page, "确认发货");
  await fillByLabel(page, "轨迹状态", journey.shipmentStatus);
  await fillByLabel(page, "地点", "QA Browser 深圳仓");
  await fillByLabel(page, "说明", "QA-BROWSER-005 后台浏览器发货并生成轨迹");
  await clickExactButtonText(page, "确认发货");
  await waitForRowTexts(page, journey.waybillNo, ["已发货"]);
  assertNoIssues("Admin Web waybill shipment", page.issues);
  page.cdp.close();
  console.log(`[QA-BROWSER-005] Admin Web shipped waybill ${journey.waybillNo} and created tracking`);
}

async function verifyUserWaybillTrackingAndReceipt(debugPort, journey) {
  const page = await createPage(debugPort);
  await navigate(page, `${USER_URL}/waybills`, "运单中心");
  await waitForPlaceholder(page, "搜索运单号或包裹号");
  await fillByPlaceholder(page, "搜索运单号或包裹号", journey.waybillNo);
  await waitForRowTexts(page, journey.waybillNo, ["已发货"]);
  await clickByText(page, journey.waybillNo);
  await waitForText(page, "物流轨迹");
  await waitForText(page, journey.shipmentStatus);
  await clickExactButtonText(page, "确认收货");
  await waitForText(page, "已确认收货");
  await waitForRowTexts(page, journey.waybillNo, ["已签收"]);
  const waybill = await getMemberWaybillByTracking(page, journey.trackingNo);
  if (waybill.status !== "SIGNED") {
    throw new Error(`Expected received waybill to be SIGNED, got ${waybill.status}`);
  }
  if (!waybill.tracking_events.includes(journey.shipmentStatus)) {
    throw new Error(`Expected tracking event ${journey.shipmentStatus}, got ${waybill.tracking_events.join(", ")}`);
  }
  assertNoIssues("User Web waybill tracking and receipt", page.issues);
  page.cdp.close();
  console.log(`[QA-BROWSER-005] User Web verified tracking and confirmed receipt for ${journey.waybillNo}`);
}

async function runMobile(debugPort) {
  const page = await createPage(debugPort, { mobile: true });
  await navigate(page, `${MOBILE_URL}/login?redirect=%2Fship`, "登录");
  await waitForText(page, "找回密码");
  await clickSubmitButton(page, "登录");
  await waitForPath(page, "/ship");
  await waitForText(page, "复制地址");
  await waitForText(page, "我的包裹");
  await navigate(page, `${MOBILE_URL}/me`, "我的");
  await waitForText(page, "积分推广");
  await waitForText(page, "邀请码");
  await navigate(page, `${MOBILE_URL}/me/settings`, "账户设置");
  await waitForText(page, "保存资料");
  await waitForText(page, "更新密码");
  await navigate(page, `${MOBILE_URL}/me/purchases/manual`, "手工代购");
  await waitForText(page, "解析链接");
  assertNoIssues("Mobile H5", page.issues);
  page.cdp.close();
  console.log("[QA-BROWSER-001] Mobile H5 login, ship, and growth smoke passed");
}

let launched;
try {
  launched = await launchChrome();
  const journeyId = Date.now();
  const journey = {
    trackingNo: `BRW-${journeyId}`,
    remittanceRemark: `QA-BROWSER-004-REM-${journeyId}`,
    ticketTitle: `QA Browser Ticket ${journeyId}`,
    ticketContent: "QA-BROWSER-004 用户端浏览器创建客服工单",
    adminTicketReply: "QA-BROWSER-004 后台客服浏览器回复",
    waybillRemark: `QA-BROWSER-005-WB-${journeyId}`,
    waybillFee: "9.99",
    waybillRechargeAmount: "20.00",
    waybillRechargeRemark: "QA-BROWSER-005 后台人工充值运费",
    shipmentStatus: "QA-BROWSER-005 已发货",
  };
  console.log(`[QA-BROWSER-001] using Chrome: ${launched.chromePath}`);
  console.log(`[QA-BROWSER-001] using remote debugging port: ${launched.debugPort}`);
  console.log(`[QA-BROWSER-001] using temporary profile: ${USER_DATA_DIR}`);
  console.log(`[QA-BROWSER-002] using browser journey tracking number: ${journey.trackingNo}`);
  await runUser(launched.debugPort, journey);
  await runAdmin(launched.debugPort, journey);
  await verifyUserTicketReply(launched.debugPort, journey);
  await verifyUserParcelInStock(launched.debugPort, journey);
  await createUserWaybillFromStock(launched.debugPort, journey);
  await reviewAndFeeWaybillInAdmin(launched.debugPort, journey);
  await payUserWaybill(launched.debugPort, journey);
  await shipWaybillInAdmin(launched.debugPort, journey);
  await verifyUserWaybillTrackingAndReceipt(launched.debugPort, journey);
  await runMobile(launched.debugPort);
} finally {
  if (launched?.chrome && !launched.chrome.killed) {
    launched.chrome.kill();
    await Promise.race([once(launched.chrome, "exit"), delay(3_000)]);
  }
}
