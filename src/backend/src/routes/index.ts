import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import concertRoutes from './concert.routes';
import orderRoutes from './order.routes';
import webhookRoutes from './webhook.routes';
import workerRoutes from './worker.routes';
import checkinRoutes from './checkin.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/concerts', concertRoutes);
router.use('/orders', orderRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/workers', workerRoutes);
router.use('/checkin', checkinRoutes);
router.use('/admin', adminRoutes);

router.get('/ping', (req: Request, res: Response) => {
  res.json({ message: 'pong', timestamp: new Date() });
});

export default router;
