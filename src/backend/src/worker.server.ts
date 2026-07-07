/**
 * [PERF-01] Worker Process riêng biệt
 * 
 * Chạy độc lập với Express server để tránh CPU-intensive jobs
 * làm tăng latency của request handlers.
 * 
 * Khởi chạy: node dist/worker.server.js
 * Hoặc với PM2: pm2 start dist/worker.server.js --name ticketbox-worker
 */
import 'dotenv/config';

// Validate env trước khi làm gì
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'REDIS_URL'] as const;
const missingVars = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
if (missingVars.length > 0) {
    console.error('❌ [WORKER] Thiếu env vars:', missingVars.join(', '));
    process.exit(1);
}

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

console.log('🔧 [Worker Process] Starting BullMQ worker...');

const taskWorker = new Worker('task-queue', async (job: Job) => {
    switch (job.name) {
        case 'generate-ai-bio': {
            console.log(`[Worker] Generating AI Bio for concert ${job.data.concertId}...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log(`[Worker] Finished AI Bio for concert ${job.data.concertId}`);
            break;
        }
        case 'send-email': {
            console.log(`[Worker] Sending email to ${job.data.email}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log(`[Worker] Email sent to ${job.data.email}`);
            break;
        }
        case 'cancel-expired-order': {
            console.log(`[Worker] Checking expired order ${job.data.orderId}...`);
            const { cancelExpiredOrderJob } = await import('./workers/order-expiry.worker');
            await cancelExpiredOrderJob(job.data.orderId);
            break;
        }
        case 'reconcile-tickets': {
            console.log('[Worker] Reconciling ticket quantities...');
            const { syncRedisCounters } = await import('./workers/order-expiry.worker');
            await syncRedisCounters();
            break;
        }
        case 'send-pre-event-reminders': {
            console.log('[Worker] Checking pre-event reminders...');
            const { sendPreEventReminders } = await import('./workers/order-expiry.worker');
            await sendPreEventReminders();
            break;
        }
        case 'sweep-orphaned-orders': {
            console.log('[Worker] Sweeping orphaned pending orders...');
            const { sweepOrphanedOrders } = await import('./workers/order-expiry.worker');
            await sweepOrphanedOrders();
            break;
        }
        default:
            console.warn(`[Worker] Unknown job type: ${job.name}`);
    }
}, { connection: connection as any });

taskWorker.on('completed', job => {
    console.log(`✅ [Worker] Job "${job.name}" (${job.id}) completed.`);
});

taskWorker.on('failed', (job, err) => {
    console.error(`❌ [Worker] Job "${job?.name}" (${job?.id}) failed: ${err.message}`);
});

// Graceful shutdown
const shutdown = async () => {
    console.log('\n🛑 [Worker] Shutting down gracefully...');
    await taskWorker.close();
    await connection.quit();
    console.log('✅ [Worker] Shutdown complete.');
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('✅ [Worker Process] BullMQ worker running. Waiting for jobs...');
