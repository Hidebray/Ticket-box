const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testFlow2() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 2: MAP BUILDER & CONCURRENCY ===');
    
    // 1. Đăng nhập org1
    const login1 = await axios.post(`${API_URL}/auth/login`, {
      email: 'org1@gmail.com',
      password: '123456'
    });
    const token1 = login1.data.token;
    
    // 2. Tạo concert với org1
    console.log('Tạo Concert...');
    const createConcert = await axios.post(`${API_URL}/admin/concerts`, {
      name: 'Concert Map Test',
      description: 'A test concert for map',
      start_time: new Date(Date.now() + 86400000).toISOString(),
      status: 'PUBLISHED'
    }, { headers: { Authorization: `Bearer ${token1}` } });
    const concertId = createConcert.data.id;

    // 3. Tạo Ticket Type
    console.log('Tạo Ticket Type...');
    const createTicketType = await axios.post(`${API_URL}/admin/ticket-types`, {
      concert_id: concertId,
      name: 'VIP',
      price: 1000000,
      total_quantity: 4,
      max_per_user: 2
    }, { headers: { Authorization: `Bearer ${token1}` } });
    const ticketTypeId = createTicketType.data.id;

    // 4. Gọi API Seating Map
    console.log('Lưu sơ đồ ghế (2x2)...');
    const saveMapRes = await axios.post(`${API_URL}/admin/concerts/${concertId}/zones/${ticketTypeId}/seating`, {
      rows: 2,
      cols: 2,
      disabledSeats: []
    }, { headers: { Authorization: `Bearer ${token1}` } });
    
    console.log('Kết quả lưu sơ đồ:', saveMapRes.data);
    
    // 5. Kiểm tra Tickets được tạo
    const ticketsList = await axios.get(`${API_URL}/concerts/${concertId}/zones/${ticketTypeId}/tickets`);
    const tickets = ticketsList.data;
    if (tickets.length === 4 && tickets.every(t => t.status === 'AVAILABLE')) {
      console.log('✅ THÀNH CÔNG: Sơ đồ ghế đã tạo chính xác 4 ghế AVAILABLE.');
      console.log('Ghế:', tickets.map(t => t.seat_label).join(', '));
    } else {
      console.error('❌ LỖI: Sơ đồ ghế tạo sai số lượng hoặc trạng thái.', tickets);
      process.exit(1);
    }
    
    console.log('=== TEST FLOW 2 HOÀN TẤT ===');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

testFlow2();
