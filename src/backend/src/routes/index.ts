import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import concertRoutes from './concert.routes';
import orderRoutes from './order.routes';
import webhookRoutes from './webhook.routes';
import workerRoutes from './worker.routes';
import checkinRoutes from './checkin.routes';
import adminRoutes from './admin.routes';
import userRoutes from './user.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/concerts', concertRoutes);
router.use('/orders', orderRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/workers', workerRoutes);
router.use('/checkin', checkinRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);

import prisma from '../config/db';
import redisClient from '../config/redis';
import logger from '../utils/logger';

router.get('/health', async (req: Request, res: Response) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        await redisClient.ping();
        res.status(200).json({ status: 'ok', timestamp: new Date() });
    } catch (error) {
        logger.error({ error }, 'Health check failed');
        res.status(503).json({ status: 'error', message: 'Service Unavailable' });
    }
});

export default router;
