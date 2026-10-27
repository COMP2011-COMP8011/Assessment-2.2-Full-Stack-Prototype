import { Router } from 'express';
import {
  addMember,
  createParty,
  deleteParty,
  getParty,
  getPartyStats,
  listParties,
  removeMember,
  updateParty,
} from '../controllers/partyController.js';
import { requirePartyMember, requirePartyOwner } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  addMemberSchema,
  createPartySchema,
  memberParamsSchema,
  partyParamsSchema,
  updatePartySchema,
} from '../validators/schemas.js';
import { partyTaskRouter } from './taskRoutes.js';

// Mounted at /parties behind requireAuth.
const router = Router();

router.route('/').get(listParties).post(validate({ body: createPartySchema }), createParty);

// Everything under /parties/:partyId (the party, its members and its tasks) needs a valid id
// and party membership — e.g. you can't fetch, create or delete tasks in a party you're not in.
router.use('/:partyId', validate({ params: partyParamsSchema }), requirePartyMember);

router
  .route('/:partyId')
  .get(getParty)
  .patch(requirePartyOwner, validate({ body: updatePartySchema }), updateParty)
  .delete(requirePartyOwner, deleteParty);

router.get('/:partyId/stats', getPartyStats);
router.post('/:partyId/members', validate({ body: addMemberSchema }), addMember);
router.delete('/:partyId/members/:userId', validate({ params: memberParamsSchema }), removeMember);
router.use('/:partyId/tasks', partyTaskRouter);

export default router;
