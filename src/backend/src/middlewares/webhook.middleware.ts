import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

export const verifyWebhookSignature = (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-webhook-signature'] as string | undefined;

    // [SEC-01] Không dùng hardcoded fallback — phải cấu hình qua env
    const secret = process.env.WEBHOOK_SECRET!;

    if (!signature) {
        res.status(403).json({ message: 'Missing Webhook Signature' });
        return;
    }

    try {
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        // [SEC-02] Dùng timingSafeEqual để chống timing attack
        const sigBuffer = Buffer.from(signature, 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');

        // Nếu độ dài khác nhau → reject ngay (timingSafeEqual yêu cầu cùng độ dài)
        if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
            logger.warn({ ip: req.ip }, '[Webhook] Signature mismatch');
            res.status(403).json({ message: 'Invalid Webhook Signature' });
            return;
        }

        next();
    } catch (error) {
        logger.error({ error }, 'Webhook signature verification error');
        res.status(500).json({ message: 'Internal Server Error verifying signature' });
    }
};
