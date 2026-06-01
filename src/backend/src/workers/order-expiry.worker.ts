import cron from 'node-cron';
import prisma from '../config/db';
import redisClient from '../config/redis';

// Function to check and cancel expired orders
export const cancelExpiredOrders = async () => {
    try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        // Find all PENDING orders older than 15 minutes
        const expiredOrders = await prisma.orders.findMany({
            where: {
                status: 'PENDING',
                created_at: {
                    lt: fifteenMinutesAgo
                }
            },
            include: {
                tickets: true
            }
        });

        if (expiredOrders.length === 0) return;

        console.log(`[Cronjob] Found ${expiredOrders.length} expired orders to cancel.`);

        for (const order of expiredOrders) {
            await prisma.$transaction(async (tx: any) => {
                await tx.orders.update({
                    where: { id: order.id },
                    data: { status: 'FAILED' }
                });

                await tx.tickets.deleteMany({
                    where: { order_id: order.id }
                });
            });

            if (order.tickets.length > 0) {
                const ticketTypeId = order.tickets[0].ticket_type_id;
                const qty = order.tickets.length;
                const remainingKey = `ticket_remaining:${ticketTypeId}`;
                
                await redisClient.incrby(remainingKey, qty);
            }
            
            console.log(`[Cronjob] Cancelled Order ${order.id} and restored ${order.tickets.length} tickets.`);
        }

    } catch (error) {
        console.error('[Cronjob] Error cancelling expired orders:', error);
    }
};

// Start the worker loop using node-cron (runs every minute)
export const startOrderExpiryWorker = () => {
    cron.schedule('* * * * *', () => {
        cancelExpiredOrders();
    });
    console.log('Order Expiry Worker scheduled (runs every minute).');
};
