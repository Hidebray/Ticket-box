const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testFlow3() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 3: SEAT HOLDING & SSE ===');
    
    // 1. Đăng nhập Audience
    const login = await axios.post(`${API_URL}/auth/login`, {
      email: 'audience@ticketbox.vn',
      password: '123456'
    });
    const token = login.data.token;
    
    // 1.5 Đăng nhập org1 để tạo concert
    const loginOrg = await axios.post(`${API_URL}/auth/login`, {
      email: 'org1@gmail.com',
      password: '123456'
    });
    const tokenOrg = loginOrg.data.token;

    const createConcert = await axios.post(`${API_URL}/admin/concerts`, {
      name: 'Concert Map Test 3',
      description: 'A test concert for hold',
      start_time: new Date(Date.now() + 86400000).toISOString(),
      status: 'PUBLISHED'
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });
    const concertId = createConcert.data.id;

    const createTicketType = await axios.post(`${API_URL}/admin/ticket-types`, {
      concert_id: concertId,
      name: 'VIP',
      price: 1000000,
      total_quantity: 4,
      max_per_user: 2
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });
    const ticketTypeId = createTicketType.data.id;

    await axios.post(`${API_URL}/admin/concerts/${concertId}/zones/${ticketTypeId}/seating`, {
      rows: 2, cols: 2, disabledSeats: []
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });

    // 3. Lấy danh sách vé bằng token Audience
    const tickets = await axios.get(`${API_URL}/concerts/${concertId}/zones/${ticketTypeId}/tickets`);
    const ticketId = tickets.data[0].id; // Lấy vé đầu tiên (ví dụ A1)
    console.log(`Tiến hành giữ ghế: ${tickets.data[0].seat_label}`);

    // 4. Hold Seat
    console.log('Gọi API Hold Seat lần 1...');
    const hold1 = await axios.post(`${API_URL}/concerts/${concertId}/zones/${ticketTypeId}/tickets/${ticketId}/hold`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Kết quả:', hold1.data.message);

    // 5. Thử Hold Seat Lần 2 (mong đợi thất bại)
    console.log('Gọi API Hold Seat lần 2 (cùng ghế)...');
    try {
        await axios.post(`${API_URL}/concerts/${concertId}/zones/${ticketTypeId}/tickets/${ticketId}/hold`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.error('❌ LỖI: Lần 2 vẫn giữ được ghế dù đã bị khóa!');
        process.exit(1);
    } catch (err) {
        if (err.response && err.response.status === 409) {
            console.log('✅ THÀNH CÔNG: Hệ thống từ chối giữ ghế lần 2 (409 Conflict).');
        } else {
            console.error('Lỗi không mong muốn:', err.message);
        }
    }

    // 6. Unhold Seat
    console.log('Gọi API Unhold Seat...');
    const unhold = await axios.post(`${API_URL}/concerts/${concertId}/zones/${ticketTypeId}/tickets/${ticketId}/unhold`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Kết quả:', unhold.data.message);

    console.log('=== TEST FLOW 3 HOÀN TẤT ===');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

testFlow3();
