import express from 'express';
import fs from 'fs';
import path from 'path';
import { syncCameraUsersWithDB, syncAttendanceFromCamera } from '../services/camera_sync';

const router = express.Router();
const CAMERAS_PATH = path.resolve(__dirname, '../../cameras.json');

interface CameraConfig {
  name: string;
  ip: string;
  user: string;
  pass: string;
}

function readCameras(): CameraConfig[] {
  try {
    return JSON.parse(fs.readFileSync(CAMERAS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeCameras(cameras: CameraConfig[]) {
  fs.writeFileSync(CAMERAS_PATH, JSON.stringify(cameras, null, 2), 'utf-8');
}

// GET /cameras — barcha kameralarni ro'yxati (parolsiz)
router.get('/', (req, res) => {
  const cameras = readCameras().map(({ pass, ...rest }) => rest);
  res.json(cameras);
});

// POST /cameras — yangi kamera qo'shish
router.post('/', (req, res) => {
  const { name, ip, user, pass } = req.body;
  if (!name || !ip || !user || !pass) {
    res.status(400).json({ error: 'name, ip, user, pass majburiy maydonlar' });
    return;
  }
  const cameras = readCameras();
  if (cameras.find(c => c.ip === ip)) {
    res.status(409).json({ error: 'Bu IP allaqachon mavjud' });
    return;
  }
  cameras.push({ name, ip, user, pass });
  writeCameras(cameras);
  console.log(`➕ [CAMERA] Yangi kamera qo'shildi: ${name} (${ip})`);

  // Yangi kamerani darhol sync qilish
  syncCameraUsersWithDB().catch(err => console.error('Sync xatosi:', err));
  syncAttendanceFromCamera().catch(err => console.error('Attendance sync xatosi:', err));

  res.status(201).json({ ok: true, message: `${name} kamerasi qo'shildi va sinxronlash boshlandi` });
});

// DELETE /cameras/:ip — kamerani o'chirish
router.delete('/:ip', (req, res) => {
  const targetIp = decodeURIComponent(req.params.ip);
  const cameras = readCameras();
  const filtered = cameras.filter(c => c.ip !== targetIp);
  if (filtered.length === cameras.length) {
    res.status(404).json({ error: 'Kamera topilmadi' });
    return;
  }
  writeCameras(filtered);
  console.log(`🗑️  [CAMERA] Kamera o'chirildi: ${targetIp}`);
  res.json({ ok: true, message: 'Kamera o\'chirildi' });
});

// POST /cameras/sync — qo'lda sinxronlash
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 [MANUAL SYNC] Qo\'lda sinxronlash boshlandi...');
    await syncCameraUsersWithDB();
    await syncAttendanceFromCamera();
    res.json({ ok: true, message: 'Sinxronlash muvaffaqiyatli bajarildi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
