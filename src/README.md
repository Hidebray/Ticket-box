# Ticket Box - Hệ thống Bán Vé Sự Kiện Tốc Độ Cao

Hệ thống bán vé sự kiện toàn diện với kiến trúc Multi-tenant (nhiều Ban tổ chức), hỗ trợ tính năng chọn ghế chính xác (Sơ đồ ghế động) và khả năng chịu tải cực cao (Chống Overselling bằng Row-Level Locking và Redis Rate-Limiting).

## 🚀 1. Yêu cầu Hệ thống

Để khởi chạy dự án, máy tính của bạn cần cài đặt các công cụ sau:
- **Node.js**: Phiên bản v18.x trở lên.
- **PostgreSQL**: Phiên bản 13+ (Hoặc dùng Docker).
- **Redis**: Phục vụ Caching và Rate Limiting (Hoặc dùng Docker).
- **Docker & Docker Compose** (Tùy chọn nhưng khuyên dùng để chạy DB và Redis nhanh chóng).

---

## 🛠️ 2. Cài đặt & Khởi chạy (Setup & Build)

### Bước 2.1: Khởi động Database & Redis bằng Docker
Mở Terminal ở thư mục gốc của dự án (`Ticket_box_2`) và chạy:
```bash
docker-compose up -d
```
Lệnh này sẽ tải và chạy PostgreSQL (cổng `5432`) và Redis (cổng `6379`) ở chế độ ngầm.

### Bước 2.2: Khởi tạo Database Schema
Bạn cần chạy file `init.sql` nằm trong thư mục `data/` vào database `ticketbox_db`.
*Lưu ý: File `init.sql` chứa các Store Procedure và Trigger để ngăn chặn Overselling.*

### Bước 2.3: Thiết lập & Chạy Backend
Mở một Terminal mới và di chuyển vào thư mục `src/backend`:
```bash
cd src/backend
npm install
```

Tạo file `.env` trong thư mục `src/backend` với nội dung:
```env
PORT=3001
DATABASE_URL="postgresql://ticketuser:ticketpass@localhost:5432/ticketbox_db?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="YOUR_SUPER_SECRET_KEY"
FRONTEND_URL="http://localhost:5173"
```

Khởi tạo Prisma Client và chạy Seed (Tạo dữ liệu mẫu):
```bash
npx prisma generate
npx prisma db seed
```

Khởi chạy Server Backend:
```bash
npm run dev
```

### Bước 2.4: Thiết lập & Chạy Frontend
Mở một Terminal khác và di chuyển vào thư mục `src/frontend`:
```bash
cd src/frontend
npm install
npm run dev
```
Truy cập vào `http://localhost:5173` để mở ứng dụng web.

---

## 🧪 3. Các Kịch Bản Kiểm Thử Quan Trọng (Testing Scenarios)

Hệ thống được thiết kế chặt chẽ với nhiều Role. Dưới đây là các kịch bản test để đảm bảo mọi tính năng cốt lõi đều hoạt động.

### Kịch bản 1: Phân quyền Super Admin & Ban Tổ Chức (Organizer)
- **Mục tiêu**: Kiểm tra tính phân tách dữ liệu (Multi-tenant) giữa các Ban tổ chức.
- **Thực hiện**:
  1. Đăng nhập bằng tài khoản Super Admin mặc định: `admin@ticketbox.com` / `admin123`.
  2. Tạo 2 tài khoản có role `ORGANIZER` (Ví dụ: `org1@gmail.com` và `org2@gmail.com`).
  3. Đăng nhập `org1@gmail.com` và tạo một sự kiện tên "Concert Org 1".
  4. Đăng nhập `org2@gmail.com` và kiểm tra Dashboard. Bạn sẽ **KHÔNG** nhìn thấy "Concert Org 1".

### Kịch bản 2: Thiết lập Sơ đồ Ghế Động (Seating Map Builder)
- **Mục tiêu**: Đảm bảo Ban tổ chức có thể vẽ sơ đồ nhà hát và lưu xuống database với kỹ thuật Batch Insert.
- **Thực hiện**:
  1. Ở trang Quản lý Sự kiện (Admin), thêm 1 loại vé mới (VD: "VIP").
  2. Bấm vào biểu tượng 🗺️ (Sơ đồ) bên cạnh hạng vé vừa tạo.
  3. Tuỳ chỉnh Số hàng x Số ghế (Ví dụ 5x10).
  4. Click vào một số ghế để "Disable" (Giả lập lối đi hoặc góc khuyết của khán đài).
  5. Bấm **Lưu sơ đồ**. Backend sẽ tạo ra số lượng vé (status: `AVAILABLE`) bằng đúng số ghế có hiệu lực.

### Kịch bản 3: Luồng Đặt Vé Khán Giả (Drill-down Map & Checkout)
- **Mục tiêu**: Kiểm tra luồng UI cho khán giả chọn ghế và khóa ghế.
- **Thực hiện**:
  1. Đăng nhập bằng tài khoản khán giả thông thường (`AUDIENCE`).
  2. Vào xem chi tiết sự kiện đã tạo Sơ đồ ghế ở Kịch bản 2.
  3. Chọn hạng vé VIP bên phải -> Sơ đồ ghế sẽ hiện ra bên trái.
  4. Click chọn các ghế (chú ý số lượng chọn tối đa `max_per_user`).
  5. Bấm "Thanh toán". Sang trang Checkout thành công.

### Kịch bản 4: Chống Chồng Lấn (Race Condition & Idempotency)
- **Mục tiêu**: Hệ thống không bao giờ bị tình trạng 2 người mua cùng 1 ghế hoặc Spam Click tạo 2 đơn hàng.
- **Thực hiện**:
  1. Mở 2 trình duyệt ẩn danh độc lập, đăng nhập 2 tài khoản Khán giả khác nhau.
  2. Cùng vào xem sơ đồ ghế của 1 sự kiện.
  3. Cùng click chọn **chung 1 ghế** (Ví dụ ghế `A5`).
  4. Bấm "Thanh toán" gần như cùng 1 lúc ở 2 trình duyệt.
  5. **Kết quả mong đợi**: Trình duyệt nào request tới Backend trước sẽ qua trang Checkout thành công. Trình duyệt còn lại sẽ báo lỗi "Ghế đã có người đặt".

### Kịch bản 5: Thanh toán & Nhận vé
- **Mục tiêu**: Mô phỏng Webhook của Cổng thanh toán (VNPAY/MoMo).
- **Thực hiện**:
  1. Ở trang Checkout (Đếm ngược 15 phút), bấm "Thanh toán qua VNPAY".
  2. Frontend sẽ gửi request mô phỏng Webhook gọi về Backend sau 2 giây.
  3. Hệ thống Polling sẽ phát hiện đơn hàng chuyển trạng thái `SUCCESS` và tự động chuyển hướng về trang Ví Vé (Dashboard).
  4. Khán giả nhìn thấy các vé (kèm Mã QR và Số Ghế `seat_label`).

### Kịch bản 6: Soát Vé (Check-in Staff)
- **Mục tiêu**: Quét mã QR tại cổng bảo vệ.
- **Thực hiện**:
  1. Đăng nhập bằng tài khoản có role `STAFF`.
  2. Vào màn hình Check-in.
  3. Nhập chuỗi mã QR của một vé `SUCCESS` vào ô quét.
  4. Kết quả báo "Hợp lệ xanh rực". Quét lại mã đó lần thứ 2, hệ thống phải báo Đỏ "Vé đã được sử dụng".
