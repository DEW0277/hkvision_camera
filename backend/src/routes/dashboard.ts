import express from 'express';
import { getDashboardAttendance, getEmployeeStats } from '../services/reportService';

const router = express.Router();

router.get('/attendance', async (req: express.Request, res: express.Response) => {
  try {
    const { date, branch, search } = req.query;
    const rows = await getDashboardAttendance({
      date: date as string,
      branchName: branch as string,
      search: search as string,
    });
    res.json(rows);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /dashboard/attendance', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

router.get('/branches', async (req: express.Request, res: express.Response) => {
  try {
    const { Branch } = require('../models');
    const branches = await Branch.findAll({
      order: [['name', 'ASC']]
    });
    res.json(branches);
  } catch (err: any) {
    console.error('Error in /dashboard/branches', err);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

router.get('/employee-stats/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { days } = req.query;
    const nDays = days ? parseInt(String(days), 10) || 30 : 30;
    const stats = await getEmployeeStats(parseInt(String(id), 10), nDays);
    res.json(stats);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Error in /dashboard/employee-stats', err);
    res.status(500).json({ error: err.message || 'Failed to fetch employee stats' });
  }
});

export default router;

