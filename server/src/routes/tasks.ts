import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { store } from '../services/store.js';
import { Task } from '../types/index.js';

const router = Router();

const createTaskSchema = z.object({
  instruction: z.string().min(1, 'Task instruction cannot be empty').trim(),
  category: z.string().optional().default('General Marketing')
});

// GET /api/tasks/stats - Real dashboard statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await store.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks - List all tasks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await store.getTasks();
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id - Get specific task
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await store.getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks - Create a new task
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instruction, category } = createTaskSchema.parse(req.body);

    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      instruction,
      category,
      status: 'pending',
      startTime: new Date().toISOString(),
      plan: [],
      steps: []
    };

    const saved = await store.saveTask(newTask);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

export default router;
