const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API_URL = 'http://localhost:3001/api';

async function runTest() {
  try {
    console.log('--- Testing Scenario 8: Guest List CSV Sync Worker ---');

    // 1. Login as Organizer
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'organizer@ticketbox.vn', password: '123456' })
    });
    const token = (await loginRes.json()).token;
    console.log('✅ Logged in as Organizer');

    // 2. Fetch Concerts for this Organizer
    let res = await fetch(`${API_URL}/admin/concerts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const concerts = await res.json();
    const concert = concerts[0];
    const ticketTypeId = concert.ticket_types[0].id;
    console.log(`✅ Using Concert: ${concert.name}, Ticket Type: ${concert.ticket_types[0].name}`);

    // 3. Create FormData and attach CSV
    const csvPath = path.join(__dirname, 'guests.csv');
    const fileContent = fs.readFileSync(csvPath);
    
    // In Node.js built-in fetch, we can use FormData and Blob
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'text/csv' });
    formData.append('file', blob, 'guests.csv');
    formData.append('concertId', concert.id);
    formData.append('ticketTypeId', ticketTypeId);

    // 4. Upload CSV
    res = await fetch(`${API_URL}/admin/guests/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const uploadData = await res.json();
    if (!res.ok) throw new Error(uploadData.message || 'Upload failed');
    const jobId = uploadData.jobId;
    console.log(`✅ CSV Uploaded, Job ID: ${jobId}`);

    // 5. Poll Job Progress
    let jobCompleted = false;
    while (!jobCompleted) {
      await new Promise(r => setTimeout(r, 1000));
      const progressRes = await fetch(`${API_URL}/admin/guests/progress/${jobId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const progressData = await progressRes.json();
      console.log(`🔄 Job Status: ${progressData.state}, Progress: ${progressData.progress}%`);
      
      if (progressData.state === 'completed') {
        console.log(`✅ Job completed successfully. Processed: ${progressData.result?.successCount} guests.`);
        jobCompleted = true;
      } else if (progressData.state === 'failed') {
        throw new Error(`Job failed: ${progressData.failedReason}`);
      }
    }

    console.log('✅ PASSED: Guest List CSV Sync Worker works correctly');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTest();
