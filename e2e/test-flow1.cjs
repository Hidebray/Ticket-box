const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testFlow1() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 1: MULTI-TENANT ===');
    
    // 1. Đăng nhập org1
    console.log('Đăng nhập org1...');
    const login1 = await axios.post(`${API_URL}/auth/login`, {
      email: 'org1@gmail.com',
      password: '123456'
    });
    const token1 = login1.data.token;
    console.log('Org1 đăng nhập thành công.');

    // 2. Tạo concert với org1
    console.log('Tạo Concert Org 1...');
    const createConcert = await axios.post(`${API_URL}/admin/concerts`, {
      name: 'Concert Org 1 (Test)',
      description: 'A test concert',
      start_time: new Date(Date.now() + 86400000).toISOString(),
      status: 'PUBLISHED'
    }, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const concertId = createConcert.data.id;
    console.log('Đã tạo Concert ID:', concertId);

    // 3. Đăng nhập org2
    console.log('Đăng nhập org2...');
    const login2 = await axios.post(`${API_URL}/auth/login`, {
      email: 'org2@gmail.com',
      password: '123456'
    });
    const token2 = login2.data.token;
    console.log('Org2 đăng nhập thành công.');

    // 4. Lấy danh sách concert của org2
    console.log('Lấy danh sách Concert của org2...');
    const list2 = await axios.get(`${API_URL}/admin/concerts`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    const found = list2.data.find(c => c.id === concertId);
    if (found) {
      console.error('❌ LỖI NGHIÊM TRỌNG: org2 nhìn thấy concert của org1!');
      process.exit(1);
    } else {
      console.log('✅ THÀNH CÔNG: org2 KHÔNG nhìn thấy concert của org1.');
    }
    
    console.log('=== TEST FLOW 1 HOÀN TẤT ===');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

testFlow1();
