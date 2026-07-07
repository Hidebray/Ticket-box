const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const API_URL = 'http://localhost:3001/api';

async function runTest() {
  const prisma = new PrismaClient();
  try {
    console.log('--- Testing Scenario 6: Offline Checkin Sync ---');

    // 1. Create a STAFF user directly via Prisma (since register API makes AUDIENCE)
    const email = `staff_${Date.now()}@test.com`;
    const passwordHash = await bcrypt.hash('123456', 10);
    const staff = await prisma.users.create({
      data: {
        email,
        password: passwordHash,
        role: 'STAFF'
      }
    });

    // Login as STAFF
    let res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: '123456' })
    });
    const loginData = await res.json();
    if (!res.ok) throw new Error(loginData.message);
    const token = loginData.token;
    console.log('✅ Logged in as STAFF');

    // 2. Fetch a concert to sync down
    const concertsRes = await fetch(`${API_URL}/concerts`);
    const concerts = await concertsRes.json();
    const concert = concerts[0];
    
    // Sync Down
    res = await fetch(`${API_URL}/checkin/sync-down?concertId=${concert.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const syncDownData = await res.json();
    if (!res.ok) throw new Error(syncDownData.message);
    
    // Find the ticket we bought in Scenario 5
    const boughtTicket = syncDownData.data.find(t => t.status === 'SOLD');
    if (!boughtTicket) throw new Error('No SOLD tickets found for this concert.');
    console.log(`✅ Synced down ${syncDownData.data.length} tickets. Found sold ticket ${boughtTicket.id}`);

    // 3. Sync Up (First scan)
    const t1 = new Date(Date.now() - 10000).toISOString(); // 10s ago
    res = await fetch(`${API_URL}/checkin/sync-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        scannedTickets: [{ ticketId: boughtTicket.id, scannedAt: t1 }]
      })
    });
    let syncUpData = await res.json();
    if (syncUpData.results[0].status !== 'SUCCESS') throw new Error('Expected SUCCESS, got ' + syncUpData.results[0].status);
    console.log('✅ First scan processed: SUCCESS');

    // 4. Sync Up (Earlier scan -> should overwrite)
    const t0 = new Date(Date.now() - 20000).toISOString(); // 20s ago
    res = await fetch(`${API_URL}/checkin/sync-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        scannedTickets: [{ ticketId: boughtTicket.id, scannedAt: t0 }]
      })
    });
    syncUpData = await res.json();
    if (syncUpData.results[0].status !== 'SUCCESS_OVERWRITTEN') throw new Error('Expected SUCCESS_OVERWRITTEN, got ' + syncUpData.results[0].status);
    console.log('✅ Earlier scan processed: SUCCESS_OVERWRITTEN');

    // 5. Sync Up (Later scan -> should reject)
    const t2 = new Date().toISOString(); // now
    res = await fetch(`${API_URL}/checkin/sync-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        scannedTickets: [{ ticketId: boughtTicket.id, scannedAt: t2 }]
      })
    });
    syncUpData = await res.json();
    if (syncUpData.results[0].status !== 'DUPLICATE_REJECTED') throw new Error('Expected DUPLICATE_REJECTED, got ' + syncUpData.results[0].status);
    console.log('✅ Later scan processed: DUPLICATE_REJECTED');
    console.log('✅ PASSED: Offline Checkin Sync works correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
