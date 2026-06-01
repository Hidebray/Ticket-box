# Đặc tả: Luồng thanh toán và Chống trùng lặp

## Mô tả
Luồng xử lý mua vé của khán giả từ lúc chọn vé đến khi thanh toán thành công và nhận e-ticket. Đặc tả này tập trung giải quyết 2 bài toán lớn dưới tải cao: tranh chấp vé (Race Condition) và trừ tiền 2 lần (Double Charge).

## Luồng chính
1. **Khởi tạo Request & Idempotency-Key:** 
   - Người dùng bấm "Thanh toán". Client gửi danh sách giỏ hàng lên.
   - Thay vì để Client sinh UUID ngẫu nhiên (sẽ mất tác dụng khi reload trang), Backend sẽ tạo ra một mã băm xác định (deterministic hash) dựa trên `[UserID + ConcertID + CartHash]` làm `Idempotency-Key`.
2. **Kiểm tra Idempotency:**
   - Backend dùng Redis (SetNX) với key `idem:{Idempotency-Key}`.
   - Nếu đã tồn tại key và có kết quả: Trả về HTTP 200 (hoặc 409 tùy trạng thái). Dừng luồng.
   - Nếu chưa tồn tại: Set key = `processing` với TTL 5 phút.
3. **Giữ vé (Reserve Ticket) qua Lệnh Nguyên Tử (Atomic DECR):**
   - Thay vì dùng Distributed Lock (gây thắt cổ chai), Backend sử dụng lệnh `DECR` nguyên tử trên Redis đối với số lượng vé của `TicketType` (ví dụ: `DECR ticket_count:123`).
   - Nếu kết quả `>= 0`: Cho phép người dùng đi tiếp.
   - Nếu kết quả `< 0`: Lập tức trả lỗi hết vé, và dùng lệnh `INCR` cộng bù lại 1 vé để cân bằng. Cập nhật `Idempotency-Key` = `failed`.
   - Lưu Order (trạng thái `PENDING`) và Insert Tickets (trạng thái `RESERVED`) vào PostgreSQL. Nhờ **SQL constraints**, DB sẽ block nếu user mua quá giới hạn dù vượt qua được vòng kiểm tra Redis.
4. **Gọi Cổng Thanh Toán:**
   - Backend gọi API VNPAY/MoMo để lấy Redirect URL.
   - (Có bọc qua Circuit Breaker để tránh kẹt hệ thống nếu VNPAY sập).
   - Trả Redirect URL cho Client. Cập nhật `Idempotency-Key` = `completed` cùng dữ liệu URL này.
5. **Xử lý Webhook Thanh Toán:**
   - Cổng thanh toán gọi Webhook báo thành công.
   - Update Order = `SUCCESS`, Tickets = `AVAILABLE` (chính thức sở hữu).
   - Bắn event vào RabbitMQ/Redis PubSub để hệ thống Worker sinh QR Code và gửi Email/Notification.

## Kịch bản lỗi
- **Khán giả Spam Click hoặc Reload trang (F5):** Dù tải lại trang thì `UserID + ConcertID + CartHash` vẫn không đổi, tạo ra `Idempotency-Key` trùng khớp. Request thứ 2 sẽ bị chặn lại ở bước 2 mà không sinh lỗi nhân bản.
- **Rớt mạng khi đang chờ thanh toán:** Khán giả tải lại trang, sinh ra request mới trùng Idempotency-Key. Nếu cố tình sửa giỏ hàng để tạo key mới, DB Constraint (giới hạn số vé/user) sẽ chốt chặn cuối cùng nếu Order cũ đang giữ vé.
- **Thanh toán Timeout (Webhook không về):** Cronjob (mỗi 5 phút) quét các Order `PENDING` quá 15 phút. Gọi API kiểm tra chéo trạng thái giao dịch với VNPAY. Nếu VNPAY báo fail hoặc không có -> Cancel Order, release vé bằng `INCR` trong Redis và nhả vé DB để người khác mua.

## Ràng buộc
- Thời gian giữ vé (Reservation TTL): Tối đa 15 phút. Qua 15 phút không thanh toán sẽ hủy giữ vé.
- Cột mốc chặn cuối cùng là Database. Các Trigger/Constraints trong SQL đảm bảo không bao giờ có user vượt hạn mức vé.

## Tiêu chí chấp nhận
- Không user nào mua được quá số lượng quy định (bị chặn 100% bằng SQL Exception).
- Không có 2 vé nào được issue cho cùng 1 slot (oversell). Lệnh DECR trong Redis xử lý mượt mà hàng vạn request mỗi giây.
- Khi người dùng reload hoặc ấn F5 liên tục tại bước thanh toán, hệ thống chỉ tạo 1 đơn hàng duy nhất nhờ deterministic hash.
