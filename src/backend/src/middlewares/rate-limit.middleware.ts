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
  max: 1000, // Tối đa 10 requests mỗi User/IP cho booking
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

// Login Limiter (10 req/15 min, bỏ qua thành công)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 1000,
  skipSuccessfulRequests: true, // Chỉ đếm request lỗi
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again after 15 minutes' },
  store: new RedisStore({
    // @ts-expect-error
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
});

// Register Limiter (5 req/60 min)
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 phút
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts, please try again after an hour' },
  store: new RedisStore({
    // @ts-expect-error
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
});
