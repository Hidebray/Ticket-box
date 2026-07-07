import { createOrderSchema, webhookPayloadSchema } from '../types/validation.schemas';

describe('Validation Schemas', () => {
    describe('createOrderSchema', () => {
        it('should pass with valid data', () => {
            const data = {
                ticketTypeId: '123e4567-e89b-12d3-a456-426614174000',
                ticketIds: ['123e4567-e89b-12d3-a456-426614174001'],
            };
            const result = createOrderSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should fail with invalid UUID', () => {
            const data = {
                ticketTypeId: 'invalid-uuid',
                ticketIds: ['123e4567-e89b-12d3-a456-426614174001'],
            };
            const result = createOrderSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should fail if more than 10 tickets', () => {
            const data = {
                ticketTypeId: '123e4567-e89b-12d3-a456-426614174000',
                ticketIds: Array(11).fill('123e4567-e89b-12d3-a456-426614174001'),
            };
            const result = createOrderSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });
    
    describe('webhookPayloadSchema', () => {
        it('should validate status SUCCESS', () => {
            const result = webhookPayloadSchema.safeParse({ orderId: '123e4567-e89b-12d3-a456-426614174000', status: 'SUCCESS' });
            expect(result.success).toBe(true);
        });
        
        it('should fail on invalid status', () => {
            const result = webhookPayloadSchema.safeParse({ orderId: '123e4567-e89b-12d3-a456-426614174000', status: 'PENDING' });
            expect(result.success).toBe(false);
        });
    });
});
