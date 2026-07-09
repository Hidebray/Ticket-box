import { Request, Response } from 'express';
import { createOrder } from '../controllers/order.controller';
import { prismaMock } from './setup';
jest.mock('../config/redis', () => {
    const RedisMock = require('ioredis-mock');
    return new RedisMock();
});
jest.mock('../queue', () => ({
    taskQueue: {
        add: jest.fn()
    }
}));
import redisClient from '../config/redis';

describe('Order Controller - createOrder', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;

    beforeEach(() => {
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        
        mockReq = {
            user: { id: 'user-123', email: 'test@user.com', role: 'AUDIENCE' } as any,
            body: {
                ticketTypeId: 'tt-123',
                ticketIds: ['t-1', 't-2']
            },
        };
        (mockReq as any).idempotencyKey = 'idemp-123';

        mockRes = {
            status: mockStatus,
            json: mockJson
        };
    });

    it('should successfully create order when tickets are available (Happy Path)', async () => {
        // Mock Redis state: 10 tickets remaining initially
        await redisClient.set('ticket_remaining:tt-123', '10');

        // Mock Prisma Transaction
        const mockOrder = { id: 'order-1' };
        prismaMock.$transaction.mockResolvedValue(mockOrder);

        await createOrder(mockReq as Request, mockRes as Response);

        // 1. Verify Redis Atomic DECR
        const remaining = await redisClient.get('ticket_remaining:tt-123');
        expect(remaining).toBe('8'); // 10 - 2

        // 2. Verify Success Response
        expect(mockStatus).toHaveBeenCalledWith(201);
        expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Order created successfully'
        }));
    });

    it('should block and return error if Redis DECR drops below 0 (Oversell Prevention)', async () => {
        // Mock Redis state: only 1 ticket remaining
        await redisClient.set('ticket_remaining:tt-123', '1');

        await createOrder(mockReq as Request, mockRes as Response);

        // 1. Verify response is 400
        expect(mockStatus).toHaveBeenCalledWith(400);
        expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Ticket type is sold out (Redis Pre-check)'
        }));

        // 2. Verify Redis Rollback (INCR) happened!
        // It drops to -1, then rolls back +2, so it should be back to 1
        const remaining = await redisClient.get('ticket_remaining:tt-123');
        expect(remaining).toBe('1'); 
        
        // 3. Verify DB was NEVER called
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('should rollback Redis if DB transaction fails (DB Error Handling)', async () => {
        // Mock Redis state: 10 tickets remaining
        await redisClient.set('ticket_remaining:tt-123', '10');

        // Mock DB Transaction to throw Error
        prismaMock.$transaction.mockRejectedValue(new Error('Simulated DB Crash'));

        await createOrder(mockReq as Request, mockRes as Response);

        // 1. Verify Error response
        expect(mockStatus).toHaveBeenCalledWith(400);
        expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Hệ thống đang bận hoặc có lỗi cơ sở dữ liệu. Vui lòng thử lại sau.'
        }));

        // 2. Verify Redis Rollback (INCR) happened!
        // It drops to 8, but since DB failed, it must roll back to 10
        const remaining = await redisClient.get('ticket_remaining:tt-123');
        expect(remaining).toBe('10');
    });
});
