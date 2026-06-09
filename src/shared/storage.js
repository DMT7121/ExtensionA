import { DEFAULT_CONFIG } from "./constants.js";

/**
 * Lấy cấu hình hiện tại từ storage.local
 */
export async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["config"], (result) => {
      resolve({ ...DEFAULT_CONFIG, ...result.config });
    });
  });
}

/**
 * Lưu cấu hình mới
 */
export async function saveConfig(config) {
  const current = await getConfig();
  const updated = { ...current, ...config };
  return new Promise((resolve) => {
    chrome.storage.local.set({ config: updated }, () => {
      resolve(updated);
    });
  });
}

/**
 * Xóa cấu hình
 */
export async function clearConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["config"], () => {
      resolve();
    });
  });
}

/**
 * Lấy trạng thái đồng thuận (consent)
 */
export async function getConsent() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["consent"], (result) => {
      resolve(!!result.consent);
    });
  });
}

/**
 * Lưu trạng thái đồng thuận
 */
export async function saveConsent(consent) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ consent: !!consent }, () => {
      resolve();
    });
  });
}

/**
 * Xóa trạng thái đồng thuận
 */
export async function clearConsent() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["consent"], () => {
      resolve();
    });
  });
}

/**
 * Lấy trạng thái kiểm tra cuối cùng
 */
export async function getLastStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["lastStatus"], (result) => {
      resolve(result.lastStatus || null);
    });
  });
}

/**
 * Lưu trạng thái kiểm tra cuối cùng
 */
export async function saveLastStatus(status) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ lastStatus: status }, () => {
      resolve();
    });
  });
}

/**
 * Xóa toàn bộ dữ liệu cục bộ
 */
export async function clearAllLocalData() {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      resolve();
    });
  });
}
