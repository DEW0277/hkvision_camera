import express from 'express';
import { getDashboardAttendance } from '../services/reportService';

const router = express.Router();

router.get('/attendance', async (req: express.Request, res: express.Response) => {
  try {
    const { date, branch, search } = req.query;
    const rows = await getDashboardAttendance({
      date: date as string,
      branchCode: branch as string,
      search: search as string,
    });
    res.json(rows);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /dashboard/attendance', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

export default router;

