import { Router } from 'express';
import { getMe, updateMe } from '../controllers/userController.js';
import { validate } from '../middleware/validate.js';
import { updateMeSchema } from '../validators/schemas.js';

// Mounted at /users behind requireAuth.
const router = Router();
router.route('/me').get(getMe).patch(validate({ body: updateMeSchema }), updateMe);

export default router;
