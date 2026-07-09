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

import logger from './utils/logger';

// Validate env trước khi làm gì
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'REDIS_URL', 'DATABASE_URL_WORKER'] as const;
const missingVars = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
if (missingVars.length > 0) {
    logger.fatal({ missingVars }, 'Thiếu env vars');
    process.exit(1);
}

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

logger.info('[Worker Process] Starting BullMQ worker...');

// Import guest upload worker
import { guestUploadWorker } from './workers/guest-upload.worker';

const taskWorker = new Worker('task-queue', async (job: Job) => {
    switch (job.name) {
        case 'generate-ai-bio': {
            logger.info(`[Worker] Generating AI Bio for concert ${job.data.concertId}...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            logger.info(`[Worker] Finished AI Bio for concert ${job.data.concertId}`);
            break;
        }
        case 'send-email': {
            logger.info(`[Worker] Sending email to ${job.data.email}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            logger.info(`[Worker] Email sent to ${job.data.email}`);
            break;
        }
        case 'cancel-expired-order': {
            logger.info(`[Worker] Checking expired order ${job.data.orderId}...`);
            const { cancelExpiredOrderJob } = await import('./workers/order-expiry.worker');
            await cancelExpiredOrderJob(job.data.orderId);
            break;
        }
        case 'reconcile-tickets': {
            logger.info('[Worker] Reconciling ticket quantities...');
            const { syncRedisCounters } = await import('./workers/order-expiry.worker');
            await syncRedisCounters();
            break;
        }
        case 'send-pre-event-reminders': {
            logger.info('[Worker] Checking pre-event reminders...');
            const { sendPreEventReminders } = await import('./workers/order-expiry.worker');
            await sendPreEventReminders();
            break;
        }
        case 'sweep-orphaned-orders': {
            logger.info('[Worker] Sweeping orphaned pending orders...');
            const { sweepOrphanedOrders } = await import('./workers/order-expiry.worker');
            await sweepOrphanedOrders();
            break;
        }
        default:
            logger.warn(`[Worker] Unknown job type: ${job.name}`);
    }
}, { connection: connection as any, concurrency: 15 });

taskWorker.on('completed', job => {
    logger.info(`[Worker] Job "${job.name}" (${job.id}) completed.`);
});

taskWorker.on('failed', (job, err) => {
    logger.error({ err }, `[Worker] Job "${job?.name}" (${job?.id}) failed`);
});

// Graceful shutdown
const shutdown = async () => {
    logger.info('[Worker] Shutting down gracefully...');
    await taskWorker.close();
    await guestUploadWorker.close();
    await connection.quit();
    logger.info('[Worker] Shutdown complete.');
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info('[Worker Process] BullMQ worker running. Waiting for jobs...');
