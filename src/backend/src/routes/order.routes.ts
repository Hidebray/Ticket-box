import { Router } from 'express';
import { createOrder, getMyTickets, getOrderById } from '../controllers/order.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';

const router = Router();

// Lấy danh sách vé đã mua của user (phải đứng trước '/:id' nếu có)
router.get('/my-tickets', authenticate, authorize(['AUDIENCE']), getMyTickets);

// Lấy chi tiết đơn hàng theo ID
router.get('/:id', authenticate, authorize(['AUDIENCE']), getOrderById);

// Mua vé
router.post('/', authenticate, authorize(['AUDIENCE']), idempotencyMiddleware, createOrder);

export default router;
