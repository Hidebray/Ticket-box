import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient({});

// [STB-04] Tối ưu hiệu năng Database (Prisma)
// Gắn Prisma Client Extension để bắt và log Slow Queries (>100ms)
const extendedPrisma = prisma.$extends({
    query: {
        async $allOperations({ operation, model, args, query }) {
            const before = Date.now();
            const result = await query(args);
            const duration = Date.now() - before;

            if (duration > 100) {
                logger.warn(
                    { model, operation, duration },
                    '[SLOW QUERY]'
                );
            }
            return result;
        },
    },
});

export default extendedPrisma;
