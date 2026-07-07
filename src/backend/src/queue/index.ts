import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6380', {
    maxRetriesPerRequest: null
});

export const taskQueue = new Queue('task-queue', { connection: connection as any });

// Set up the Worker
export const taskWorker = new Worker('task-queue', async (job: Job) => {
    switch (job.name) {
        case 'generate-ai-bio':
            console.log(`[Worker] Generating AI Bio for concert ${job.data.concertId}...`);
            // Simulate AI heavy processing
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log(`[Worker] Finished AI Bio for concert ${job.data.concertId}`);
            break;
        case 'send-email':
            console.log(`[Worker] Sending email with QR to ${job.data.email}...`);
            // Simulate email sending
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log(`[Worker] Email sent to ${job.data.email}`);
            break;
        case 'cancel-expired-order':
            console.log(`[Worker] Checking expired order ${job.data.orderId}...`);
            const { cancelExpiredOrderJob } = require('../workers/order-expiry.worker');
            await cancelExpiredOrderJob(job.data.orderId);
            break;
        case 'reconcile-tickets':
            console.log(`[Worker] Reconciling ticket quantities...`);
            const { syncRedisCounters } = require('../workers/order-expiry.worker');
            await syncRedisCounters();
            break;
        case 'send-pre-event-reminders':
            console.log(`[Worker] Checking pre-event reminders...`);
            const { sendPreEventReminders } = require('../workers/order-expiry.worker');
            await sendPreEventReminders();
            break;
        case 'sweep-orphaned-orders':
            console.log(`[Worker] Sweeping orphaned pending orders...`);
            const { sweepOrphanedOrders } = require('../workers/order-expiry.worker');
            await sweepOrphanedOrders();
            break;
        default:
            console.log(`[Worker] Unknown job type: ${job.name}`);
    }
}, { connection: connection as any });

taskWorker.on('completed', job => {
    console.log(`[Worker] Job ${job.id} has completed!`);
});

taskWorker.on('failed', (job, err) => {
    console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
});
