import { Request, Response, NextFunction } from 'express';
import redisClient from '../config/redis';
import logger from '../utils/logger';

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.headers['idempotency-key'];

    if (!key || typeof key !== 'string') {
        res.status(400).json({ message: 'Idempotency-Key header is required' });
        return;
    }

    const redisKey = `idempotency:${key}`;

    try {
        // [P2] Fix Race Condition: Use SET NX to lock atomically
        const locked = await redisClient.set(redisKey, JSON.stringify({ status: 'PROCESSING' }), 'EX', 60, 'NX');

        if (!locked) {
            // Key already exists, fetch its current status
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
            
            // Edge case: if value expired right after SET NX failed
            res.status(409).json({ message: 'Request is already being processed. Please wait.' });
            return;
        }

        // Attach the key to request
        (req as any).idempotencyKey = key;

        next();
    } catch (error) {
        logger.error({ error }, 'Idempotency error');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
