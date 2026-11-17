import { Router } from 'express';
import prisma from '../config/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'OK',
      message: 'ShoppingMarket API is running',
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'ERROR',
      message: 'API is running but the database is unavailable',
      database: 'disconnected',
    });
  }
});

export default router;
