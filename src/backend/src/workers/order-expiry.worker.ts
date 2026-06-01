import cron from 'node-cron';
import prisma from '../config/db';
import redisClient from '../config/redis';
import NotificationService from '../services/notification.service';

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

        console.log(`[Cronjob] Found ${upcomingTickets.length} upcoming tickets in 24h. Checking reminders...`);

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
                
                console.log(`[Cronjob] Sent 24h reminder for ${concertName} to ${userEmail}`);
            }
        }
    } catch (error) {
        console.error('[Cronjob] Error sending pre-event reminders:', error);
    }
};

// Start the worker loops using node-cron
export const startOrderExpiryWorker = () => {
    // Check for expired orders every minute
    cron.schedule('* * * * *', () => {
        cancelExpiredOrders();
    });

    // Check for 24h reminders every 10 minutes
    cron.schedule('*/10 * * * *', () => {
        sendPreEventReminders();
    });
    
    console.log('Order Expiry & 24h Reminder Worker scheduled.');
};

