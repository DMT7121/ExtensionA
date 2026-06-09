import { getConfig, getConsent, saveConsent, clearAllLocalData } from "../shared/storage.js";
import { buildConsentWarning, validateConfig } from "../shared/security.js";

// DOM Elements
const extStatusBadge = document.getElementById("ext-status-badge");
const backendStatusBadge = document.getElementById("backend-status-badge");
const sessionStatusBadge = document.getElementById("session-status-badge");

const previewPanel = document.getElementById("preview-panel");
const zpsidPreview = document.getElementById("zpsid-preview");
const zpwSekPreview = document.getElementById("zpw-sek-preview");

const consentCard = document.getElementById("consent-card");
const consentWarningText = document.getElementById("consent-warning-text");
const consentCheckbox = document.getElementById("consent-checkbox");

const btnCheckBackend = document.getElementById("btn-check-backend");
const btnCheckSession = document.getElementById("btn-check-session");
const btnSyncSession = document.getElementById("btn-sync-session");
const btnOpenOptions = document.getElementById("btn-open-options");
const btnOpenSettings = document.getElementById("open-settings-btn");
const btnClearData = document.getElementById("btn-clear-data");

const logsBox = document.getElementById("logs-box");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  addLog("info", "Đang khởi tạo ExtensionA...");
  await initUI();
});

/**
 * Hiển thị Toast thông báo
 */
function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

/**
 * Thêm dòng log vào box nhật ký
 */
function addLog(type, text) {
  const line = document.createElement("div");
  line.className = `log-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  logsBox.appendChild(line);
  logsBox.scrollTop = logsBox.scrollHeight;
}

/**
 * Khởi tạo dữ liệu UI ban đầu
 */
async function initUI() {
  try {
    const config = await getConfig();
    const validation = validateConfig(config);

    // 1. Cập nhật Badge Extension
    if (!validation.valid) {
      extStatusBadge.className = "badge badge-warning";
      extStatusBadge.textContent = "Chưa cấu hình";
      addLog("warn", `Cấu hình chưa hợp lệ: ${validation.reason}`);
    } else {
      extStatusBadge.className = "badge badge-success";
      extStatusBadge.textContent = "Đang hoạt động";
      addLog("success", "Cấu hình hợp lệ. Hệ thống sẵn sàng.");
    }

    // 2. Load Zalo Session Preview (đã che)
    chrome.runtime.sendMessage({ type: "GET_SESSION_PREVIEW" }, (response) => {
      if (response && response.ok && response.data) {
        const { hasSession, zpsidMasked, zpwSekMasked, cookieCount } = response.data;
        if (hasSession) {
          previewPanel.style.display = "block";
          zpsidPreview.textContent = zpsidMasked;
          zpwSekPreview.textContent = zpwSekMasked;
          sessionStatusBadge.className = "badge badge-success";
          sessionStatusBadge.textContent = "Đã phát hiện";
          addLog("success", `Đã phát hiện session Zalo (${cookieCount} cookies)`);
        } else {
          previewPanel.style.display = "none";
          sessionStatusBadge.className = "badge badge-danger";
          sessionStatusBadge.textContent = "Chưa đăng nhập";
          addLog("warn", "Không tìm thấy phiên đăng nhập Zalo trên trình duyệt.");
        }
      } else {
        addLog("error", "Lỗi đọc phiên từ background worker.");
      }
    });

    // 3. Chuẩn bị Consent warning
    consentWarningText.textContent = buildConsentWarning();
    const consent = await getConsent();
    consentCheckbox.checked = consent;

    if (!consent && config.syncMode === "confirm") {
      consentCard.style.display = "flex";
    }

    // Gắn sự kiện checkbox
    consentCheckbox.addEventListener("change", async () => {
      await saveConsent(consentCheckbox.checked);
      if (consentCheckbox.checked) {
        addLog("info", "Đã xác nhận đồng ý điều khoản bảo mật.");
      } else {
        addLog("warn", "Đã hủy xác nhận bảo mật. Không thể đồng bộ.");
      }
    });

    // Setup action listeners
    setupListeners();

  } catch (err) {
    addLog("error", `Lỗi khởi tạo UI: ${err.message}`);
  }
}

/**
 * Đăng ký sự kiện click các nút thao tác
 */
function setupListeners() {
  // 1. Kiểm tra Backend
  btnCheckBackend.addEventListener("click", () => {
    addLog("info", "Đang kết nối tới Backend...");
    backendStatusBadge.className = "badge badge-secondary";
    backendStatusBadge.textContent = "Đang kiểm tra...";

    chrome.runtime.sendMessage({ type: "CHECK_HEALTH" }, (response) => {
      if (response && response.ok) {
        backendStatusBadge.className = "badge badge-success";
        backendStatusBadge.textContent = "Online";
        addLog("success", "Backend kết nối thành công! (Online)");
      } else {
        backendStatusBadge.className = "badge badge-danger";
        backendStatusBadge.textContent = "Offline";
        const errMsg = response?.error?.message || "Không thể kết nối.";
        addLog("error", `Backend ngoại tuyến: ${errMsg}`);
      }
    });
  });

  // 2. Kiểm tra phiên
  btnCheckSession.addEventListener("click", () => {
    addLog("info", "Đang gửi yêu cầu kiểm tra trạng thái phiên...");
    sessionStatusBadge.className = "badge badge-secondary";
    sessionStatusBadge.textContent = "Đang kiểm tra...";

    chrome.runtime.sendMessage({ type: "CHECK_SESSION" }, (response) => {
      if (response && response.ok) {
        sessionStatusBadge.className = "badge badge-success";
        sessionStatusBadge.textContent = "Hợp lệ";
        addLog("success", "Phiên hoạt động (Session) được xác nhận hợp lệ bởi Backend.");
      } else {
        sessionStatusBadge.className = "badge badge-danger";
        sessionStatusBadge.textContent = "Lỗi/Hết hạn";
        const errMsg = response?.error?.message || "Hết hạn hoặc không được chấp nhận.";
        addLog("error", `Kiểm tra phiên thất bại: ${errMsg}`);
      }
    });
  });

  // 3. Đồng bộ cấu hình & Phiên
  btnSyncSession.addEventListener("click", async () => {
    const config = await getConfig();
    if (config.syncMode === "disabled") {
      showToast("Chế độ đồng bộ đã bị TẮT hoàn toàn.");
      addLog("error", "Không thể đồng bộ vì tính năng này đã bị vô hiệu hóa trong cài đặt.");
      return;
    }

    const consent = await getConsent();
    if (!consent) {
      consentCard.style.display = "flex";
      showToast("Bạn cần xác nhận đồng ý bảo mật trước.");
      addLog("warn", "Yêu cầu đồng ý bảo mật trước khi đồng bộ thông tin đăng nhập.");
      return;
    }

    addLog("info", "Đang thực hiện đồng bộ phiên an toàn...");
    btnSyncSession.disabled = true;

    chrome.runtime.sendMessage({ type: "SYNC_SESSION" }, (response) => {
      btnSyncSession.disabled = false;
      if (response && response.ok) {
        addLog("success", "Đồng bộ phiên đăng nhập thành công về hệ thống backend.");
        showToast("Đồng bộ thành công!");
        consentCard.style.display = "none";
      } else {
        const errMsg = response?.error?.message || "Đồng bộ thất bại.";
        addLog("error", `Lỗi đồng bộ: ${errMsg}`);
        showToast(`Lỗi: ${response?.error?.code || "SYNC_FAILED"}`);
      }
    });
  });

  // 4. Mở Cấu hình / Options
  const openOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("src/options/options.html"));
    }
  };

  btnOpenOptions.addEventListener("click", openOptions);
  btnOpenSettings.addEventListener("click", openOptions);

  // 5. Xóa dữ liệu local
  btnClearData.addEventListener("click", async () => {
    const confirmClear = confirm("Bạn có chắc chắn muốn xóa toàn bộ cấu hình đã lưu cục bộ?");
    if (!confirmClear) return;

    try {
      await clearAllLocalData();
      addLog("info", "Đã xóa sạch cấu hình cục bộ.");
      showToast("Đã reset dữ liệu.");
      // Tải lại UI sau khi xóa
      await initUI();
    } catch (e) {
      addLog("error", "Lỗi khi xóa dữ liệu: " + e.message);
    }
  });
}
