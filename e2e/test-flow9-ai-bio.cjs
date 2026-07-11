const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api';

async function run() {
  try {
    console.log('=== BẮT ĐẦU TEST FLOW 9: TÍCH HỢP AI GEMINI (TẠO BIO) ===');
    
    // 1. Setup Auth & Concert
    const loginOrg = await axios.post(`${API_URL}/auth/login`, { email: 'organizer@ticketbox.vn', password: '123456' });
    const tokenOrg = loginOrg.data.token;

    const createConcert = await axios.post(`${API_URL}/admin/concerts`, {
      name: 'Concert AI Test', description: 'Chưa có bio', start_time: new Date().toISOString(), status: 'DRAFT'
    }, { headers: { Authorization: `Bearer ${tokenOrg}` } });
    const concertId = createConcert.data.id;

    // 2. Upload PDF
    console.log('Upload file dummy.pdf cho AI xử lý...');
    const formData = new FormData();
    const pdfPath = path.join(__dirname, 'dummy.pdf');
    
    // Tạo giả 1 file pdf text nếu chưa có
    if (!fs.existsSync(pdfPath)) {
        fs.writeFileSync(pdfPath, 'Sơn Tùng M-TP là ca sĩ nổi tiếng Việt Nam, sở hữu nhiều bản hit tỷ view.');
    }

    formData.append('file', fs.createReadStream(pdfPath));

    const startTime = Date.now();
    const aiRes = await axios.post(`${API_URL}/admin/concerts/${concertId}/upload-bio`, formData, {
        headers: { 
            Authorization: `Bearer ${tokenOrg}`,
            ...formData.getHeaders()
        }
    });
    const endTime = Date.now();

    console.log(`✅ Upload và bóc tách AI thành công! (Thời gian: ${(endTime - startTime)/1000}s)`);
    console.log('------------------------------');
    console.log('KẾT QUẢ AI GEMINI TRẢ VỀ:');
    console.log(aiRes.data.bio);
    console.log('------------------------------');

    console.log('=== TEST FLOW 9 HOÀN TẤT ===\n');
  } catch (err) {
    console.error('Lỗi khi chạy test:', err.response?.data || err.message);
  }
}

run();
