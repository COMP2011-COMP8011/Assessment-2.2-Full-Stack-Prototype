import { Router } from 'express';
import { login, register } from '../controllers/authController.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/schemas.js';

const router = Router();
router.use(authRateLimiter);
router.post('/register', validate({ body: registerSchema }), register);
router.post('/login', validate({ body: loginSchema }), login);

export default router;
