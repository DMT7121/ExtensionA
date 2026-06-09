/**
 * Mask a secret string, e.g., "abcdef" -> "ab***ef"
 */
export function maskSecret(value) {
  if (!value || typeof value !== "string") return "";
  if (value.length <= 6) {
    return "***";
  }
  return value.substring(0, 3) + "***" + value.substring(value.length - 3);
}

/**
 * Check if the url has HTTPS scheme (or localhost during development)
 */
export function isHttpsUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return true; // Allow local HTTP for testing
    }
    return parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
}

/**
 * Check if domain is in the allowlist
 */
export function isAllowedDomain(domain, allowlist) {
  if (!domain || !allowlist || !Array.isArray(allowlist)) return false;
  const cleanDomain = domain.toLowerCase().trim();
  return allowlist.some(allowed => {
    const cleanAllowed = allowed.toLowerCase().trim();
    return cleanDomain === cleanAllowed || cleanDomain.endsWith("." + cleanAllowed);
  });
}

/**
 * Recursively clone and sanitize an object, masking keys containing sensitive words
 */
export function sanitizePayload(payload) {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => sanitizePayload(item));
  }

  if (typeof payload === "object") {
    const sanitized = {};
    const sensitiveKeys = ["token", "cookie", "session", "zpsid", "zpw", "secret", "key", "password", "value"];
    
    for (const key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
        
        if (isSensitive) {
          if (typeof payload[key] === "string") {
            sanitized[key] = maskSecret(payload[key]);
          } else if (typeof payload[key] === "object" && payload[key] !== null) {
            // If it's a cookie object or subobject, we can recursively clean or mask
            sanitized[key] = "[Masked Object/Array]";
          } else {
            sanitized[key] = "***";
          }
        } else {
          sanitized[key] = sanitizePayload(payload[key]);
        }
      }
    }
    return sanitized;
  }

  return payload;
}

/**
 * Validate configuration object
 */
export function validateConfig(config) {
  if (!config) return { valid: false, reason: "Cấu hình rỗng" };
  if (!config.apiUrl) return { valid: false, reason: "Chưa cấu hình Backend API URL." };
  
  try {
    new URL(config.apiUrl);
  } catch (e) {
    return { valid: false, reason: "Định dạng Backend API URL không hợp lệ." };
  }

  // If sync mode is 'confirm' or 'auto', make sure admin token is present
  if ((config.syncMode === "confirm" || config.syncMode === "auto") && !config.adminToken) {
    return { valid: false, reason: "Yêu cầu Admin Token/API Key khi bật chế độ đồng bộ." };
  }

  return { valid: true };
}

/**
 * Return consent warning text
 */
export function buildConsentWarning() {
  return "Cookie/session là bí mật đăng nhập. Chỉ tiếp tục nếu đây là tài khoản của bạn và bạn hiểu rủi ro khi đồng bộ dữ liệu này về backend.";
}
