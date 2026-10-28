import { Router } from 'express';
import { createTask, deleteTask, getTask, listMyTasks, listPartyTasks, updateTask } from '../controllers/taskController.js';
import { validate } from '../middleware/validate.js';
import { createTaskSchema, listTasksQuerySchema, taskParamsSchema, updateTaskSchema } from '../validators/schemas.js';

// Mounted at /parties/:partyId/tasks (after the party has been loaded and membership checked).
export const partyTaskRouter = Router({ mergeParams: true });

partyTaskRouter
  .route('/')
  .get(validate({ query: listTasksQuerySchema }), listPartyTasks)
  .post(validate({ body: createTaskSchema }), createTask);

partyTaskRouter
  .route('/:taskId')
  .all(validate({ params: taskParamsSchema }))
  .get(getTask)
  .patch(validate({ body: updateTaskSchema }), updateTask)
  .delete(deleteTask);

// Mounted at /tasks: quests across all of the signed-in user's parties.
export const myTasksRouter = Router();
myTasksRouter.get('/', validate({ query: listTasksQuerySchema }), listMyTasks);
