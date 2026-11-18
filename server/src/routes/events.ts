import { Router, Request, Response, NextFunction } from 'express';
import { eventDiscoveryService } from '../tools/eventDiscoveryService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /api/events/search - Search events by keyword, location, category
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keyword, location, category, limit } = req.body;
    logger.info(`[EventsRoute] Search request: keyword="${keyword}", location="${location}", category="${category}", limit=${limit}`);

    const result = await eventDiscoveryService.searchEvents({
      keyword: typeof keyword === 'string' ? keyword : undefined,
      location: typeof location === 'string' ? location : undefined,
      category: typeof category === 'string' ? category : undefined,
      limit: typeof limit === 'number' && limit > 0 ? limit : 100
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    logger.error('[EventsRoute] Search error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to search events.'
    });
  }
});

// GET /api/events - Alternative query parameters search
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keyword, location, category, limit } = req.query;

    const result = await eventDiscoveryService.searchEvents({
      keyword: typeof keyword === 'string' ? keyword : undefined,
      location: typeof location === 'string' ? location : undefined,
      category: typeof category === 'string' ? category : undefined,
      limit: limit ? parseInt(limit as string, 10) : 100
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/events/categories - List standard categories
router.get('/categories', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      'Eye Care & Optometry',
      'Orthopedics & Joint Surgery',
      'Cardiology & Heart Care',
      'Oncology & Cancer Care',
      'Hospital & Healthcare',
      'Startups & Funding',
      'Business & B2B',
      'Enterprise Tech & AI',
      'Manufacturing & Trade'
    ]
  });
});

export default router;
