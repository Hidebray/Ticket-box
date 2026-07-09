import Redis from 'ioredis';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redisClient.on('error', (err) => {
    logger.error({ err }, 'Redis Client Error');
});

redisClient.on('connect', () => {
    logger.debug('Redis connected successfully');
});

export default redisClient;
