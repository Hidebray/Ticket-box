import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { getUsers, getOrganizers, createUser, updateUser, deleteUser, updateUserStatus } from '../controllers/user.controller';

const router = Router();

// Yêu cầu đăng nhập và chỉ dành cho SUPER_ADMIN hoặc ORGANIZER
router.use(authenticate, authorize(['SUPER_ADMIN', 'ORGANIZER']));

// Lấy danh sách users theo phân quyền
router.get('/', getUsers);

// Lấy danh sách organizer (dành cho form tạo STAFF của SUPER_ADMIN)
router.get('/organizers', authorize(['SUPER_ADMIN']), getOrganizers);

// Thao tác CRUD
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/status', updateUserStatus);
router.delete('/:id', deleteUser);

export default router;
