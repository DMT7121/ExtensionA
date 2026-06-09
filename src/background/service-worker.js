import { getConfig, getConsent, saveLastStatus } from "../shared/storage.js";
import { checkBackendHealth, checkSessionOnBackend, syncSessionToBackend, logEventToBackend } from "../shared/api-client.js";
import { maskSecret, isAllowedDomain } from "../shared/security.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../shared/constants.js";
import { logger } from "../shared/logger.js";

// Khởi tạo alarm kiểm tra định kỳ khi extension cài đặt/khởi động
chrome.runtime.onInstalled.addListener(async () => {
  logger.info("ExtensionA installed.");
  await setupPeriodicCheck();
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info("ExtensionA starting up.");
  await setupPeriodicCheck();
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

  // Query cho cả domain chính và phụ
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

  // Lọc chỉ giữ lại cookie thuộc domain trong allowlist và trùng với các key cần capture
  const capturedKeys = ["zpsid", "zpw_sek"];
  const filtered = allCookies.filter(cookie => {
    // Check allowlist
    const domainOk = isAllowedDomain(cookie.domain, allowlist);
    // Check key
    const nameOk = capturedKeys.some(key => cookie.name.toLowerCase().includes(key));
    return domainOk && nameOk;
  });

  // Loại bỏ trùng lặp (nếu trùng name và domain)
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
    // 1. Kiểm tra Backend Health
    const health = await checkBackendHealth();
    if (!health.ok) {
      logger.warn("Periodic check: Backend is offline.");
      await notifyWebhook("Backend is OFFLINE", config.webhookUrl);
      return;
    }

    // 2. Lấy dữ liệu phiên
    const cookies = await getZaloCookies();
    const hasSession = cookies.some(c => c.name === "zpsid") && cookies.some(c => c.name === "zpw_sek");
    const sessionStatus = hasSession ? "VALID" : "EXPIRED";

    // 3. Gửi check-session lên backend
    const payload = {
      source: "ExtensionA",
      domain: "chat.zalo.me",
      capturedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      sessionStatus,
      maskedSessionPreview: cookies.map(c => `${c.name}=${maskSecret(c.value)}`).join("; ") || "No Session Cookies"
    };

    const result = await checkSessionOnBackend(payload);
    
    // Lưu lại trạng thái
    const statusData = {
      lastCheckedAt: new Date().toISOString(),
      backendOnline: true,
      sessionValid: result.ok && result.data?.valid !== false,
      errorMsg: result.ok ? "" : result.error?.message
    };
    await saveLastStatus(statusData);

    // 4. Nếu mất phiên và có cấu hình webhook, cảnh báo
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
 * Gửi cảnh báo tới Webhook URL (như Discord/Slack/Custom webhook)
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

  // Handle messages asynchronously by returning true
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
          // Kiểm tra xem đã đồng ý điều khoản bảo mật chưa
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

          // Lấy cookie đầy đủ
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
              cookies: cookies // Gửi danh sách cookie cấu trúc hoàn chỉnh
            }
          };

          const res = await syncSessionToBackend(payload);
          if (res.ok) {
            // Lưu trạng thái kiểm tra cuối cùng
            await saveLastStatus({
              lastCheckedAt: new Date().toISOString(),
              backendOnline: true,
              sessionValid: true,
              errorMsg: ""
            });
            
            // Ghi nhận sự kiện đồng bộ thành công
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
  return true; // Giữ kết nối để sendResponse chạy bất đồng bộ
});
