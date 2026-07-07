import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../config/redis';

// Global rate limiter cho các API thông thường (100 req/min)
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 100, // Tối đa 100 requests mỗi IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again after a minute' },
  store: new RedisStore({
    // @ts-expect-error - Đã chắc chắn dùng ioredis
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
});

// Strict rate limiter cho checkout và các tính năng quan trọng (5 req/min)
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 10, // Tối đa 10 requests mỗi User/IP cho booking
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Booking rate limit exceeded, please wait a minute' },
  keyGenerator: (req) => {
    return (req as import('express').Request & { user?: { id: string } }).user?.id || req.ip || 'unknown';
  },
  store: new RedisStore({
    // @ts-expect-error - Đã chắc chắn dùng ioredis
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
});
