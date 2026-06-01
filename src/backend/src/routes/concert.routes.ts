import { Router } from 'express';
import { getConcerts, getConcertDetails, getZoneTickets } from '../controllers/concert.controller';

const router = Router();

// Public endpoints
router.get('/', getConcerts);
router.get('/:id', getConcertDetails);
router.get('/:id/zones/:ticketTypeId/tickets', getZoneTickets);

export default router;
