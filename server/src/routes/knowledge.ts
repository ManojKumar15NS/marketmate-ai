import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';

const router = Router();
const KNOWLEDGE_FILE = path.resolve(__dirname, '../../data/knowledge.json');

export interface KnowledgeItem {
  id: string;
  category: 'Company Profile' | 'Brand Guidelines' | 'Target Audience & ICP' | 'Saved Research' | 'Product Offering';
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

async function getStoredKnowledge(): Promise<KnowledgeItem[]> {
  try {
    const raw = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveStoredKnowledge(items: KnowledgeItem[]): Promise<void> {
  const temp = `${KNOWLEDGE_FILE}.${Date.now()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(items, null, 2), 'utf-8');
  await fs.rename(temp, KNOWLEDGE_FILE);
}

const knowledgeItemSchema = z.object({
  category: z.enum([
    'Company Profile',
    'Brand Guidelines',
    'Target Audience & ICP',
    'Saved Research',
    'Product Offering'
  ]),
  title: z.string().min(2, 'Title cannot be empty').trim(),
  content: z.string().min(5, 'Content cannot be empty').trim(),
  tags: z.array(z.string()).optional()
});

// GET /api/knowledge - List all items
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await getStoredKnowledge();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/knowledge - Create or save item
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = knowledgeItemSchema.parse(req.body);
    const items = await getStoredKnowledge();

    const newItem: KnowledgeItem = {
      title: validated.title,
      content: validated.content,
      category: validated.category,
      tags: validated.tags,
      id: `kb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    items.unshift(newItem);
    await saveStoredKnowledge(items);

    res.status(201).json(newItem);
  } catch (err) {
    next(err);
  }
});

// GET /api/knowledge/:id - Get single item
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await getStoredKnowledge();
    const item = items.find(i => i.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Knowledge item not found' });
      return;
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/knowledge/:id - Delete item
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await getStoredKnowledge();
    const filtered = items.filter(i => i.id !== req.params.id);
    if (filtered.length !== items.length) {
      await saveStoredKnowledge(filtered);
      res.json({ success: true, message: 'Knowledge item removed' });
      return;
    }
    res.status(404).json({ error: 'Knowledge item not found' });
  } catch (err) {
    next(err);
  }
});

export default router;
