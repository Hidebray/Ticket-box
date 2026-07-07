import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

// [SEC-01] Không dùng hardcoded fallback — phải cấu hình qua env (validate trong server.ts)
const JWT_SECRET = process.env.JWT_SECRET!;

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, role } = req.body;


        // [SEC-05] Chỉ cho phép self-register với role AUDIENCE.
        // ORGANIZER và STAFF phải được SUPER_ADMIN/ORGANIZER cấp quyền thủ công.
        if (role !== 'AUDIENCE') {
            res.status(400).json({ message: 'Self-registration is only allowed for role AUDIENCE' });
            return;
        }

        const existingUser = await prisma.users.findUnique({ where: { email } });
        if (existingUser) {
            res.status(409).json({ message: 'Email already exists' });
            return;
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = await prisma.users.create({
            data: {
                email,
                password: hashedPassword,
                role
            }
        });

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;


        const user = await prisma.users.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        const payload = { id: user.id, role: user.role };
        const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
