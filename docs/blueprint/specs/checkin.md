# Đặc tả: Luồng Soát vé Offline

## Mô tả
Đảm bảo nhân sự có thể quét QR code soát vé vào cổng ngay cả khi sân vận động bị mất kết nối Internet (sóng yếu do đông người). Dữ liệu soát vé không bị mất và được đồng bộ chính xác khi có mạng.

## Luồng chính
1. **Tải Dữ Liệu Ban Đầu (Sync Down):**
   - Trước sự kiện (khi có Wifi), Mobile App gọi API tải toàn bộ danh sách vé hợp lệ (`TicketID`, `Hash`, `Status`) và lưu vào Local DB (ví dụ: SQLite hoặc WatermelonDB) trên điện thoại.
2. **Quét Vé (Offline):**
   - App quét QR code lấy `TicketID`.
   - Tìm trong Local DB. Nếu `Status` = `AVAILABLE` -> Cập nhật thành `CHECKED_IN` kèm `Timestamp` và `ScannedBy` (ID nhân viên).
   - Báo xanh (Thành công).
   - Lưu bản ghi thay đổi này vào một bảng hàng đợi `SyncQueue` tại local.
3. **Đồng Bộ Dữ Liệu (Sync Up):**
   - App thiết lập một Background Service theo dõi Network State.
   - Khi có Internet, đọc các bản ghi trong `SyncQueue` và gửi Batch Update (danh sách TicketID và thời gian quét) lên Backend API.
   - Backend xác nhận và cập nhật Database chính (PostgreSQL).
   - App nhận phản hồi thành công -> Xóa các bản ghi đã đồng bộ khỏi `SyncQueue`.

## Kịch bản lỗi
- **Vé giả / Vé đã quét (Double Scan):** Nếu vé không có trong Local DB hoặc Local DB báo `Status` = `CHECKED_IN` -> App báo đỏ ngay lập tức, chặn khán giả.
- **Xung đột khi nhiều người quét (Conflict):** Giả sử 2 cửa (nhân viên A và B) vô tình đều quét 1 mã vé giả mạo giống nhau tại cùng 1 thời điểm (khi cả 2 đang offline):
  - Khi Sync Up lên Backend, Backend sử dụng chiến lược **First-Write-Wins** (Dựa trên Timestamp quét).
  - Bản ghi nào quét trước sẽ được ghi nhận hợp lệ. Bản ghi sau sẽ bị flag là `FRAUD_ATTEMPT` (gian lận) và cảnh báo trên Dashboard. Tuy nhiên khán giả đã vào trong (rủi ro chấp nhận được ở môi trường offline).
- **Mất điện thoại / Crash App:** Dữ liệu nằm trong Local DB SQLite (persistent). Khi mở lại app, tiến trình Sync Up tiếp tục tự động.

## Ràng buộc
- QR Code trên e-ticket phải được mã hóa chéo (Signed) hoặc chứa HMAC hash để không thể tự chế mã QR random. App phải verify chữ ký này trước cả khi check DB.
- Kích thước payload tải dữ liệu ban đầu phải được tối ưu (chỉ lấy field cần thiết) để không treo máy khi concert có 50.000 vé.

## Tiêu chí chấp nhận
- App có thể quét và ghi nhận vé mượt mà ở chế độ máy bay (Airplane mode).
- Dữ liệu quét vé được đẩy lên Server đầy đủ và chính xác 100% ngay khi bật mạng lại.
