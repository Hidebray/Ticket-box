const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function run() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 2: MAP BUILDER (BATCH INSERT) ===');
    
    // 1. Đăng nhập org1
    const login = await axios.post(`${API_URL}/auth/login`, { email: 'organizer@ticketbox.vn', password: '123456' });
    const token = login.data.token;
    
    // 2. Tạo concert mới
    const createConcert = await axios.post(`${API_URL}/admin/concerts`, {
      name: 'Concert for Map', description: 'Test', start_time: new Date().toISOString(), status: 'DRAFT'
    }, { headers: { Authorization: `Bearer ${token}` } });
    const concertId = createConcert.data.id;

    // 3. Tạo ticket type
    const createType = await axios.post(`${API_URL}/admin/ticket-types`, {
      concert_id: concertId, name: 'VIP', total_quantity: 0, price: 1000, max_per_user: 2, type: 'PUBLIC'
    }, { headers: { Authorization: `Bearer ${token}` } });
    const typeId = createType.data.id;

    // 4. Gọi API Map Builder (Lưu 5 ghế)
    console.log('Đang lưu sơ đồ 5 ghế...');
    const seats = [
        { label: 'A1', status: 'AVAILABLE' },
        { label: 'A2', status: 'AVAILABLE' },
        { label: 'A3', status: 'AVAILABLE' },
        { label: 'B1', status: 'DISABLED' },
        { label: 'B2', status: 'AVAILABLE' }
    ];

    const saveMap = await axios.post(`${API_URL}/admin/concerts/${concertId}/zones/${typeId}/seating`, {
        rows: 2, cols: 2, disabledSeats: []
    }, { headers: { Authorization: `Bearer ${token}` } });

    console.log('✅ THÀNH CÔNG: Đã lưu sơ đồ ghế.');
    console.log('Số ghế tạo thành công:', saveMap.data.createdCount);
    
    console.log('=== TEST FLOW 2 HOÀN TẤT ===\n');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

run();
