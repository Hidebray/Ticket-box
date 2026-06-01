import app from './app';
import prisma from './config/db';
import redisClient from './config/redis';
import { startOrderExpiryWorker } from './workers/order-expiry.worker';
import './config/queue'; // Start BullMQ workers

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // Check DB connection
    await prisma.$connect();
    console.log('PostgreSQL connected via Prisma');

    // Check Redis connection
    await redisClient.ping();
    console.log('Redis ping successful');

    // Start background workers
    startOrderExpiryWorker();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to bootstrap server', error);
    process.exit(1);
  }
}

bootstrap();
