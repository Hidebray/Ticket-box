import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { globalLimiter } from './middlewares/rate-limit.middleware';

const app = express();

// [SEC-03] CORS — Chỉ cho phép các origin được whitelist trong env
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        // Cho phép requests không có origin (ví dụ: curl, mobile app, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS blocked: origin "${origin}" not allowed`));
    },
    credentials: true,
}));

// Áp dụng Rate Limiting toàn cục
app.use(globalLimiter);

// Security middlewares
app.use(helmet());

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Main routes
app.use('/api', routes);

// 404 Handler
app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({ message: 'Resource not found' });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
    });
});

export default app;
