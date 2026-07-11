const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function run() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 7: RATE LIMITING & CHỐNG SPAM ===');
    
    // 1. Đăng nhập Audience
    const login = await axios.post(`${API_URL}/auth/login`, { email: 'audience@ticketbox.vn', password: '123456' });
    const token = login.data.token;
    
    // 2. Gọi liên tục API (VD: API Checkout) 6 lần trong 1 giây để test Rate Limit (5 req/phút)
    console.log('Đang bắn 6 request liên tục vào API Checkout...');
    let successCount = 0;
    let rateLimitHit = false;

    for (let i = 0; i < 6; i++) {
        try {
            await axios.post(`${API_URL}/orders`, {
                ticketTypeId: 'fake-id', ticketIds: ['fake-ticket']
            }, { headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': `spam-key-${i}` } });
            successCount++;
        } catch (err) {
            if (err.response && err.response.status === 429) {
                rateLimitHit = true;
                console.log(`Request thứ ${i+1}: Đã bị chặn bởi Rate Limiter (429 Too Many Requests)`);
                break;
            } else {
                // Ignore 404/400 (b/c fake-id)
            }
        }
    }

    if (rateLimitHit) {
        console.log('✅ THÀNH CÔNG: Cơ chế Rate Limiting chống Bot Spam hoạt động hoàn hảo.');
    } else {
        console.error('❌ LỖI: Bắn 6 request nhưng không bị Rate Limit chặn!');
    }

    console.log('=== TEST FLOW 7 HOÀN TẤT ===\n');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

run();
