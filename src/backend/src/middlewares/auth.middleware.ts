import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// [SEC-01] Không dùng hardcoded fallback — phải cấu hình qua env (validate trong server.ts)
const JWT_SECRET = process.env.JWT_SECRET!;

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Unauthorized - Missing token' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }
};

export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        
        // SUPER_ADMIN có toàn quyền truy cập tất cả
        if (req.user.role === 'SUPER_ADMIN') {
            return next();
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ message: 'Forbidden - Insufficient permissions' });
            return;
        }
        next();
    };
};
