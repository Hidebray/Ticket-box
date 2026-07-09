const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testFlow5() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 5: OFFLINE CHECK-IN ===');
    
    // 1. Đăng nhập Staff
    const loginStaff = await axios.post(`${API_URL}/auth/login`, {
        email: 'staff1@ticketbox.vn', password: '123456'
    });
    const staffToken = loginStaff.data.token;
    console.log('Đăng nhập Staff thành công.');

    // 2. Tìm một vé đang ở trạng thái SOLD
    const loginAud = await axios.post(`${API_URL}/auth/login`, {
        email: 'audience@ticketbox.vn', password: '123456'
    });
    const audToken = loginAud.data.token;
    
    const myTickets = await axios.get(`${API_URL}/orders/my-tickets`, {
        headers: { Authorization: `Bearer ${audToken}` }
    });
    
    const soldOrder = myTickets.data.find(o => o.status === 'SUCCESS' && o.tickets.length > 0);
    if (!soldOrder) {
        console.error('❌ Không tìm thấy vé SOLD nào để test check-in.');
        process.exit(1);
    }
    
    const ticketToScan = soldOrder.tickets[0];
    const concertId = ticketToScan.ticket_types.concerts.id;
    const qrCode = ticketToScan.qr_code;
    
    console.log(`Tìm thấy vé SOLD: ${ticketToScan.seat_label}, ConcertID: ${concertId}`);

    // 3. Sync Down
    console.log('Gọi Sync Down API...');
    const syncDown = await axios.get(`${API_URL}/checkin/sync-down?concertId=${concertId}`, {
        headers: { Authorization: `Bearer ${staffToken}` }
    });
    
    const localDbSimulation = syncDown.data.data;
    const foundTicket = localDbSimulation.find(t => t.qr_code === qrCode);
    if (foundTicket && foundTicket.status === 'SOLD') {
        console.log('✅ THÀNH CÔNG: Vé có trong danh sách Sync Down và hợp lệ.');
    } else {
        console.error('❌ LỖI: Vé không hợp lệ trong bản Sync Down.', foundTicket);
        process.exit(1);
    }

    // 4. Quét vé Offline (Sync Up)
    console.log('Tiến hành quét vé và Sync Up...');
    const scanTime = new Date().toISOString();
    const syncUp = await axios.post(`${API_URL}/checkin/sync-up`, {
        scannedTickets: [
            { ticketId: ticketToScan.id, scannedAt: scanTime }
        ]
    }, {
        headers: { Authorization: `Bearer ${staffToken}` }
    });
    console.log('Kết quả Sync Up:', syncUp.data.results);

    // 5. Kiểm tra lại trạng thái
    const finalCheck = await axios.get(`${API_URL}/orders/my-tickets`, {
        headers: { Authorization: `Bearer ${audToken}` }
    });
    const finalOrder = finalCheck.data.find(o => o.id === soldOrder.id);
    const finalTicket = finalOrder.tickets.find(t => t.id === ticketToScan.id);
    
    if (finalTicket.status === 'CHECKED_IN') {
        console.log('✅ THÀNH CÔNG: Trạng thái vé trên hệ thống đã chuyển thành CHECKED_IN.');
    } else {
        console.error('❌ LỖI: Vé chưa chuyển trạng thái.', finalTicket.status);
    }
    
    console.log('=== TEST FLOW 5 HOÀN TẤT ===');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

testFlow5();
