import express from 'express';
import cors from 'cors';
import cameraRouter from './routes/camera';
import camerasRouter from './routes/cameras';
import reportsRouter from './routes/reports';
import dashboardRouter from './routes/dashboard';
import employeeRouter from './routes/employee';

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  })
);

// Kamera routerini express.json dan oldin qoldiramiz (raw body o'qish uchun)
app.use('/camera', cameraRouter);

app.use(express.json());

app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ ok: true });
});

app.use('/reports', reportsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/employee', employeeRouter);
app.use('/cameras', camerasRouter);

export default app;
