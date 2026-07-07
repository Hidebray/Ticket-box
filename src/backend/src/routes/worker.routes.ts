import { Router } from 'express';
import { taskQueue } from '../queue';
import { importVipGuests } from '../workers/csv-import.worker';
import { requireInternalSecret } from '../middlewares/internal.middleware';
import path from 'path';

const router = Router();

// [SEC-04] Tất cả worker routes đều yêu cầu internal secret
router.use(requireInternalSecret);

// Endpoint 1: Trigger luồng chạy nền phân tích CSV (Stream API)
router.get('/trigger-csv', async (req, res) => {
    const { concertId, ticketTypeId } = req.query;

    if (!concertId || !ticketTypeId) {
        res.status(400).json({ message: 'Missing concertId or ticketTypeId in query' });
        return;
    }

    // [BUG-02] Dùng env var thay vì hardcode path — tránh crash khi deploy
    const csvPath = process.env.VIP_CSV_PATH || path.resolve(process.cwd(), '../../data/vip.csv');

    if (!require('fs').existsSync(csvPath)) {
        res.status(400).json({ message: `CSV file not found at: ${csvPath}. Set VIP_CSV_PATH env var.` });
        return;
    }

    // Khởi chạy ngầm không cần đợi kết quả trả về
    importVipGuests(csvPath, concertId as string, ticketTypeId as string)
        .then(() => console.log('[Worker] Import VIP success'))
        .catch(err => console.error('[Worker] Import VIP failed:', err));

    res.json({ message: 'CSV Import started in background. Check terminal logs.' });
});

// Endpoint 2: Đẩy 1 Job vào Message Queue (BullMQ) để chạy ngầm
router.post('/trigger-job', async (req, res) => {
    const { type, payload } = req.body;

    if (type === 'generate-ai-bio') {
        await taskQueue.add('generate-ai-bio', payload);
        res.json({ message: 'AI Bio Job Added to Queue' });
    } else if (type === 'send-email') {
        await taskQueue.add('send-email', payload);
        res.json({ message: 'Email Job Added to Queue' });
    } else {
        res.status(400).json({ message: 'Invalid job type' });
    }
});

export default router;
