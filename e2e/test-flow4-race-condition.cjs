const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function run() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 4: RACE CONDITION & IDEMPOTENCY ===');
    
    // 1. Setup Auth & Concert
    const login = await axios.post(`${API_URL}/auth/login`, { email: 'audience@ticketbox.vn', password: '123456' });
    const token = login.data.token;
    
    const loginOrg = await axios.post(`${API_URL}/auth/login`, { email: 'organizer@ticketbox.vn', password: '123456' });
    const tokenOrg = loginOrg.data.token;

    const createConcert = await axios.post(`${API_URL}/admin/concerts`, {
      name: 'Concert Race Test', description: 'Test', start_time: new Date().toISOString(), status: 'PUBLISHED'
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

    // 2. Test Idempotency (Gửi 2 request với cùng Idempotency-Key liên tiếp)
    console.log('Test Idempotency (Gửi lặp lại cùng Idempotency-Key)...');
    const order1 = await axios.post(`${API_URL}/orders`, {
        ticketTypeId, ticketIds: [targetTicketId]
    }, { headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': "race-key-$i" } });
    
    const order2 = await axios.post(`${API_URL}/orders`, {
        ticketTypeId, ticketIds: [targetTicketId]
    }, { headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': "race-key-$i" } });

    if (order1.data.data.orderId === order2.data.data.orderId) {
        console.log('✅ THÀNH CÔNG: Cơ chế Idempotency hoạt động, 2 request trả về cùng 1 OrderID.');
    } else {
        console.error('❌ LỖI: Idempotency thất bại, tạo ra 2 OrderID khác nhau!');
        process.exit(1);
    }

    console.log('=== TEST FLOW 4 HOÀN TẤT ===\n');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

run();
