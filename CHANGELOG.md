# CHANGELOG - ExtensionA

## [3.0.0] - 2026-06-10
### Added
- **Kiến trúc Manifest V3**: Cấu hình tệp `manifest.json` chuẩn bảo mật MV3 của Google Chrome.
- **Shared Modules**:
  - `constants.js`: Định nghĩa các cấu hình mặc định, mã lỗi và thông báo lỗi tiếng Việt chuẩn.
  - `storage.js`: Wrapper lưu trữ cấu hình, trạng thái consent và status bằng `chrome.storage.local`.
  - `security.js`: Xây dựng hệ thống che giấu thông tin nhạy cảm (Masking), kiểm định URL HTTPS bảo mật và làm sạch payload (Sanitize).
  - `logger.js`: Hệ thống ghi nhận nhật ký (Log levels) tự động bảo vệ dữ liệu, không bao giờ in secret ra console.
  - `api-client.js`: Lớp giao tiếp API hỗ trợ timeout, retry 2 lần khi gặp sự cố mạng, chèn token xác thực tự động.
- **Service Worker**:
  - `background/service-worker.js`: Quản lý tác vụ chạy nền, định kỳ chạy alarm quét kiểm tra trạng thái phiên và báo cáo về webhook tự động.
- **Giao diện Options (Cài đặt)**:
  - Cho phép quản trị cấu hình API URL, Admin Token, sync mode, allowlist, webhook URL và khoảng cách quét định kỳ.
  - Tích hợp tính năng "Kiểm tra kết nối Backend" tức thì.
- **Giao diện Popup**:
  - Thiết kế hiện đại dạng Card UI với gradient màu xanh dương chủ đạo của thương hiệu KING's GRILL.
  - Hiển thị đầy đủ trạng thái kết nối, trạng thái phiên, và log hoạt động đã được làm sạch.
  - Luồng chấp thuận bảo mật (Consent warning) trực quan bắt buộc người dùng xác nhận trước khi đồng bộ thông tin nhạy cảm.

### Changed
- Lưu trữ/Đóng gói các tệp Máy tính thuế VAT cũ vào thư mục `archive/vat-calculator/` để làm sạch gốc dự án.
