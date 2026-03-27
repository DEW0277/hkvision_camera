require('dotenv').config();

import app from './app';
import { initCronJobs } from './services/camera_sync';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`HR-Monitor backend listening on port ${PORT}`);
  
  // Hikvision kamerasidan ma'lumot olish krosni yoqamiz
  initCronJobs();
});

