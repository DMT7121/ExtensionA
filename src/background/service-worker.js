import { getConfig, getConsent, saveLastStatus } from "../shared/storage.js";
import { checkBackendHealth, checkSessionOnBackend, syncSessionToBackend, logEventToBackend } from "../shared/api-client.js";
import { maskSecret, isAllowedDomain } from "../shared/security.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../shared/constants.js";
import { logger } from "../shared/logger.js";

// Khởi tạo alarm kiểm tra định kỳ và context menus khi cài đặt
chrome.runtime.onInstalled.addListener(async () => {
  logger.info("ExtensionA installed.");
  await setupPeriodicCheck();

  // Tạo menu chuột phải cho Máy tính thuế VAT
  chrome.contextMenus.create({
      id: "calc_vat_10",
      title: "Tính VAT 10% (Giá chưa thuế -> Giá đã thuế)",
      contexts: ["selection"]
  });
  chrome.contextMenus.create({
      id: "calc_vat_8",
      title: "Tính VAT 8% (Giá chưa thuế -> Giá đã thuế)",
      contexts: ["selection"]
  });
  chrome.contextMenus.create({
      id: "lookup_mst",
      title: "Tra cứu công ty/MST: '%s'",
      contexts: ["selection"]
  });
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info("ExtensionA starting up.");
  await setupPeriodicCheck();

  // Xóa app state lưu tạm của VAT Calculator khi khởi động trình duyệt
  chrome.storage.local.remove('vatAppState');
});

// Lắng nghe click menu chuột phải
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lookup_mst") {
      const query = encodeURIComponent(info.selectionText.trim());
      chrome.tabs.create({ url: `https://masothue.com/Search/?q=${query}` });
      return;
  }

  const text = info.selectionText;
  if (text) {
      let numStr = text.replace(/[^\d,\.]/g, '');
      let val = parseFloat(numStr.replace(/[\.,]/g, '')); 
      
      if (isNaN(val) || val === 0) return;
      
      let rate = 0;
      if (info.menuItemId === "calc_vat_10") rate = 10;
      else if (info.menuItemId === "calc_vat_8") rate = 8;
      
      let vatAmount = val * (rate / 100);
      let total = val + vatAmount;
      
      const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      
      const message = `Giá gốc: ${fmt(val)} đ\nTiền thuế: ${fmt(vatAmount)} đ\nGiá đã thuế: ${fmt(total)} đ`;
      
      chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (msg) => {
              alert("Kết quả tính VAT:\n\n" + msg);
          },
          args: [message]
      });
  }
});

// Lắng nghe thay đổi cấu hình để cập nhật lại alarm
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === "local" && changes.config) {
    logger.info("Configuration changed, updating periodic check.");
    await setupPeriodicCheck();
  }
});

// Lắng nghe alarm định kỳ
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "periodic-check") {
    logger.info("Running periodic session and health check.");
    await performPeriodicCheck();
  }
});

/**
 * Thiết lập alarm kiểm tra định kỳ dựa trên cấu hình
 */
async function setupPeriodicCheck() {
  try {
    const config = await getConfig();
    await chrome.alarms.clear("periodic-check");
    
    if (config.syncMode !== "disabled" && config.checkInterval > 0) {
      chrome.alarms.create("periodic-check", {
        periodInMinutes: config.checkInterval
      });
      logger.debug(`Alarm periodic-check registered with interval: ${config.checkInterval} mins`);
    } else {
      logger.debug("Periodic check is disabled in config.");
    }
  } catch (e) {
    logger.error("Failed to setup periodic check alarm", { error: e.message });
  }
}

/**
 * Đọc cookie từ Zalo dựa trên allowlist
 */
async function getZaloCookies() {
  const config = await getConfig();
  const allowlist = config.allowlist || ["chat.zalo.me", "id.zalo.me"];
  const allCookies = [];

  const targets = [
    { domain: "zalo.me" },
    { domain: "chat.zalo.me" },
    { domain: "id.zalo.me" },
    { domain: ".zalo.me" }
  ];

  for (const target of targets) {
    try {
      const cookies = await chrome.cookies.getAll({ domain: target.domain });
      if (cookies && cookies.length > 0) {
        allCookies.push(...cookies);
      }
    } catch (e) {
      logger.warn(`Failed to get cookies for domain ${target.domain}`, { error: e.message });
    }
  }

  const capturedKeys = ["zpsid", "zpw_sek"];
  const filtered = allCookies.filter(cookie => {
    const domainOk = isAllowedDomain(cookie.domain, allowlist);
    const nameOk = capturedKeys.some(key => cookie.name.toLowerCase().includes(key));
    return domainOk && nameOk;
  });

  const seen = new Set();
  const unique = [];
  for (const cookie of filtered) {
    const key = `${cookie.domain}:${cookie.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expirationDate: cookie.expirationDate
      });
    }
  }

  return unique;
}

/**
 * Thực hiện kiểm tra định kỳ và gửi cảnh báo qua Webhook/Backend nếu lỗi
 */
async function performPeriodicCheck() {
  try {
    const config = await getConfig();
    if (!config.apiUrl) return;

    logger.info("Executing periodic check sequence...");
    const health = await checkBackendHealth();
    if (!health.ok) {
      logger.warn("Periodic check: Backend is offline.");
      await notifyWebhook("Backend is OFFLINE", config.webhookUrl);
      return;
    }

    const cookies = await getZaloCookies();
    const hasSession = cookies.some(c => c.name === "zpsid") && cookies.some(c => c.name === "zpw_sek");
    const sessionStatus = hasSession ? "VALID" : "EXPIRED";

    const payload = {
      source: "ExtensionA",
      domain: "chat.zalo.me",
      capturedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      sessionStatus,
      maskedSessionPreview: cookies.map(c => `${c.name}=${maskSecret(c.value)}`).join("; ") || "No Session Cookies"
    };

    const result = await checkSessionOnBackend(payload);
    
    const statusData = {
      lastCheckedAt: new Date().toISOString(),
      backendOnline: true,
      sessionValid: result.ok && result.data?.valid !== false,
      errorMsg: result.ok ? "" : result.error?.message
    };
    await saveLastStatus(statusData);

    if (!statusData.sessionValid) {
      logger.warn("Periodic check: Session is invalid/expired.");
      await notifyWebhook(`Session EXPIRED/INVALID on domain chat.zalo.me`, config.webhookUrl);
      await logEventToBackend({
        event: "SESSION_ALERT",
        message: "Phiên làm việc hết hạn hoặc không hợp lệ phát hiện qua check tự động.",
        timestamp: new Date().toISOString()
      });
    }
  } catch (e) {
    logger.error("Periodic check execution failed", { error: e.message });
  }
}

/**
 * Gửi cảnh báo tới Webhook URL
 */
async function notifyWebhook(message, webhookUrl) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `[ExtensionA Cảnh báo] ${message}`,
        text: `[ExtensionA Cảnh báo] ${message}`,
        timestamp: new Date().toISOString()
      })
    });
    logger.info("Webhook warning sent successfully.");
  } catch (e) {
    logger.error("Failed to notify webhook", { error: e.message });
  }
}

// Lắng nghe tin nhắn từ Popup và Options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug("Message received in background worker", { message });

  const handleMessage = async () => {
    try {
      switch (message.type) {
        case "CHECK_HEALTH": {
          const res = await checkBackendHealth();
          sendResponse(res);
          break;
        }

        case "GET_SESSION_PREVIEW": {
          const cookies = await getZaloCookies();
          const zpsid = cookies.find(c => c.name === "zpsid")?.value || "";
          const zpw_sek = cookies.find(c => c.name === "zpw_sek")?.value || "";
          
          sendResponse({
            ok: true,
            data: {
              hasSession: !!(zpsid && zpw_sek),
              zpsidMasked: zpsid ? maskSecret(zpsid) : "",
              zpwSekMasked: zpw_sek ? maskSecret(zpw_sek) : "",
              cookieCount: cookies.length
            }
          });
          break;
        }

        case "CHECK_SESSION": {
          const cookies = await getZaloCookies();
          const zpsid = cookies.find(c => c.name === "zpsid")?.value || "";
          const zpw_sek = cookies.find(c => c.name === "zpw_sek")?.value || "";
          
          const sessionStatus = (zpsid && zpw_sek) ? "VALID" : "EXPIRED";
          const payload = {
            source: "ExtensionA",
            domain: "chat.zalo.me",
            capturedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            sessionStatus,
            maskedSessionPreview: cookies.map(c => `${c.name}=${maskSecret(c.value)}`).join("; ") || "No Session Cookies"
          };

          const res = await checkSessionOnBackend(payload);
          sendResponse(res);
          break;
        }

        case "SYNC_SESSION": {
          const consent = await getConsent();
          if (!consent) {
            sendResponse({
              ok: false,
              error: {
                code: ERROR_CODES.CONSENT_REQUIRED,
                message: ERROR_MESSAGES.CONSENT_REQUIRED
              }
            });
            return;
          }

          const cookies = await getZaloCookies();
          const zpsid = cookies.find(c => c.name === "zpsid")?.value || "";
          const zpw_sek = cookies.find(c => c.name === "zpw_sek")?.value || "";

          if (!zpsid || !zpw_sek) {
            sendResponse({
              ok: false,
              error: {
                code: ERROR_CODES.SESSION_EXPIRED,
                message: ERROR_MESSAGES.SESSION_EXPIRED
              }
            });
            return;
          }

          const payload = {
            source: "ExtensionA",
            domain: "chat.zalo.me",
            capturedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            consentConfirmed: true,
            sessionData: {
              cookies: cookies
            }
          };

          const res = await syncSessionToBackend(payload);
          if (res.ok) {
            await saveLastStatus({
              lastCheckedAt: new Date().toISOString(),
              backendOnline: true,
              sessionValid: true,
              errorMsg: ""
            });
            
            await logEventToBackend({
              event: "SESSION_SYNC_SUCCESS",
              message: "Đồng bộ session thủ công thành công từ Extension.",
              timestamp: new Date().toISOString()
            });
          }
          sendResponse(res);
          break;
        }

        case "LOG_EVENT": {
          const res = await logEventToBackend(message.payload);
          sendResponse(res);
          break;
        }

        default:
          sendResponse({
            ok: false,
            error: {
              code: "UNKNOWN_MESSAGE_TYPE",
              message: `Loại tin nhắn ${message.type} không được hỗ trợ.`
            }
          });
      }
    } catch (err) {
      logger.error("Error handling runtime message", { error: err.message });
      sendResponse({
        ok: false,
        error: {
          code: ERROR_CODES.UNKNOWN_ERROR,
          message: err.message
        }
      });
    }
  };

  handleMessage();
  return true;
});
