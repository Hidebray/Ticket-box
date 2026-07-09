const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testFlow4() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 4: CHECKOUT & WEBHOOK ===');
    
    // 1. Đăng nhập Audience
    const login = await axios.post(`${API_URL}/auth/login`, {
      email: 'audience@ticketbox.vn',
      password: '123456'
    });
    const token = login.data.token;
    
    // 2. Tạo concert mới để test độc lập
    const loginOrg = await axios.post(`${API_URL}/auth/login`, {
      email: 'org1@gmail.com', password: '123456'
    });
    const tokenOrg = loginOrg.data.token;

    const createConcert = await axios.post(`${API_URL}/admin/concerts`, {
      name: 'Concert Checkout Test',
      description: 'A test concert for checkout',
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

    // 3. Lấy danh sách vé
    const ticketsRes = await axios.get(`${API_URL}/concerts/${concertId}/zones/${ticketTypeId}/tickets`);
    const tickets = ticketsRes.data;
    const ticketIdsAll = tickets.map(t => t.id);

    // 4. Test Checkout quá số lượng (chọn 3 vé trong khi max là 2)
    console.log('Test Checkout 3 vé (giới hạn 2)...');
    try {
        await axios.post(`${API_URL}/orders`, {
            ticketTypeId,
            ticketIds: [ticketIdsAll[0], ticketIdsAll[1], ticketIdsAll[2]]
        }, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'Idempotency-Key': 'test-idem-key-1'
            }
        });
        console.error('❌ LỖI: Checkout quá số lượng không bị chặn!');
        process.exit(1);
    } catch (err) {
        console.log('✅ THÀNH CÔNG: Chặn checkout quá số lượng.');
        console.log('Lý do:', err.response?.data?.message || err.message);
    }

    // 5. Test Checkout hợp lệ (2 vé)
    console.log('Test Checkout 2 vé...');
    const orderRes = await axios.post(`${API_URL}/orders`, {
        ticketTypeId,
        ticketIds: [ticketIdsAll[0], ticketIdsAll[1]]
    }, {
        headers: { 
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': 'test-idem-key-2'
        }
    });
    
    const orderId = orderRes.data.data.orderId;
    console.log(`Checkout thành công! OrderID: ${orderId}`);

    // 6. Test Idempotency (Gửi lại request y hệt)
    console.log('Test Idempotency (Gửi trùng Idempotency-Key)...');
    const orderResIdem = await axios.post(`${API_URL}/orders`, {
        ticketTypeId,
        ticketIds: [ticketIdsAll[0], ticketIdsAll[1]]
    }, {
        headers: { 
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': 'test-idem-key-2'
        }
    });
    if (orderResIdem.data.data.orderId === orderId) {
        console.log('✅ THÀNH CÔNG: Trả về cùng OrderID (Idempotent).');
    }

    // 7. Gọi Webhook
    console.log('Gọi Mock Webhook SUCCESS...');
    await axios.post(`${API_URL}/webhooks/mock-payment`, {
        orderId,
        status: 'SUCCESS'
    });

    // 8. Xác minh trạng thái vé
    const finalOrder = await axios.get(`${API_URL}/orders/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const order = finalOrder.data.find(o => o.id === orderId);
    
    if (order.status === 'SUCCESS' && order.tickets[0].status === 'SOLD') {
        console.log('✅ THÀNH CÔNG: Giao dịch hoàn tất, vé chuyển sang SOLD.');
    } else {
        console.error('❌ LỖI: Trạng thái chưa cập nhật đúng.', order);
        process.exit(1);
    }

    console.log('=== TEST FLOW 4 HOÀN TẤT ===');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

testFlow4();
