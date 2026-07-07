import { Router } from 'express';
import { createOrder, getMyTickets, getOrderById, streamOrderStatus } from '../controllers/order.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';
import { strictLimiter } from '../middlewares/rate-limit.middleware';
import { validate, createOrderSchema } from '../types/validation.schemas';

const router = Router();

// Lấy danh sách vé đã mua của user (phải đứng trước '/:id')
router.get('/my-tickets', authenticate, authorize(['AUDIENCE']), getMyTickets);

// SSE Stream theo dõi trạng thái đơn hàng (phải trước '/:id' để không bị match sai)
router.get('/stream/:id', streamOrderStatus);

// Lấy chi tiết đơn hàng theo ID
router.get('/:id', authenticate, authorize(['AUDIENCE']), getOrderById);

// Mua vé (Rate Limit khắt khe + Validation)
router.post(
    '/',
    strictLimiter,
    authenticate,
    authorize(['AUDIENCE']),
    idempotencyMiddleware,
    validate(createOrderSchema),
    createOrder,
);

export default router;

