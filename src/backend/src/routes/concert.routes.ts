import { Router } from 'express';
import { getConcerts, getConcertDetails, getZoneTickets, streamZoneTickets, holdSeat, unholdSeat } from '../controllers/concert.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { strictLimiter } from '../middlewares/rate-limit.middleware';

const router = Router();

// Public endpoints
router.get('/', getConcerts);
router.get('/:id', getConcertDetails);
router.get('/:id/zones/:ticketTypeId/tickets', getZoneTickets);
router.get('/:id/zones/:ticketTypeId/stream-tickets', streamZoneTickets);

// Seat Holding endpoints
router.post('/:id/zones/:ticketTypeId/tickets/:ticketId/hold', strictLimiter, authenticate, authorize(['AUDIENCE']), holdSeat);
router.post('/:id/zones/:ticketTypeId/tickets/:ticketId/unhold', strictLimiter, authenticate, authorize(['AUDIENCE']), unholdSeat);

export default router;
