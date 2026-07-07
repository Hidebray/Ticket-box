import 'dotenv/config';
import app from './app';
import prisma from './config/db';
import redisClient from './config/redis';
import { startRepeatableJobs } from './workers/order-expiry.worker';
import './config/queue'; // Start BullMQ workers

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
    console.error('\n❌ [STARTUP] Thiếu các biến môi trường bắt buộc:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.error('\n💡 Hãy sao chép .env.example thành .env và điền đầy đủ giá trị.\n');
    process.exit(1);
}

const PORT = process.env.PORT || 3001;

async function bootstrap() {
    try {
        // Check DB connection
        await prisma.$connect();
        console.log('✅ PostgreSQL connected via Prisma');

        // Check Redis connection
        await redisClient.ping();
        console.log('✅ Redis ping successful');

        // Start background workers
        await startRepeatableJobs();

        app.listen(PORT, () => {
            console.log(`🚀 Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to bootstrap server:', error);
        process.exit(1);
    }
}

bootstrap();
