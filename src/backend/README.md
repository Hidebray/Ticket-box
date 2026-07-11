# TicketBox Backend

## Khởi động & Deploy (Deployment Guide)

> [!IMPORTANT]  
> **Thứ tự khởi động bắt buộc:**
> **Redis phải được chạy lên TRƯỚC TIÊN.** Nếu Redis chưa hoạt động, cả Web API Server (Express) lẫn Background Worker sẽ crash ngay lập tức khi khởi động do không thể thiết lập cache / queue.

### 1. Yêu cầu Biến Môi Trường (Environment Variables)

Hệ thống yêu cầu các biến môi trường cấu hình Database Pool một cách nghiêm ngặt nhằm tránh cạn kiệt kết nối (Connection Exhaustion). Cần điền đầy đủ vào file `.env`:

```env
# Dành cho Web API Server (Express) - Giới hạn tối đa 15 kết nối
DATABASE_URL="postgresql://user:pass@host:5433/ticketbox_db?schema=public&connection_limit=15"

# [BẮT BUỘC] Dành cho Background Worker - Giới hạn tối đa 10 kết nối
DATABASE_URL_WORKER="postgresql://user:pass@host:5433/ticketbox_db?schema=public&connection_limit=10"
```

> **Lưu ý:** Tiến trình Worker (`worker.server.ts`) sẽ **từ chối khởi động (fail-fast)** nếu không tìm thấy biến `DATABASE_URL_WORKER`. Bạn không được dùng chung biến `DATABASE_URL` cho 2 process mà không giới hạn lại connection_limit.

### 2. Cập nhật Database Schema & Index

Mỗi khi deploy phiên bản mới có thay đổi về schema hoặc bổ sung các compound indexes (như index hỗ trợ Worker hay Dashboard):

```bash
cd src/backend
npx prisma migrate deploy
```

> Tránh dùng `npx prisma db push` trên production. Hãy dùng `migrate deploy` để giữ nguyên lịch sử kiểm toán của DB.

### 3. Lệnh khởi động

- **API Server:** `npm run start` (chạy trên port 3001 mặc định)
- **Background Worker:** `npm run start:worker` (Xử lý hàng đợi BullMQ, hủy vé quá hạn, gửi email)
