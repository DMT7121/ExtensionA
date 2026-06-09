import { getConfig, saveConfig, clearAllLocalData } from "../shared/storage.js";
import { DEFAULT_CONFIG } from "../shared/constants.js";
import { validateConfig } from "../shared/security.js";

// DOM Elements
const apiUrlInput = document.getElementById("api-url");
const adminTokenInput = document.getElementById("admin-token");
const toggleTokenBtn = document.getElementById("toggle-token-btn");
const syncModeSelect = document.getElementById("sync-mode");
const allowlistInput = document.getElementById("allowlist");
const webhookUrlInput = document.getElementById("webhook-url");
const checkIntervalInput = document.getElementById("check-interval");
const debugModeCheckbox = document.getElementById("debug-mode");

const testConnectionBtn = document.getElementById("test-connection-btn");
const testSpinner = document.getElementById("test-spinner");
const testResultStatus = document.getElementById("test-result-status");

const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const clearAllBtn = document.getElementById("clear-all-btn");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");

// Load Settings on start
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  setupEventListeners();
});

/**
 * Hiển thị thông báo Toast
 */
function showToast(message, duration = 3000) {
  toastMessage.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

/**
 * Tải cấu hình từ Storage lên Form
 */
async function loadSettings() {
  try {
    const config = await getConfig();
    apiUrlInput.value = config.apiUrl || "";
    adminTokenInput.value = config.adminToken || "";
    syncModeSelect.value = config.syncMode || "confirm";
    allowlistInput.value = (config.allowlist || []).join(", ");
    webhookUrlInput.value = config.webhookUrl || "";
    checkIntervalInput.value = config.checkInterval || 60;
    debugModeCheckbox.checked = !!config.debugMode;
  } catch (err) {
    showToast("Không thể tải cấu hình: " + err.message);
  }
}

/**
 * Đăng ký sự kiện
 */
function setupEventListeners() {
  // Toggle password visibility
  toggleTokenBtn.addEventListener("click", () => {
    const isPassword = adminTokenInput.type === "password";
    adminTokenInput.type = isPassword ? "text" : "password";
    
    // Đổi icon SVG hiển thị
    if (isPassword) {
      toggleTokenBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    } else {
      toggleTokenBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
  });

  // Test Backend Connection
  testConnectionBtn.addEventListener("click", async () => {
    testSpinner.style.display = "inline-block";
    testResultStatus.className = "test-status";
    testResultStatus.textContent = "Đang kiểm tra...";
    testConnectionBtn.disabled = true;

    // Lấy thông tin tạm thời trên UI để test trước khi lưu
    const tempConfig = {
      apiUrl: apiUrlInput.value.trim(),
      adminToken: adminTokenInput.value.trim(),
      syncMode: syncModeSelect.value
    };

    const validation = validateConfig(tempConfig);
    if (!validation.valid) {
      testResultStatus.className = "test-status error";
      testResultStatus.textContent = validation.reason;
      testSpinner.style.display = "none";
      testConnectionBtn.disabled = false;
      return;
    }

    try {
      // Gửi message tới background để kiểm tra
      chrome.runtime.sendMessage({ type: "CHECK_HEALTH" }, (response) => {
        testSpinner.style.display = "none";
        testConnectionBtn.disabled = false;

        if (response && response.ok) {
          testResultStatus.className = "test-status success";
          testResultStatus.textContent = "Kết nối Backend thành công! (Online)";
        } else {
          testResultStatus.className = "test-status error";
          const errorMsg = response?.error?.message || "Không thể kết nối.";
          testResultStatus.textContent = `Lỗi: ${errorMsg}`;
        }
      });
    } catch (err) {
      testSpinner.style.display = "none";
      testConnectionBtn.disabled = false;
      testResultStatus.className = "test-status error";
      testResultStatus.textContent = "Lỗi runtime: " + err.message;
    }
  });

  // Save Config
  saveBtn.addEventListener("click", async () => {
    // Thu thập dữ liệu
    const allowlist = allowlistInput.value
      .split(",")
      .map(d => d.trim())
      .filter(d => d.length > 0);

    const newConfig = {
      apiUrl: apiUrlInput.value.trim(),
      adminToken: adminTokenInput.value.trim(),
      syncMode: syncModeSelect.value,
      allowlist,
      webhookUrl: webhookUrlInput.value.trim(),
      checkInterval: parseInt(checkIntervalInput.value, 10) || 60,
      debugMode: debugModeCheckbox.checked
    };

    // Validate
    const validation = validateConfig(newConfig);
    if (!validation.valid) {
      showToast("Lỗi: " + validation.reason);
      return;
    }

    try {
      await saveConfig(newConfig);
      showToast("Lưu cấu hình thành công!");
      // Reset status test cũ
      testResultStatus.textContent = "";
      testResultStatus.className = "test-status";
    } catch (err) {
      showToast("Lỗi lưu trữ: " + err.message);
    }
  });

  // Reset to Defaults
  resetBtn.addEventListener("click", async () => {
    const confirmReset = confirm("Bạn có chắc chắn muốn khôi phục cấu hình mặc định không?");
    if (!confirmReset) return;

    try {
      await saveConfig(DEFAULT_CONFIG);
      await loadSettings();
      showToast("Đã khôi phục cấu hình mặc định.");
      testResultStatus.textContent = "";
    } catch (err) {
      showToast("Không thể khôi phục: " + err.message);
    }
  });

  // Clear All Data
  clearAllBtn.addEventListener("click", async () => {
    const confirmClear = confirm("Hành động này sẽ XÓA TOÀN BỘ cấu hình, khóa đăng nhập và quyền đồng ý bảo mật trên máy này. Bạn có chắc chắn?");
    if (!confirmClear) return;

    try {
      await clearAllLocalData();
      apiUrlInput.value = "";
      adminTokenInput.value = "";
      syncModeSelect.value = "confirm";
      allowlistInput.value = "";
      webhookUrlInput.value = "";
      checkIntervalInput.value = "60";
      debugModeCheckbox.checked = false;
      
      showToast("Đã xóa sạch toàn bộ dữ liệu cục bộ.");
      testResultStatus.textContent = "";
    } catch (err) {
      showToast("Lỗi xóa dữ liệu: " + err.message);
    }
  });
}
