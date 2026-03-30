require('dotenv').config();

import app from './app';
import { initCronJobs } from './services/camera_sync';
import sequelize from './db';
import './models';

const PORT = process.env.PORT || 4000;

sequelize.sync({ alter: true }).then(() => {
  app.listen(PORT, () => {
    console.log(`HR-Monitor backend listening on port ${PORT}`);
    initCronJobs();
  });
}).catch(err => {
  console.error('DATABASE SYNC ERROR:', err);
});

