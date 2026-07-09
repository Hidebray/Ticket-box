const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        await prisma.$executeRawUnsafe('ALTER TABLE ticket_types DROP CONSTRAINT IF EXISTS ticket_types_total_quantity_check');
        console.log('Dropped constraint');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
