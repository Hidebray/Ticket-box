import { Router } from 'express';
import { taskQueue } from '../queue';
import { importVipGuests } from '../workers/csv-import.worker';
import path from 'path';

const router = Router();

// Endpoint 1: Trigger luồng chạy nền phân tích CSV (Stream API)
router.get('/trigger-csv', async (req, res) => {
    const { concertId, ticketTypeId } = req.query;

    if (!concertId || !ticketTypeId) {
        res.status(400).json({ message: 'Missing concertId or ticketTypeId in query' });
        return;
    }

    const filePath = path.join(__dirname, '../../../../src/data/vip.csv');
    
    // Khởi chạy ngầm không cần đợi kết quả trả về
    importVipGuests(filePath, concertId as string, ticketTypeId as string)
        .then(() => console.log('Import VIP success'))
        .catch(err => console.error('Import VIP failed:', err));
        
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
