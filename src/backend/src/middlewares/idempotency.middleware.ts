import { Request, Response, NextFunction } from 'express';
import redisClient from '../config/redis';

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.headers['idempotency-key'];

    if (!key || typeof key !== 'string') {
        res.status(400).json({ message: 'Idempotency-Key header is required' });
        return;
    }

    const redisKey = `idempotency:${key}`;

    try {
        const value = await redisClient.get(redisKey);

        if (value) {
            const parsed = JSON.parse(value);
            
            if (parsed.status === 'PROCESSING') {
                res.status(409).json({ message: 'Request is already being processed. Please wait.' });
                return;
            }

            if (parsed.status === 'SUCCESS') {
                res.status(200).json({ 
                    message: 'Request already completed', 
                    data: parsed.data 
                });
                return;
            }
        }

        // Lock the key
        await redisClient.set(redisKey, JSON.stringify({ status: 'PROCESSING' }), 'EX', 300); // 5 minutes TTL

        // Attach the key to request
        (req as any).idempotencyKey = key;

        next();
    } catch (error) {
        console.error('Idempotency error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
