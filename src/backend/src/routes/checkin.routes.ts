import { Router } from 'express';
import { syncDown, syncUp, countTickets } from '../controllers/checkin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate, syncUpSchema } from '../types/validation.schemas';

const router = Router();

// Only STAFF can sync check-in data
router.get('/count', authenticate, authorize(['STAFF']), countTickets);
router.get('/sync-down', authenticate, authorize(['STAFF']), syncDown);
router.post('/sync-up', authenticate, authorize(['STAFF']), validate(syncUpSchema), syncUp);

export default router;
