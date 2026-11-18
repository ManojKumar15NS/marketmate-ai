import { Router, Request, Response, NextFunction } from 'express';
import { eventDiscoveryService } from '../tools/eventDiscoveryService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /api/events/search - Search events by keyword, location, category
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keyword, location, category, limit } = req.body;
    logger.info(`[EventsRoute] Search request received: keyword="${keyword}", location="${location}", limit=${limit}`);

    const result = await eventDiscoveryService.searchEvents({
      keyword: typeof keyword === 'string' ? keyword : undefined,
      location: typeof location === 'string' ? location : undefined,
      category: typeof category === 'string' ? category : undefined,
      limit: typeof limit === 'number' && limit > 0 ? limit : 50
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
      limit: limit ? parseInt(limit as string, 10) : 50
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
      'Doctor & Specialist Medical Conference',
      'Hospital Infrastructure & MedTech',
      'Hospital Equipment & Medical Devices',
      'Laboratory & Pathology',
      'Hospital Administration & Doctor Networking',
      'Doctor Conference & Oncology',
      'Enterprise Tech, AI & Biotech',
      'Enterprise Tech & AI',
      'Industrial Manufacturing & Automation'
    ]
  });
});

export default router;
