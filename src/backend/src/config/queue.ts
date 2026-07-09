import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Setup Redis connection for BullMQ
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null
});

// Define Queue
export const guestUploadQueue = new Queue('guest-upload-queue', { connection: connection as any });

