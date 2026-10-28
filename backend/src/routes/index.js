import { Router } from 'express';
import { health } from '../controllers/healthController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import authRoutes from './authRoutes.js';
import partyRoutes from './partyRoutes.js';
import { myTasksRouter } from './taskRoutes.js';
import userRoutes from './userRoutes.js';

// RESTful API (Assessment 1 §4). Public: /health and /auth. Everything else needs a JWT.
const api = Router();

api.get('/health', health);
api.use('/auth', authRoutes);
api.use('/users', requireAuth, userRoutes);
api.use('/parties', requireAuth, partyRoutes);
api.use('/tasks', requireAuth, myTasksRouter);

export default api;
