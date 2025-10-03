import express from 'express';
import {
  getAllTasks,
  getUnassignedTasks,
  getTaskById,
  createTask,
  updateTask,
  assignTask,
  unassignTask,
  deleteTask
} from '../controllers/taskController';
import { protect, isOrganisation } from '../middleware/auth';

const router = express.Router();

router.get('/', protect, getAllTasks);
router.get('/unassigned', protect, getUnassignedTasks);
router.get('/:id', protect, getTaskById);

router.post('/', protect, createTask);

router.delete('/:id', protect, deleteTask);

router.put('/:id', protect, updateTask);

router.put('/:id/assign', protect, assignTask);
router.put('/:id/unassign', protect, unassignTask);

export default router;