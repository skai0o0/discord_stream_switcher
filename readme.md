# 📖 Discord Stream Switcher Dashboard

## Giới thiệu

**Discord Stream Switcher Dashboard** là công cụ hỗ trợ quản lý và chuyển đổi giữa nhiều luồng stream (multistream) trong kênh thoại Discord. Ứng dụng này giúp bạn:

- Lấy danh sách tất cả stream đang hoạt động.
- Đảm bảo **luồng Grid** luôn nằm ở cuối danh sách và có badge phân biệt.
- Chuyển đổi nhanh giữa các stream bằng **hotkey Alt + F1..F9** hoặc qua giao diện web.
- Hỗ trợ **swap** (chuyển đổi nhanh giữa màn chính ↔ webcam PiP).
- Kết nối với **Stream Deck** (vật lý hoặc ảo) thông qua script `.bat`.

---

## Yêu cầu hệ thống

- Windows 10/11
- [Node.js LTS (>=18)](https://nodejs.org/en/download)
- Trình duyệt **Chromium** (Chrome hoặc Edge)
- Discord Desktop App

---

## Hướng dẫn cài đặt

### Bước 1. Clone dự án

```bash
git clone <repo-url>
cd discord-web-app
```

### Bước 2. One-click Setup

Trong thư mục dự án có sẵn script:

- `setup_oneclick_v3.bat` (chạy 1 click trên Windows)

Script sẽ:

1. Mở Discord ở **debug mode** với port `9222`.
2. Kiểm tra Node.js/npm (gợi ý cài nếu chưa có).
3. Cài dependencies (chỉ lần đầu; các lần sau sẽ **skip** nếu `node_modules` đã tồn tại).
4. Mở `http://localhost:3333` trên trình duyệt mặc định.
5. In ra hướng dẫn chi tiết trong terminal.
6. Chạy server Node (`npm start` hoặc `node server.js`).

---

## Hướng dẫn sử dụng

### 1. Chuẩn bị

- Mở Discord ở debug mode:

```powershell
%LocalAppData%\Discord\Update.exe --processStart Discord.exe --process-start-args="--remote-debugging-port=9222"
```

### 2. Remote Inspect

- Mở **Chrome**: `chrome://inspect/#devices`
- Hoặc **Edge**: `edge://inspect/#devices`
- Nhấn **Configure…** → thêm `localhost:9222`
- Chờ \~1 phút → các tab Discord xuất hiện → chọn **Inspect** tab đang join voice channel

### 3. Inject Script

- Trong tab DevTools (Discord): vào **Console**
- Vào `http://localhost:3333` → mục **Copy Script** → nhấn **Copy Main Script**
- Dán vào Console → Enter

### 4. Quản lý Streams

- Giao diện web hiển thị danh sách stream:
  - Badge **GRID**: luôn ở cuối.
  - Badge `F1..F9`: hotkey.
  - Action: **Focus** (chuyển), **Swap** (chỉ cá nhân).
- Logs hiển thị trạng thái chuyển stream.

### 5. Hotkeys

- `Alt + F1..F9` → Chuyển trực tiếp stream
- `Alt + ← / →` → Next / Previous
- `Alt + S` → Swap giữa main ↔ PiP (nếu có)

### 6. Stream Deck (tùy chọn)

- Thư mục `stream_deck_scripts` chứa `.bat` & `.ps1`
- Gán vào nút Stream Deck để điều khiển trực tiếp (switch, next, prev, swap, focus grid).

---

## Ghi chú

- Nếu không phát hiện trình Chromium → cần cài Chrome hoặc Edge.
- Nếu chưa có Node.js → script sẽ gợi ý cài qua `winget` hoặc mở trang Node.js.
- Nếu muốn reset dependency → xóa thư mục `node_modules` rồi chạy lại script.

---

## Demo



---

## License

MIT © 2025

