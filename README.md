# ExtensionA - KING's GRILL Admin Tool

Tiện ích mở rộng Chrome (Chrome Extension Manifest V3) dùng để quản trị phiên làm việc (web session) và đồng bộ trạng thái phục vụ hệ thống bot/automation nội bộ của **KING's GRILL**.

---

## 1. Mục tiêu và Vai trò
`ExtensionA` giúp quản trị viên:
- **Kiểm tra trạng thái kết nối** tới hệ thống Backend API.
- **Kiểm tra phiên đăng nhập Zalo Web** (`zpsid`, `zpw_sek`) xem có bị hết hạn hay mất kết nối không.
- **Đồng bộ thủ công hoặc tự động** thông tin phiên (nếu người dùng cho phép rõ ràng) về Backend để bot tiếp tục vận hành các tác vụ gửi tin nhắn, đồng bộ đơn hàng tự động.
- **Cảnh báo mất phiên** trực tiếp qua Webhook (Discord/Slack) và ghi nhận nhật ký hệ thống.

---

## 2. Nguyên tắc Bảo mật Bắt buộc
Dữ liệu phiên làm việc (`zpsid`, `zpw_sek`, cookies) là **bí mật đăng nhập**. Do đó, extension được thiết kế dựa trên các tiêu chuẩn bảo mật nghiêm ngặt nhất:
1. **Không âm thầm thu thập**: Extension tuyệt đối không đọc, ghi hay tải lên cookie nếu người dùng chưa đồng ý điều khoản bảo mật (Consent) rõ ràng trên giao diện Popup.
2. **Che giấu dữ liệu nhạy cảm (Masking)**: Các giá trị nhạy cảm hiển thị trên UI hoặc ghi trong logs console đều được mã hóa dạng `abc***xyz`.
3. **Mã hóa truyền tải (HTTPS)**: Khi thực hiện đồng bộ session lên Backend, extension bắt buộc kiểm tra xem URL Backend có sử dụng giao thức **HTTPS** hay không (ngoại trừ môi trường thử nghiệm `localhost`). Nếu là HTTP thường, yêu cầu sẽ bị chặn ngay lập tức để bảo vệ phiên khỏi bị nghe lén.
4. **Log an toàn**: Nhật ký Console sẽ tự động lọc bỏ (strip/mask) toàn bộ các trường chứa từ khóa nhạy cảm (`token`, `key`, `cookie`, `session`, `zpsid`, `zpw`).

---

## 3. Cấu trúc thư mục dự án
```txt
ExtensionA/
├── manifest.json
├── README.md
├── CHANGELOG.md
├── assets/
│   └── icons/
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
└── src/
    ├── background/
    │   └── service-worker.js
    ├── popup/
    │   ├── popup.html
    │   ├── popup.css
    │   └── popup.js
    ├── options/
    │   ├── options.html
    │   ├── options.css
    │   └── options.js
    └── shared/
        ├── api-client.js
        ├── constants.js
        ├── logger.js
        ├── security.js
        └── storage.js
```

---

## 4. Hướng dẫn cài đặt Extension (Developer Mode)
1. Mở trình duyệt Google Chrome hoặc trình duyệt nhân Chromium khác.
2. Truy cập đường dẫn: `chrome://extensions/`.
3. Bật chế độ nhà phát triển bằng cách gạt công tắc **Chế độ nhà phát triển (Developer mode)** ở góc trên bên phải.
4. Nhấp vào nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái.
5. Chọn thư mục gốc `Extension 0205` chứa tệp `manifest.json`.
6. Biểu tượng của ExtensionA sẽ xuất hiện trên thanh công cụ tiện ích.

---

## 5. Cấu hình & Sử dụng

### Bước 1: Cấu hình kết nối Backend
- Click chuột phải vào biểu tượng Extension và chọn **Tùy chọn (Options)**, hoặc mở Popup rồi nhấn nút **Mở Cấu hình / Mở cài đặt (răng cưa)**.
- Điền các thông tin:
  - **Backend API URL**: Điền đường dẫn API của Server (ví dụ: `https://api.kingsgrill.vn` hoặc `http://localhost:3000` cho local).
  - **Admin Token / API Key**: Token xác thực quyền truy cập của quản trị viên.
  - **Chế độ hoạt động**:
    - *Chỉ kiểm tra cục bộ*: Chỉ kiểm tra session trên máy tính, không tự động gửi đi.
    - *Cho phép đồng bộ sau khi xác nhận*: Cho phép đồng bộ thủ công từ Popup sau khi tick chọn đồng ý bảo mật.
    - *Tắt đồng bộ*: Tắt hoàn toàn tất cả luồng gửi dữ liệu ra bên ngoài.
  - **Webhook URL**: Đường dẫn Discord/Slack webhook để nhận tin nhắn cảnh báo khi mất phiên Zalo.
- Nhấn nút **Kiểm tra kết nối Backend** để test xem API Server có phản hồi không.
- Nhấn **Lưu cấu hình** để lưu lại thiết lập.

### Bước 2: Kiểm tra phiên và Đồng bộ an toàn
- Mở Popup của Extension.
- Nhấn **Kiểm tra Backend** và **Kiểm tra phiên** để cập nhật trạng thái mới nhất từ trình duyệt và API.
- Để đồng bộ session về backend:
  - Hãy đảm bảo bạn đã tích chọn vào checkbox **"Tôi đã hiểu rủi ro và xác nhận đồng ý gửi session"** trong khung cảnh báo bảo mật.
  - Nhấp nút **Đồng bộ cấu hình & Phiên**.
  - Kiểm tra xem nhật ký hiển thị dòng chữ màu xanh lá cây báo đồng bộ thành công.

---

## 6. Các API Backend cần thiết
Backend API cần cung cấp các endpoint sau (được định nghĩa trong `src/shared/api-client.js`):
1. `GET /health`: Trả về trạng thái hoạt động của server (status 200 OK).
2. `POST /api/extension/check-session`: Nhận payload xem phiên có hợp lệ không.
3. `POST /api/extension/sync-session`: Nhận payload cookie/session chi tiết để lưu vào database của Bot.
4. `POST /api/extension/log-event`: Nhận log hoạt động của extension để lưu audit log trên server.

---

## 7. Troubleshooting (Xử lý sự cố)
- **Lỗi `HTTPS_REQUIRED`**: Xảy ra khi bạn cố gắng đồng bộ dữ liệu phiên tới một API dùng HTTP thường (không bảo mật). Vui lòng cấu hình URL dạng `https://` cho Production, hoặc sử dụng `localhost` (`http://localhost:...`) cho môi trường lập trình local.
- **Lỗi `UNAUTHORIZED`**: Admin Token / API Key cấu hình sai hoặc đã hết hạn trên Server. Vui lòng kiểm tra lại cấu hình trên Options.
- **Lỗi `BACKEND_OFFLINE`**: Server backend không thể kết nối (mạng lỗi, server tắt hoặc sai URL).
- **Lỗi `CONSENT_REQUIRED`**: Chưa tick xác nhận bảo mật ở giao diện Popup trước khi ấn đồng bộ.

---

## 8. Checklist trước khi vận hành Production
- [ ] Đã chuyển Backend API sang giao thức `https://`.
- [ ] Đã cấp quyền và cấu hình đúng Admin Token / API Key.
- [ ] Webhook URL đã được cấu hình và hoạt động tốt để bắn thông báo.
- [ ] Đã thử nghiệm tải/xóa cookie Zalo Web và xác nhận Extension bắn cảnh báo chính xác.
