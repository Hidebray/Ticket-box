const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api';

async function run() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 8: BACKGROUND WORKER (IMPORT VIP CSV) ===');
    
    // 1. Setup Auth & Concert
    const loginOrg = await axios.post(`${API_URL}/auth/login`, { email: 'organizer@ticketbox.vn', password: '123456' });
    const tokenOrg = loginOrg.data.token;

    const createConcert = await axios.post(`${API_URL}/admin/concerts`, {
      name: 'Concert VIP Import Test', description: 'Test CSV', start_time: new Date().toISOString(), status: 'PUBLISHED'
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });
    const concertId = createConcert.data.id;

    // 2. Upload CSV
    console.log('Upload file guests.csv...');
    const formData = new FormData();
    const csvPath = path.join(__dirname, 'guests.csv');
    
    // Nếu chưa có file guests.csv, tạo giả 1 file
    if (!fs.existsSync(csvPath)) {
        fs.writeFileSync(csvPath, 'email\nvip1@test.com\nvip2@test.com\nvip3@test.com\n');
    }

    formData.append('file', fs.createReadStream(csvPath));
    formData.append('concertId', concertId);

    const uploadRes = await axios.post(`${API_URL}/admin/guests/upload`, formData, {
        headers: { 
            Authorization: `Bearer ${tokenOrg}`,
            ...formData.getHeaders()
        }
    });

    const jobId = uploadRes.data.jobId;
    console.log(`✅ Upload thành công. Đã nhận JobID: ${jobId}`);

    // 3. Polling API
    console.log('Bắt đầu vòng lặp kiểm tra tiến trình (Polling)...');
    let isDone = false;
    while (!isDone) {
        const progressRes = await axios.get(`${API_URL}/admin/guests/progress/${jobId}`, {
            headers: { Authorization: `Bearer ${tokenOrg}` }
        });
        
        const state = progressRes.data.state;
        const progress = progressRes.data.progress;
        
        console.log(`Tiến trình: ${progress}% (Trạng thái: ${state})`);
        
        if (state === 'completed' || state === 'failed') {
            isDone = true;
            if (state === 'completed') {
                console.log('✅ THÀNH CÔNG: BullMQ Worker đã xử lý xong file CSV ngầm.');
            } else {
                console.error('❌ LỖI: BullMQ xử lý thất bại!');
                process.exit(1);
            }
        }
        
        // Nghỉ 1 giây rồi check lại
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('=== TEST FLOW 8 HOÀN TẤT ===\n');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

run();
