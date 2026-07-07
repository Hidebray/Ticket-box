import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate, registerSchema, loginSchema } from '../types/validation.schemas';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

// Route test RBAC
router.get('/me', authenticate, (req: any, res) => {
    res.json({ user: req.user });
});

router.get('/admin-only', authenticate, authorize(['ORGANIZER']), (req, res) => {
    res.json({ message: 'Welcome Organizer!' });
});

export default router;
