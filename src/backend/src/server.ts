import 'dotenv/config';
import app from './app';
import prisma from './config/db';
import redisClient from './config/redis';
import { startRepeatableJobs } from './workers/order-expiry.worker';
import logger from './utils/logger';


// ============================================================
// [SEC-01] FAIL-FAST: Validate bắt buộc trước khi khởi động
// ============================================================
const REQUIRED_ENV_VARS = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'WEBHOOK_SECRET',
    'INTERNAL_WORKER_SECRET',
    'ALLOWED_ORIGINS',
] as const;

const missingVars = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
if (missingVars.length > 0) {
    logger.fatal({ missingVars }, 'Thiếu các biến môi trường bắt buộc. Hãy sao chép .env.example thành .env và điền đầy đủ giá trị.');
    process.exit(1);
}

const PORT = process.env.PORT || 3001;

async function bootstrap() {
    try {
        // Check DB connection
        await prisma.$connect();
        logger.info('PostgreSQL connected via Prisma');

        // Check Redis connection
        await redisClient.ping();
        logger.info('Redis ping successful');

        // Start background workers
        await startRepeatableJobs();

        app.listen(PORT, () => {
            logger.info(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        logger.fatal({ error }, 'Failed to bootstrap server');
        process.exit(1);
    }
}

bootstrap();
