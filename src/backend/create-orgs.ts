import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const saltRounds = 10;
    const password = await bcrypt.hash('123456', saltRounds);

    await prisma.users.upsert({
        where: { email: 'org1@gmail.com' },
        update: {},
        create: {
            email: 'org1@gmail.com',
            password,
            role: 'ORGANIZER'
        }
    });

    await prisma.users.upsert({
        where: { email: 'org2@gmail.com' },
        update: {},
        create: {
            email: 'org2@gmail.com',
            password,
            role: 'ORGANIZER'
        }
    });

    console.log('Organizers created successfully');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
