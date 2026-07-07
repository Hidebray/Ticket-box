import prisma from '../config/db';
import redisClient from '../config/redis';
import NotificationService from '../services/notification.service';
import { taskQueue } from '../queue';

// Function to check and cancel a specific expired order (Triggered by BullMQ Delayed Job)
export const cancelExpiredOrderJob = async (orderId: string) => {
    if (!orderId || typeof orderId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        console.error(`[Worker] Invalid orderId format: ${orderId}`);
        return;
    }

    try {
        const order = await prisma.orders.findUnique({
            where: { id: orderId },
            include: { tickets: true }
        });

        if (!order) return;
        
        // If order is already SUCCESS or FAILED, nothing to do
        if (order.status !== 'PENDING') return;

        console.log(`[Worker] Cancelling expired order ${orderId}...`);

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

            // SSE: Notify map viewers that tickets are available again
            await redisClient.publish('seat_updates', JSON.stringify({
                ticketTypeId,
                ticketIds: order.tickets.map((t: any) => t.id),
                status: 'AVAILABLE'
            }));
            await redisClient.del(`zone_tickets:${ticketTypeId}`);
        }
        
        console.log(`[Worker] Cancelled Order ${order.id} and restored ${order.tickets.length} tickets.`);

    } catch (error) {
        console.error('[Worker] Error cancelling expired order:', error);
    }
};

// Function to reconcile Redis ticket remaining counters with DB
export const syncRedisCounters = async () => {
    try {
        console.log(`[Worker] Starting Ticket Reconciliation...`);
        const ticketTypes = await prisma.ticket_types.findMany();
        
        for (const tt of ticketTypes) {
            const soldOrReserved = await prisma.tickets.count({
                where: { 
                    ticket_type_id: tt.id, 
                    status: { in: ['RESERVED', 'SOLD', 'CHECKED_IN'] } 
                }
            });
            const remaining = tt.total_quantity - soldOrReserved;
            const remainingKey = `ticket_remaining:${tt.id}`;
            
            // Sync with Redis
            await redisClient.set(remainingKey, remaining);
        }
        console.log(`[Worker] Completed Ticket Reconciliation.`);
    } catch (error) {
        console.error('[Worker] Error during ticket reconciliation:', error);
    }
};

// Function to send reminder notifications 24 hours before concert starts
export const sendPreEventReminders = async () => {
    try {
        const now = Date.now();
        const startRange = new Date(now + 23 * 60 * 60 * 1000); // 23 hours from now
        const endRange = new Date(now + 24 * 60 * 60 * 1000);   // 24 hours from now

        // Find tickets that are sold/checked-in for concerts starting in 23-24 hours
        const upcomingTickets = await prisma.tickets.findMany({
            where: {
                status: { in: ['SOLD', 'CHECKED_IN'] },
                ticket_types: {
                    concerts: {
                        start_time: {
                            gte: startRange,
                            lte: endRange
                        }
                    }
                }
            },
            include: {
                users: true,
                ticket_types: {
                    include: {
                        concerts: true
                    }
                }
            }
        });

        if (upcomingTickets.length === 0) return;

        console.log(`[Worker] Found ${upcomingTickets.length} upcoming tickets in 24h. Checking reminders...`);

        for (const ticket of upcomingTickets) {
            if (!ticket.users) continue;

            const userId = ticket.users.id;
            const userEmail = ticket.users.email;
            const concertId = ticket.ticket_types.concerts.id;
            const concertName = ticket.ticket_types.concerts.name;
            const startTime = ticket.ticket_types.concerts.start_time;

            const redisKey = `reminder_sent:${userId}:${concertId}`;
            
            // Check if reminder was already sent
            const alreadySent = await redisClient.get(redisKey);
            if (!alreadySent) {
                // Send reminder
                await NotificationService.notifyConcertReminder(userEmail, concertName, startTime);
                
                // Mark as sent in Redis with 48h TTL
                await redisClient.set(redisKey, '1', 'EX', 48 * 60 * 60);
                
                console.log(`[Worker] Sent 24h reminder for ${concertName} to ${userEmail}`);
            }
        }
    } catch (error) {
        console.error('[Worker] Error sending pre-event reminders:', error);
    }
};

// Function to sweep and cancel orphaned pending orders (Fallback for failed delayed jobs)
export const sweepOrphanedOrders = async () => {
    try {
        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

        const orphanedOrders = await prisma.orders.findMany({
            where: {
                status: 'PENDING',
                created_at: {
                    lt: fifteenMinutesAgo
                }
            },
            select: { id: true }
        });

        if (orphanedOrders.length === 0) return;

        console.log(`[Worker] Found ${orphanedOrders.length} orphaned pending orders. Cancelling in batches...`);

        // [PERF-02] Batch processing — xử lý 20 orders song song thay vì tuần tự
        const BATCH_SIZE = 20;
        for (let i = 0; i < orphanedOrders.length; i += BATCH_SIZE) {
            const batch = orphanedOrders.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(order => cancelExpiredOrderJob(order.id)));
            console.log(`[Worker] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(orphanedOrders.length / BATCH_SIZE)}`);
        }

        console.log(`[Worker] Completed Orphaned Orders Sweep. Total: ${orphanedOrders.length}`);
    } catch (error) {
        console.error('[Worker] Error during orphaned orders sweep:', error);
    }
};


// Start the repeatable jobs in BullMQ
export const startRepeatableJobs = async () => {
    // Reconcile tickets every 5 minutes
    await taskQueue.add('reconcile-tickets', {}, { 
        repeat: { pattern: '*/5 * * * *' },
        jobId: 'reconcile-tickets-job'
    });

    // Send reminders every 10 minutes
    await taskQueue.add('send-pre-event-reminders', {}, { 
        repeat: { pattern: '*/10 * * * *' },
        jobId: 'send-pre-event-reminders-job'
    });

    // Sweep orphaned orders every 5 minutes
    await taskQueue.add('sweep-orphaned-orders', {}, { 
        repeat: { pattern: '*/5 * * * *' },
        jobId: 'sweep-orphaned-orders-job'
    });
    
    console.log('[Worker] Repeatable jobs scheduled in BullMQ.');
};
