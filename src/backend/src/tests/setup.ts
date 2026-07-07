import { PrismaClient } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

import prisma from '../config/db';

jest.mock('../config/db', () => ({
    __esModule: true,
    default: mockDeep<PrismaClient>(),
}));

export const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
