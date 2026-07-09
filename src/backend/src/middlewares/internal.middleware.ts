import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * [SEC-04] Middleware bảo vệ các internal worker routes.
 * Chỉ cho phép requests có header `x-internal-secret` khớp với env var.
 * Ngăn chặn bên ngoài gọi trực tiếp các endpoint trigger job.
 */
export const requireInternalSecret = (req: Request, res: Response, next: NextFunction): void => {
    const secret = process.env.INTERNAL_WORKER_SECRET!;
    const provided = req.headers['x-internal-secret'];

    if (!provided || typeof provided !== 'string') {
        res.status(403).json({ message: 'Forbidden: Missing internal secret' });
        return;
    }

    try {
        // Dùng timingSafeEqual để chống timing attack
        const providedBuf = Buffer.from(provided);
        const secretBuf = Buffer.from(secret);

        if (providedBuf.length !== secretBuf.length || !crypto.timingSafeEqual(providedBuf, secretBuf)) {
            logger.warn({ ip: req.ip }, '[Internal] Invalid internal secret from IP');
            res.status(403).json({ message: 'Forbidden: Invalid internal secret' });
            return;
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
