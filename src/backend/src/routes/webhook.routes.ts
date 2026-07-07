import { Router } from 'express';
import { handlePaymentWebhook, mockPaymentHandler } from '../controllers/webhook.controller';
import { verifyWebhookSignature } from '../middlewares/webhook.middleware';
import { validate, webhookPayloadSchema } from '../types/validation.schemas';

const router = Router();

// Endpoint nhận callback từ cổng thanh toán (Public API, cổng thanh toán sẽ tự gọi vào)
router.post('/payment', verifyWebhookSignature, validate(webhookPayloadSchema), handlePaymentWebhook);

// Endpoint giả lập cổng thanh toán — CHỈ DÙNG Ở DEV/TEST
// [SEC] Tắt hoàn toàn ở production
if (process.env.NODE_ENV !== 'production') {
    router.post('/mock-payment', validate(webhookPayloadSchema), mockPaymentHandler);
}

export default router;
