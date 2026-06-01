import { Router } from 'express';
import { handlePaymentWebhook } from '../controllers/webhook.controller';

const router = Router();

// Endpoint nhận callback từ cổng thanh toán (Public API, cổng thanh toán sẽ tự gọi vào)
router.post('/payment', handlePaymentWebhook);

export default router;
