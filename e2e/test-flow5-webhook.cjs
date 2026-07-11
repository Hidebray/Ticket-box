const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function run() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 5: THANH TOÁN & WEBHOOK ===');
    
    // 1. Setup Auth & Concert
    const login = await axios.post(`${API_URL}/auth/login`, { email: 'audience@ticketbox.vn', password: '123456' });
    const token = login.data.token;
    
    const loginOrg = await axios.post(`${API_URL}/auth/login`, { email: 'organizer@ticketbox.vn', password: '123456' });
    const tokenOrg = loginOrg.data.token;

    const createConcert = await axios.post(`${API_URL}/admin/concerts`, {
      name: 'Concert Webhook Test', description: 'Test', start_time: new Date().toISOString(), status: 'PUBLISHED'
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });
    const concertId = createConcert.data.id;

    const createType = await axios.post(`${API_URL}/admin/ticket-types`, {
      concert_id: concertId, name: 'GA', price: 500000, total_quantity: 4, max_per_user: 2, type: 'PUBLIC'
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });
    const ticketTypeId = createType.data.id;

    await axios.post(`${API_URL}/admin/concerts/${concertId}/zones/${ticketTypeId}/seating`, {
      ticketTypeId, rows: 2, cols: 2, disabledSeats: []
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });

    const ticketsRes = await axios.get(`${API_URL}/concerts/${concertId}/zones/${ticketTypeId}/tickets`);
    const targetTicketId = ticketsRes.data[0].id;

    // 2. Tạo đơn hàng PENDING
    const orderRes = await axios.post(`${API_URL}/orders`, {
        ticketTypeId, ticketIds: [targetTicketId]
    }, { headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': "webhook-key-$i" } });
    const orderId = orderRes.data.data.orderId;

    // 3. Gọi Webhook
    console.log('Gọi Webhook thanh toán SUCCESS...');
    await axios.post(`${API_URL}/webhooks/mock-payment`, { orderId, status: 'SUCCESS' });

    // 4. Xác minh
    console.log('Xác minh trạng thái vé...');
    const finalOrder = await axios.get(`${API_URL}/orders/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const order = finalOrder.data.find(o => o.id === orderId);
    
    if (order && order.status === 'SUCCESS' && order.tickets[0].status === 'SOLD') {
        console.log('✅ THÀNH CÔNG: Đơn hàng và Vé đã chuyển trạng thái thành công.');
    } else {
        console.error('❌ LỖI: Trạng thái không đúng.', order);
        process.exit(1);
    }

    console.log('=== TEST FLOW 5 HOÀN TẤT ===\n');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

run();
