import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
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
router.post('/concerts', createConcert);
router.put('/concerts/:id', updateConcert);

// Ticket Types
router.post('/ticket-types', createTicketType);

// Upload CSV Guests
router.post('/guests/upload', upload.single('file'), uploadGuestsCSV);
router.get('/guests/progress/:jobId', getUploadProgress);

// Upload PDF Artist Bio
router.post('/concerts/:id/upload-bio', upload.single('file'), uploadConcertBioPDF);

// Seating Map
router.post('/concerts/:id/zones/:ticketTypeId/seating', saveSeatingMap);

export default router;

