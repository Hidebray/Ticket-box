import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate, createConcertSchema, createTicketTypeSchema, seatingMapSchema } from '../types/validation.schemas';
import { 
    getAdminConcerts, 
    createConcert, 
    updateConcert, 
    createTicketType,
    getDashboardStats,
    uploadGuestsCSV,
    getUploadProgress,
    saveSeatingMap,
    uploadConcertBioPDF
} from '../controllers/admin.controller';

const router = Router();

// Tất cả các route trong này đều yêu cầu quyền ORGANIZER (Ban tổ chức)
router.use(authenticate, authorize(['ORGANIZER']));

import multer from 'multer';

const upload = multer({ dest: 'uploads/' });

// Dashboard
router.get('/dashboard', getDashboardStats);

// Concerts CRUD
router.get('/concerts', getAdminConcerts);
router.post('/concerts', validate(createConcertSchema), createConcert);
router.put('/concerts/:id', validate(createConcertSchema), updateConcert);

// Ticket Types
router.post('/ticket-types', validate(createTicketTypeSchema), createTicketType);

// Upload CSV Guests
router.post('/guests/upload', upload.single('file'), uploadGuestsCSV);
router.get('/guests/progress/:jobId', getUploadProgress);

// Upload PDF Artist Bio
router.post('/concerts/:id/upload-bio', upload.single('file'), uploadConcertBioPDF);

// Seating Map
router.post('/concerts/:id/zones/:ticketTypeId/seating', validate(seatingMapSchema), saveSeatingMap);

export default router;

