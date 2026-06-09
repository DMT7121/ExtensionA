import { getConfig } from "./storage.js";
import { validateConfig, isHttpsUrl } from "./security.js";
import { ERROR_CODES, ERROR_MESSAGES } from "./constants.js";
import { logger } from "./logger.js";

/**
 * Thao tác fetch có cấu hình timeout
 */
async function fetchWithTimeout(url, options = {}) {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Thực hiện gọi API với cơ chế retry giới hạn (tối đa 2 lần retry)
 */
async function requestWithRetry(url, options = {}, retries = 2) {
  try {
    return await fetchWithTimeout(url, options);
  } catch (error) {
    if (retries > 0) {
      logger.warn(`API call failed, retrying... (${retries} retries left)`, { url });
      return await requestWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

/**
 * Chuẩn hóa lỗi trả về cho UI
 */
function normalizeError(code, customMessage = "") {
  return {
    ok: false,
    error: {
      code,
      message: customMessage || ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR
    }
  };
}

/**
 * Hàm gọi chung cho các API
 */
async function callApi(endpoint, method = "GET", body = null, requireAuth = true, requireHttps = false) {
  const config = await getConfig();
  const validation = validateConfig(config);
  
  if (!validation.valid) {
    return normalizeError(ERROR_CODES.INVALID_CONFIG, validation.reason);
  }

  // Check HTTPS requirements for production syncs
  if (requireHttps && !isHttpsUrl(config.apiUrl)) {
    return normalizeError(ERROR_CODES.HTTPS_REQUIRED);
  }

  const url = `${config.apiUrl.replace(/\/$/, "")}${endpoint}`;
  
  const headers = {
    "Content-Type": "application/json",
    "X-Extension-Source": "ExtensionA"
  };

  if (requireAuth && config.adminToken) {
    headers["Authorization"] = `Bearer ${config.adminToken}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    logger.debug(`Sending ${method} request to ${endpoint}`, { body });
    const response = await requestWithRetry(url, options);

    if (response.status === 401 || response.status === 403) {
      logger.error(`API response unauthorized (status: ${response.status}) on ${endpoint}`);
      return normalizeError(ERROR_CODES.UNAUTHORIZED);
    }

    if (!response.ok) {
      logger.error(`API response error (status: ${response.status}) on ${endpoint}`);
      return normalizeError(ERROR_CODES.SYNC_FAILED);
    }

    const data = await response.json().catch(() => ({}));
    logger.debug(`API response success from ${endpoint}`, { data });
    return {
      ok: true,
      data
    };
  } catch (error) {
    logger.error(`API request failed on ${endpoint}`, { error: error.message });
    return normalizeError(ERROR_CODES.BACKEND_OFFLINE);
  }
}

/**
 * Kiểm tra kết nối tới Backend (Health check)
 */
export async function checkBackendHealth() {
  return callApi("/health", "GET", null, false, false);
}

/**
 * Gửi yêu cầu kiểm tra trạng thái phiên lên Backend
 */
export async function checkSessionOnBackend(sessionStatusPayload) {
  return callApi("/api/extension/check-session", "POST", sessionStatusPayload, true, false);
}

/**
 * Đồng bộ phiên đăng nhập thực tế về Backend
 */
export async function syncSessionToBackend(sessionDataPayload) {
  // Đồng bộ dữ liệu nhạy cảm yêu cầu HTTPS (trừ localhost được miễn trừ trong isHttpsUrl)
  return callApi("/api/extension/sync-session", "POST", sessionDataPayload, true, true);
}

/**
 * Ghi nhận sự kiện hoạt động lên Backend
 */
export async function logEventToBackend(eventPayload) {
  return callApi("/api/extension/log-event", "POST", eventPayload, true, false);
}
