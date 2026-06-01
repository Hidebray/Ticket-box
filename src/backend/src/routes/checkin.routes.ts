import { Router } from 'express';
import { syncDown, syncUp } from '../controllers/checkin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Only STAFF can sync check-in data
router.get('/sync-down', authenticate, authorize(['STAFF']), syncDown);
router.post('/sync-up', authenticate, authorize(['STAFF']), syncUp);

export default router;
