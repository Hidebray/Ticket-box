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

    console.log('Clearing database...');
    await prisma.tickets.deleteMany();
    await prisma.orders.deleteMany();
    await prisma.ticket_types.deleteMany();
    await prisma.concerts.deleteMany();
    await prisma.users.deleteMany();

    console.log('Seeding users...');

    const defaultPassword = '$2b$10$6cRyhlDW0tm3mlUvSZuPp.W795zf0DA.WDevg6hyTN37P4lL51QTe'; // 123456
    const adminPassword = await bcrypt.hash('admin123', 10);

    // Tạo Admin, Organizer và Audience
    const admin = await prisma.users.create({
        data: {
            email: 'admin@ticketbox.com',
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

    const audience = await prisma.users.create({
        data: {
            email: 'audience@ticketbox.vn',
            password: defaultPassword,
            role: 'AUDIENCE'
        }
    });

    console.log('Seeding concerts & ticket types...');
    const concertsData = [
        {
            name: "Sơn Tùng M-TP: SKY TOUR 2026",
            description: "Chuyến lưu diễn bùng nổ nhất năm của Sơn Tùng M-TP tại SVĐ Mỹ Đình với quy mô sân khấu chuẩn quốc tế 360 độ.",
            start_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "PUBLISHED",
            organizer_id: organizer.id
        },
        {
            name: "Lofi Chill Night: Đen Vâu & Vũ.",
            description: "Đêm nhạc acoustic mộc mạc và sâu lắng giữa lòng Đà Lạt mộng mơ, nơi những trái tim cô đơn tìm thấy nhau qua âm nhạc.",
            start_time: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            status: "PUBLISHED",
            organizer_id: organizer.id
        }
    ];

    for (const c of concertsData) {
        const concert = await prisma.concerts.create({
            data: c
        });

        // Tạo Ticket Types
        const vvip = await prisma.ticket_types.create({
            data: { concert_id: concert.id, name: "VVIP (Giao lưu nghệ sĩ)", total_quantity: 50, max_per_user: 2, price: 10000000 }
        });
        const vip = await prisma.ticket_types.create({
            data: { concert_id: concert.id, name: "VIP (Khán Đài Fanzone)", total_quantity: 100, max_per_user: 4, price: 3000000 }
        });
        const ga = await prisma.ticket_types.create({
            data: { concert_id: concert.id, name: "GA (Khu Vực Đứng)", total_quantity: 100, max_per_user: 4, price: 800000 }
        });

        // Cấu hình Sơ đồ Ghế Động mới cho 3 hạng vé
        const seatingMap: Record<string, any> = {};
        const allTicketsToInsert = [];

        const zones = [
            { type: vvip, rows: 5, cols: 10 },
            { type: vip, rows: 10, cols: 10 },
            { type: ga, rows: 10, cols: 10 }
        ];

        for (const zone of zones) {
            seatingMap[zone.type.id] = { rows: zone.rows, cols: zone.cols, disabledSeats: [] };

            for (let r = 0; r < zone.rows; r++) {
                const rowLabel = getRowLabel(r);
                for (let c = 0; c < zone.cols; c++) {
                    allTicketsToInsert.push({
                        ticket_type_id: zone.type.id,
                        seat_label: `${rowLabel}${c + 1}`,
                        status: 'AVAILABLE',
                        qr_code: crypto.randomUUID()
                    });
                }
            }
        }

        // Cập nhật Seating Map vào Concert
        await prisma.concerts.update({
            where: { id: concert.id },
            data: { seating_map: seatingMap }
        });

        // Batch Insert Tickets (Tạo ghế vật lý thực tế)
        await prisma.tickets.createMany({
            data: allTicketsToInsert
        });

        console.log(`Created concert ${concert.name} with dynamic seating map and tickets!`);
    }

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
