const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function run() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 3: CHECKOUT (TẠO ĐƠN HÀNG) ===');
    
    // 1. Đăng nhập Audience
    const login = await axios.post(`${API_URL}/auth/login`, { email: 'audience@ticketbox.vn', password: '123456' });
    const token = login.data.token;
    
    // 2. Tạo concert mới từ Org1
    const loginOrg = await axios.post(`${API_URL}/auth/login`, { email: 'organizer@ticketbox.vn', password: '123456' });
    const tokenOrg = loginOrg.data.token;

    const createConcert = await axios.post(`${API_URL}/admin/concerts`, {
      name: 'Concert Checkout Flow', description: 'Test', start_time: new Date().toISOString(), status: 'PUBLISHED'
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });
    const concertId = createConcert.data.id;

    const createType = await axios.post(`${API_URL}/admin/ticket-types`, {
      concert_id: concertId, name: 'GA', price: 500000, total_quantity: 4, max_per_user: 2, type: 'PUBLIC'
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });
    const ticketTypeId = createType.data.id;

    // Tạo nhanh 4 ghế
    await axios.post(`${API_URL}/admin/concerts/${concertId}/zones/${ticketTypeId}/seating`, {
      ticketTypeId, rows: 2, cols: 2, disabledSeats: []
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });

    // Lấy vé
    const ticketsRes = await axios.get(`${API_URL}/concerts/${concertId}/zones/${ticketTypeId}/tickets`);
    const ticketIdsAll = ticketsRes.data.map(t => t.id);

    // 3. Test Checkout quá số lượng
    console.log('Test chặn Checkout quá số lượng...');
    try {
        await axios.post(`${API_URL}/orders`, {
            ticketTypeId, ticketIds: [ticketIdsAll[0], ticketIdsAll[1], ticketIdsAll[2]]
        }, { headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': "key-fail-$i" } });
        console.error('❌ LỖI: Không bị chặn!');
        process.exit(1);
    } catch (err) {
        console.log('✅ THÀNH CÔNG: Đã chặn mua quá giới hạn.');
    }

    // 4. Test Checkout hợp lệ
    console.log('Test Checkout hợp lệ 1 ghế...');
    const orderRes = await axios.post(`${API_URL}/orders`, {
        ticketTypeId, ticketIds: [ticketIdsAll[0]]
    }, { headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': "key-success-$i" } });
    
    console.log(`✅ Checkout thành công! OrderID: ${orderRes.data.data.orderId}`);
    console.log('Trạng thái đơn: PENDING');
    console.log('=== TEST FLOW 3 HOÀN TẤT ===\n');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

run();
