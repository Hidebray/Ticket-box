import { Request, Response } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcrypt';
import logger from '../utils/logger';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const role = req.user?.role;
        const userId = req.user?.id;
        const { page = '1', limit = '20', search = '', filterRole } = req.query;

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = parseInt(limit as string, 10) || 20;
        const skip = (pageNum - 1) * limitNum;
        
        let whereClause: any = {};
        
        if (role === 'ORGANIZER') {
            // Organizer chỉ thấy STAFF của mình
            whereClause = { organizer_id: userId, role: 'STAFF' };
        } else if (role !== 'SUPER_ADMIN') {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        // Lọc theo role nếu được gửi từ client
        if (filterRole) {
            whereClause.role = filterRole;
        }

        // Tìm kiếm theo email
        if (search) {
            whereClause.email = {
                contains: search as string,
                mode: 'insensitive'
            };
        }

        const [users, total] = await Promise.all([
            prisma.users.findMany({
                where: whereClause,
                skip,
                take: limitNum,
                select: {
                    id: true,
                    email: true,
                    role: true,
                    status: true,
                    created_at: true,
                    organizer_id: true,
                    organizer: {
                        select: { email: true }
                    },
                    _count: {
                        select: {
                            tickets: true,
                            concerts: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' }
            }),
            prisma.users.count({ where: whereClause })
        ]);
        
        res.json({
            data: users,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        logger.error({ error }, 'Error fetching users');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Lấy danh sách Organizer (dành cho Super Admin khi tạo Staff)
export const getOrganizers = async (req: Request, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        const organizers = await prisma.users.findMany({
            where: { role: 'ORGANIZER' },
            select: { id: true, email: true },
            orderBy: { email: 'asc' }
        });

        res.json(organizers);
    } catch (error) {
        logger.error({ error }, 'Error fetching organizers');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Tạo người dùng mới (CRUD)
export const createUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, role, organizer_id } = req.body;
        const currentUserRole = req.user?.role;
        const currentUserId = req.user?.id;

        // Validation
        if (!email || !password || !role) {
            res.status(400).json({ message: 'Missing required fields' });
            return;
        }

        // Quyền hạn kiểm tra
        if (currentUserRole === 'ORGANIZER' && role !== 'STAFF') {
            res.status(403).json({ message: 'Organizer can only create STAFF' });
            return;
        }

        const existingUser = await prisma.users.findUnique({ where: { email } });
        if (existingUser) {
            res.status(400).json({ message: 'Email already exists' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Gán organizer_id
        let finalOrganizerId = organizer_id;
        if (currentUserRole === 'ORGANIZER' && role === 'STAFF') {
            finalOrganizerId = currentUserId; // Tự động gán cho chính Organizer tạo
        }

        const newUser = await prisma.users.create({
            data: {
                email,
                password: hashedPassword,
                role,
                organizer_id: role === 'STAFF' ? finalOrganizerId : null
            },
            select: { id: true, email: true, role: true, organizer_id: true }
        });

        res.status(201).json(newUser);
    } catch (error) {
        logger.error({ error }, 'Error creating user');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Cập nhật người dùng
export const updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { password, role, organizer_id } = req.body;
        const currentUserRole = req.user?.role;
        const currentUserId = req.user?.id;

        const userToEdit = await prisma.users.findUnique({ where: { id } });
        if (!userToEdit) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Kiểm tra quyền
        if (currentUserRole === 'ORGANIZER') {
            if (userToEdit.organizer_id !== currentUserId) {
                res.status(403).json({ message: 'You can only edit your own STAFF' });
                return;
            }
        } else if (currentUserRole !== 'SUPER_ADMIN') {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        const updateData: any = {};
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }
        
        // Super admin có quyền sửa role và organizer_id
        if (currentUserRole === 'SUPER_ADMIN') {
            if (role) updateData.role = role;
            if (organizer_id !== undefined) updateData.organizer_id = role === 'STAFF' ? organizer_id : null;
        }

        const updatedUser = await prisma.users.update({
            where: { id },
            data: updateData,
            select: { id: true, email: true, role: true, organizer_id: true }
        });

        res.json(updatedUser);
    } catch (error) {
        logger.error({ error }, 'Error updating user');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Xóa người dùng
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const currentUserRole = req.user?.role;
        const currentUserId = req.user?.id;

        const userToEdit = await prisma.users.findUnique({ where: { id } });
        if (!userToEdit) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Kiểm tra quyền
        if (currentUserRole === 'ORGANIZER') {
            if (userToEdit.organizer_id !== currentUserId) {
                res.status(403).json({ message: 'You can only delete your own STAFF' });
                return;
            }
        } else if (currentUserRole !== 'SUPER_ADMIN') {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        await prisma.users.delete({ where: { id } });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        logger.error({ error }, 'Error deleting user');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Cập nhật trạng thái người dùng (LOCKED/ACTIVE)
export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { status } = req.body;
        const currentUserRole = req.user?.role;
        const currentUserId = req.user?.id;

        if (!status || !['ACTIVE', 'LOCKED'].includes(status)) {
            res.status(400).json({ message: 'Invalid status' });
            return;
        }

        const userToEdit = await prisma.users.findUnique({ where: { id } });
        if (!userToEdit) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Kiểm tra quyền
        if (currentUserRole === 'ORGANIZER') {
            if (userToEdit.organizer_id !== currentUserId) {
                res.status(403).json({ message: 'You can only update status of your own STAFF' });
                return;
            }
        } else if (currentUserRole !== 'SUPER_ADMIN') {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        const updatedUser = await prisma.users.update({
            where: { id },
            data: { status },
            select: { id: true, email: true, role: true, status: true }
        });

        res.json(updatedUser);
    } catch (error) {
        logger.error({ error }, 'Error updating user status');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
