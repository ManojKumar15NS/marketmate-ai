import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { store } from '../services/store.js';
import { Conversation } from '../types/index.js';

const router = Router();

const createConversationSchema = z.object({
  title: z.string().optional(),
  category: z.string().optional()
});

// GET /api/conversations - List all conversations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await store.getConversations();
    // Return summaries for list views
    const summaries = list.map(c => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
      lastMessage: c.messages[c.messages.length - 1]?.content.substring(0, 100) || '',
      category: c.metadata?.category || 'general'
    }));
    res.json(summaries);
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id - Get single conversation
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conv = await store.getConversation(req.params.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json(conv);
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations - Create new conversation
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, category } = createConversationSchema.parse(req.body);
    const newConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title || 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      metadata: {
        category: category || 'general'
      }
    };

    const saved = await store.saveConversation(newConv);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = await store.deleteConversation(req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
