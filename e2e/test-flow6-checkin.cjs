const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function run() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 6: SOÁT VÉ (CHECK-IN) ===');
    
    // 1. Đăng nhập Staff
    const loginStaff = await axios.post(`${API_URL}/auth/login`, { email: 'staff@ticketbox.vn', password: '123456' });
    const staffToken = loginStaff.data.token;
    
    // 2. Tìm một vé đang ở trạng thái SOLD
    const loginAud = await axios.post(`${API_URL}/auth/login`, { email: 'audience@ticketbox.vn', password: '123456' });
    const audToken = loginAud.data.token;
    
    const myTickets = await axios.get(`${API_URL}/orders/my-tickets`, { headers: { Authorization: `Bearer ${audToken}` } });
    const soldOrder = myTickets.data.find(o => o.status === 'SUCCESS' && o.tickets.length > 0 && o.tickets[0].status === 'SOLD');
    
    if (!soldOrder) {
        console.error('❌ CẢNH BÁO: Không tìm thấy vé SOLD nào để test check-in. Vui lòng chạy Flow 5 trước.');
        process.exit(1);
    }
    
    const ticketToScan = soldOrder.tickets[0];
    const concertId = ticketToScan.ticket_types.concerts.id;
    const qrCode = ticketToScan.qr_code;
    
    console.log(`Tìm thấy vé SOLD: ${ticketToScan.seat_label}, ConcertID: ${concertId}`);

    // 3. Quét vé
    console.log('Tiến hành quét vé (Sync Up)...');
    const scanTime = new Date().toISOString();
    const syncUp = await axios.post(`${API_URL}/checkin/sync-up`, {
        scannedTickets: [{ ticketId: ticketToScan.id, scannedAt: scanTime }]
    }, { headers: { Authorization: `Bearer ${staffToken}` } });
    
    if (syncUp.data.results[0].status === 'success') {
        console.log('✅ THÀNH CÔNG: Quét vé hợp lệ lần 1.');
    }

    // 4. Quét lại vé đó lần 2 (Test Double Check-in)
    console.log('Tiến hành quét lại vé đó lần 2 (Double Check-in)...');
    const syncUp2 = await axios.post(`${API_URL}/checkin/sync-up`, {
        scannedTickets: [{ ticketId: ticketToScan.id, scannedAt: new Date().toISOString() }]
    }, { headers: { Authorization: `Bearer ${staffToken}` } });
    
    if (syncUp2.data.results[0].status === 'DUPLICATE_REJECTED') {
        console.log('✅ THÀNH CÔNG: Hệ thống báo Đỏ "Vé đã được sử dụng" (DUPLICATE_REJECTED).');
    } else {
        console.error('❌ LỖI: Hệ thống không bắt được lỗi Double Check-in!');
        process.exit(1);
    }

    console.log('=== TEST FLOW 6 HOÀN TẤT ===\n');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

run();
