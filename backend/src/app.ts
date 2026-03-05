import express from 'express';
import cors from 'cors';
import reportsRouter from './routes/reports';
import dashboardRouter from './routes/dashboard';
import employeeRouter from './routes/employee';
import { initializeMockData } from './mock/generator';

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  })
);
app.use(express.json());

app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ ok: true });
});

app.use('/reports', reportsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/employee', employeeRouter);

initializeMockData()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Mock data initialized');
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize mock data', err);
  });

export default app;

