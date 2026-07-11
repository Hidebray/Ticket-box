import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient({});

// Hàm chuyển số thành chữ cái (0 -> A, 1 -> B, 26 -> AA)
function getRowLabel(index: number) {
    let label = '';
    let temp = index;
    while (temp >= 0) {
        label = String.fromCharCode((temp % 26) + 65) + label;
        temp = Math.floor(temp / 26) - 1;
    }
    return label;
}

async function main() {
    console.log('Running database migrations...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('AUDIENCE', 'ORGANIZER', 'STAFF', 'SUPER_ADMIN'));
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE concerts ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES users(id) ON DELETE RESTRICT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES users(id) ON DELETE RESTRICT;
    `);

    console.log('Clearing database...');
    await prisma.tickets.deleteMany();
    await prisma.orders.deleteMany();
    await prisma.ticket_types.deleteMany();
    await prisma.concerts.deleteMany();
    await prisma.users.deleteMany();

    console.log('Seeding users...');

    const defaultPassword = '$2b$10$6cRyhlDW0tm3mlUvSZuPp.W795zf0DA.WDevg6hyTN37P4lL51QTe'; // 123456
    const adminPassword = await bcrypt.hash('admin123', 10);

    // Tạo Admin, Organizer, Audience, Staff và Extra Organizers
    const admin = await prisma.users.create({
        data: {
            email: 'admin@ticketbox.vn',
            password: adminPassword,
            role: 'SUPER_ADMIN'
        }
    });

    const organizer = await prisma.users.create({
        data: {
            email: 'organizer@ticketbox.vn',
            password: defaultPassword,
            role: 'ORGANIZER'
        }
    });

    const organizer2 = await prisma.users.create({
        data: {
            email: 'organizer2@ticketbox.vn',
            password: defaultPassword,
            role: 'ORGANIZER'
        }
    });

    const audience = await prisma.users.create({
        data: {
            email: 'audience@ticketbox.vn',
            password: defaultPassword,
            role: 'AUDIENCE'
        }
    });

    const staff = await prisma.users.create({
        data: {
            email: 'staff@ticketbox.vn',
            password: defaultPassword,
            role: 'STAFF',
            organizer_id: organizer.id
        }
    });

    console.log('Seed completed successfully!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
