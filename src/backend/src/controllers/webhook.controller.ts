import { Request, Response } from 'express';
import prisma from '../config/db';
import redisClient from '../config/redis';

export const handlePaymentWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId, status } = req.body;

        if (!orderId || !status) {
            res.status(400).json({ message: 'Missing orderId or status' });
            return;
        }

        const order = await prisma.orders.findUnique({
            where: { id: orderId },
            include: { tickets: true }
        });

        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        // Idempotent Check: Nếu Order đã được xử lý (thành công hoặc thất bại) thì bỏ qua
        if (order.status === 'SUCCESS' || order.status === 'FAILED') {
            res.status(200).json({ message: 'Webhook already processed for this order' });
            return;
        }

        if (status === 'SUCCESS') {
            // Cập nhật Order -> SUCCESS, Tickets -> SOLD (đồng nghĩa với AVAILABLE để người dùng đem đi check-in)
            await prisma.$transaction(async (tx: any) => {
                await tx.orders.update({
                    where: { id: orderId },
                    data: { status: 'SUCCESS' }
                });

                await tx.tickets.updateMany({
                    where: { order_id: orderId },
                    data: { status: 'SOLD' }
                });
            });

            res.status(200).json({ message: 'Payment success, tickets are now valid' });
            
        } else if (status === 'FAILED') {
            // Thanh toán thất bại -> Hủy Order, xóa Tickets, hoàn số lượng lại cho hệ thống
            await prisma.$transaction(async (tx: any) => {
                await tx.orders.update({
                    where: { id: orderId },
                    data: { status: 'FAILED' }
                });

                await tx.tickets.deleteMany({
                    where: { order_id: orderId }
                });
            });

            if (order.tickets.length > 0) {
                const ticketTypeId = order.tickets[0].ticket_type_id;
                const qty = order.tickets.length;
                const remainingKey = `ticket_remaining:${ticketTypeId}`;
                await redisClient.incrby(remainingKey, qty);
            }

            res.status(200).json({ message: 'Payment failed, tickets returned to pool' });
        } else {
            res.status(400).json({ message: 'Invalid status' });
        }

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
