import assert from "assert";
import { maskSecret, isHttpsUrl, isAllowedDomain, sanitizePayload, validateConfig } from "../src/shared/security.js";

console.log("==========================================");
console.log("BẮT ĐẦU CHẠY KIỂM THỬ TỰ ĐỘNG (UNIT TESTS)");
console.log("==========================================\n");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

// 1. Kiểm thử maskSecret
runTest("maskSecret - chuỗi thông thường", () => {
  assert.strictEqual(maskSecret("zpsid-123456-secret"), "zps***ret");
  assert.strictEqual(maskSecret("1234567"), "123***567");
});

runTest("maskSecret - chuỗi ngắn", () => {
  assert.strictEqual(maskSecret("abc"), "***");
  assert.strictEqual(maskSecret(""), "");
});

runTest("maskSecret - giá trị rỗng/null", () => {
  assert.strictEqual(maskSecret(null), "");
  assert.strictEqual(maskSecret(undefined), "");
});

// 2. Kiểm thử isHttpsUrl
runTest("isHttpsUrl - HTTPS thông thường", () => {
  assert.strictEqual(isHttpsUrl("https://api.kingsgrill.vn"), true);
});

runTest("isHttpsUrl - HTTP thường", () => {
  assert.strictEqual(isHttpsUrl("http://api.kingsgrill.vn"), false);
});

runTest("isHttpsUrl - Localhost (miễn trừ HTTP)", () => {
  assert.strictEqual(isHttpsUrl("http://localhost:3000"), true);
  assert.strictEqual(isHttpsUrl("http://127.0.0.1:8000"), true);
});

runTest("isHttpsUrl - URL sai định dạng", () => {
  assert.strictEqual(isHttpsUrl("not-a-url"), false);
});

// 3. Kiểm thử isAllowedDomain
runTest("isAllowedDomain - trùng khớp hoàn toàn", () => {
  const allowlist = ["chat.zalo.me", "id.zalo.me"];
  assert.strictEqual(isAllowedDomain("chat.zalo.me", allowlist), true);
  assert.strictEqual(isAllowedDomain("id.zalo.me", allowlist), true);
});

runTest("isAllowedDomain - subdomain hợp lệ", () => {
  const allowlist = ["zalo.me"];
  assert.strictEqual(isAllowedDomain("chat.zalo.me", allowlist), true);
  assert.strictEqual(isAllowedDomain("sub.domain.zalo.me", allowlist), true);
});

runTest("isAllowedDomain - domain ngoài allowlist", () => {
  const allowlist = ["chat.zalo.me"];
  assert.strictEqual(isAllowedDomain("facebook.com", allowlist), false);
  assert.strictEqual(isAllowedDomain("zalo.me", allowlist), false); // chat.zalo.me is in allowlist, not parent zalo.me
});

// 4. Kiểm thử sanitizePayload
runTest("sanitizePayload - loại bỏ/mã hóa các key nhạy cảm", () => {
  const original = {
    url: "https://api.test",
    zpsid: "secret-zpsid-123456",
    zpw_sek: "secret-sek-value",
    adminToken: "my-secret-admin-token",
    nested: {
      sessionKey: "session-key-value",
      publicField: "public-value"
    },
    cookies: [
      { name: "zpsid", value: "cookie-value-123" }
    ]
  };

  const sanitized = sanitizePayload(original);

  // Gốc không bị thay đổi (immutability)
  assert.strictEqual(original.zpsid, "secret-zpsid-123456");

  // Kiểm tra đã che giấu
  assert.strictEqual(sanitized.zpsid, "sec***456");
  assert.strictEqual(sanitized.zpw_sek, "sec***lue");
  assert.strictEqual(sanitized.adminToken, "my-***ken");
  assert.strictEqual(sanitized.nested.sessionKey, "ses***lue");
  assert.strictEqual(sanitized.nested.publicField, "public-value"); // Không nhạy cảm
  assert.strictEqual(sanitized.cookies, "[Masked Object/Array]");
});

// 5. Kiểm thử validateConfig
runTest("validateConfig - cấu hình hợp lệ", () => {
  const config = {
    apiUrl: "https://api.kingsgrill.vn",
    adminToken: "some-token",
    syncMode: "confirm"
  };
  const res = validateConfig(config);
  assert.strictEqual(res.valid, true);
});

runTest("validateConfig - thiếu apiUrl", () => {
  const config = {
    apiUrl: "",
    adminToken: "some-token",
    syncMode: "confirm"
  };
  const res = validateConfig(config);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.reason.includes("API URL"), true);
});

runTest("validateConfig - thiếu token khi bật sync", () => {
  const config = {
    apiUrl: "https://api.test",
    adminToken: "",
    syncMode: "confirm"
  };
  const res = validateConfig(config);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.reason.includes("Admin Token"), true);
});

console.log("\n==========================================");
console.log(`KẾT QUẢ: ${passed} bài test ĐẠT, ${failed} bài test THẤT BẠI.`);
console.log("==========================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
