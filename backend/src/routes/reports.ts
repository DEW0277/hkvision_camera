import express from 'express';
import {
  getDailyReport,
  getDailyReportText,
  getDashboardStats,
} from '../services/reportService';

const router = express.Router();

router.get('/daily', async (req: express.Request, res: express.Response) => {
  try {
    const { date } = req.query;
    const data = await getDailyReport(date as string);
    res.json(data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /reports/daily', err);
    res.status(500).json({ error: 'Failed to build daily report' });
  }
});

router.get('/daily-text', async (req: express.Request, res: express.Response) => {
  try {
    const { date } = req.query;
    const text = await getDailyReportText(date as string);
    res.type('text/plain').send(text);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /reports/daily-text', err);
    res.status(500).json({ error: 'Failed to build daily report text' });
  }
});

router.get('/stats', async (req: express.Request, res: express.Response) => {
  try {
    const { days } = req.query;
    const nDays = days ? parseInt(days as string, 10) || 7 : 7;
    const stats = await getDashboardStats({ days: nDays });
    res.json(stats);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /reports/stats', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;

