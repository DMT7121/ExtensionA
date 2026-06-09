export const DEFAULT_CONFIG = {
  apiUrl: "http://localhost:3000",
  adminToken: "",
  syncMode: "confirm", // 'local' (chỉ kiểm tra cục bộ), 'confirm' (đồng bộ sau xác nhận), 'disabled' (tắt đồng bộ tự động)
  allowlist: ["chat.zalo.me", "id.zalo.me"],
  webhookUrl: "",
  debugMode: false,
  checkInterval: 60 // phút
};

export const ERROR_CODES = {
  BACKEND_OFFLINE: "BACKEND_OFFLINE",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CONFIG: "INVALID_CONFIG",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SYNC_FAILED: "SYNC_FAILED",
  COOKIE_PERMISSION_DENIED: "COOKIE_PERMISSION_DENIED",
  CONSENT_REQUIRED: "CONSENT_REQUIRED",
  HTTPS_REQUIRED: "HTTPS_REQUIRED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR"
};

export const ERROR_MESSAGES = {
  BACKEND_OFFLINE: "Không thể kết nối backend. Vui lòng kiểm tra server Render/Cloud.",
  UNAUTHORIZED: "Admin Token không hợp lệ hoặc đã hết hạn.",
  INVALID_CONFIG: "Chưa cấu hình Backend API URL.",
  SESSION_EXPIRED: "Phiên có thể đã hết hạn. Vui lòng đăng nhập lại Zalo Web.",
  SYNC_FAILED: "Đồng bộ thất bại. Vui lòng thử lại sau.",
  COOKIE_PERMISSION_DENIED: "Bạn chưa cấp quyền đọc cookie cho domain này.",
  CONSENT_REQUIRED: "Không thể đồng bộ vì bạn chưa xác nhận cảnh báo bảo mật.",
  HTTPS_REQUIRED: "Backend URL cần dùng HTTPS khi đồng bộ dữ liệu nhạy cảm.",
  UNKNOWN_ERROR: "Đã xảy ra lỗi không xác định."
};
