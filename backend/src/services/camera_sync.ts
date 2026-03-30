import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
const execPromise = util.promisify(exec);
import cron from 'node-cron';
import { Employee, Branch, Attendance } from '../models';

// ─── Camera Config ────────────────────────────────────────────────────────────
interface CameraConfig {
  name: string;
  ip: string;
  user: string;
  pass: string;
  startTime?: string;
  endTime?: string;
}

function loadCameras(): CameraConfig[] {
  try {
    const configPath = path.resolve(__dirname, '../../cameras.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const cameras: CameraConfig[] = JSON.parse(raw);
    const valid = cameras.filter(c => c.ip && !c.ip.includes('XX'));
    console.log(`📷 [CAMERAS] ${valid.length} ta kamera yuklandi: ${valid.map(c => c.name).join(', ')}`);
    return valid;
  } catch (err: any) {
    console.error(`❌ cameras.json o'qishda xatolik: ${err.message}`);
    return [];
  }
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────
async function getOrCreateBranch(name: string, startTime?: string, endTime?: string) {
  let branch = await Branch.findOne({ where: { name } });
  if (!branch) {
    branch = await Branch.create({ 
      code: name, 
      name,
      workStart: startTime || '08:00',
      workEnd: endTime || '18:00'
    });
    console.log(`🏢 [BRANCH] Yangi filial yaratildi: ${name}`);
  } else {
    // Agar vaqtlar o'zgargan bo'lsa, bazani yangilaymiz
    if (startTime && branch.workStart !== startTime) {
      await branch.update({ workStart: startTime });
    }
    if (endTime && branch.workEnd !== endTime) {
      await branch.update({ workEnd: endTime });
    }
  }
  return branch;
}

async function upsertEmployee(employeeNo: string, name: string, branchId: number) {
  const cleanPhone = String(employeeNo).replace(/\D/g, '');
  if (!cleanPhone) return;

  let employee = await Employee.findOne({ where: { personId: cleanPhone } });

  if (employee) {
    const updates: any = {};
    if (name && employee.fullName !== name) updates.fullName = name;
    if (!employee.isActive) updates.isActive = true;
    if (employee.branchId !== branchId) updates.branchId = branchId;
    if (Object.keys(updates).length > 0) {
      await employee.update(updates);
    }
  } else {
    await Employee.create({
      personId: cleanPhone,
      fullName: name || `User ${cleanPhone}`,
      phone: cleanPhone,
      branchId,
      isActive: true,
    });
    console.log(`👤 [DB] Yangi xodim qo'shildi: ${name} (${cleanPhone})`);
  }
}

// ─── Camera API Helpers ───────────────────────────────────────────────────────
async function fetchUsersFromCamera(cam: CameraConfig): Promise<any[]> {
  const allUsers: any[] = [];
  let position = 0;
  const limit = 30;
  let hasMore = true;

  while (hasMore) {
    const payload = JSON.stringify({
      UserInfoSearchCond: { searchID: '1', maxResults: limit, searchResultPosition: position },
    });
    const cmd = `curl -s --digest -u "${cam.user}:${cam.pass}" -X POST "http://${cam.ip}/ISAPI/AccessControl/UserInfo/Search?format=json" -H "Content-Type: application/json" -d '${payload}'`;

    try {
      const { stdout } = await execPromise(cmd);
      const parsed = JSON.parse(stdout);
      const result = parsed.UserInfoSearch || {};
      allUsers.push(...(result.UserInfo || []));
      hasMore = result.responseStatusStrg === 'MORE';
      if (hasMore) position += limit;
    } catch (err: any) {
      console.error(`❌ [${cam.name}] Xodim olishda xato: ${err.message}`);
      hasMore = false;
    }
  }
  return allUsers;
}

async function fetchEventsFromCamera(cam: CameraConfig, startTime: string, endTime: string): Promise<any[]> {
  const allEvents: any[] = [];
  let position = 0;
  const limit = 50;
  let hasMore = true;

  while (hasMore) {
    const payload = JSON.stringify({
      AcsEventCond: { searchID: '1', searchResultPosition: position, maxResults: limit, major: 5, minor: 75, startTime, endTime },
    });
    const cmd = `curl -s --digest -u "${cam.user}:${cam.pass}" -X POST "http://${cam.ip}/ISAPI/AccessControl/AcsEvent?format=json" -H "Content-Type: application/json" -d '${payload}'`;

    try {
      const { stdout } = await execPromise(cmd);
      const parsed = JSON.parse(stdout);
      const result = parsed.AcsEvent || {};
      allEvents.push(...(result.InfoList || []));
      hasMore = result.responseStatusStrg === 'MORE';
      if (hasMore) position += limit;
    } catch (err: any) {
      console.error(`❌ [${cam.name}] Event olishda xato: ${err.message}`);
      hasMore = false;
    }
  }
  return allEvents;
}

// ─── Sync Functions ───────────────────────────────────────────────────────────

/** cameras.json dagi BARCHA kameralardan xodimlarni DB ga sinxronlash */
export async function syncCameraUsersWithDB() {
  console.log(`\n[${new Date().toISOString()}] 🔄 Barcha kameralardan xodimlar sinxronlanmoqda...`);
  const cameras = loadCameras();
  if (cameras.length === 0) {
    console.log('⚠️  Hech qanday kamera topilmadi (cameras.json ni tekshiring).');
    return;
  }

  // Barcha kameralardan parallel ravishda xodim ma'lumotlarini olamiz
  const results = await Promise.allSettled(
    cameras.map(async (cam) => {
      const branch = await getOrCreateBranch(cam.name, cam.startTime, cam.endTime);
      const users = await fetchUsersFromCamera(cam);
      console.log(`📷 [${cam.name}] ${users.length} ta xodim topildi.`);
      for (const u of users) {
        await upsertEmployee(u.employeeNo, u.name, branch.id ?? 0);
      }
      return { cam, users };
    })
  );

  // Kamerada yo'q xodimlarni nofaol qilish
  const allCameraIds = new Set<string>();
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const u of r.value.users) {
        const clean = String(u.employeeNo).replace(/\D/g, '');
        if (clean) allCameraIds.add(clean);
      }
    }
  }

  const activeEmployees = await Employee.findAll({ where: { isActive: true } });
  let deactivated = 0;
  for (const emp of activeEmployees) {
    if (emp.personId && !allCameraIds.has(emp.personId)) {
      await emp.update({ isActive: false });
      deactivated++;
    }
  }

  console.log(`✅ Sinxronlash tugadi. Nofaol qilingan: ${deactivated} ta xodim.\n`);
}

/** cameras.json dagi BARCHA kameralardan bugungi davomatni o'qish */
export async function syncAttendanceFromCamera() {
  const cameras = loadCameras();
  if (cameras.length === 0) return;

  const today = new Date();
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  const end   = new Date(today); end.setHours(23, 59, 59, 999);
  const startTimeStr = start.toISOString().replace(/\.\d+Z$/, '+05:00');
  const endTimeStr   = end.toISOString().replace(/\.\d+Z$/, '+05:00');

  const allEmployees = await Employee.findAll();
  const empMap = new Map<string, any>();
  for (const e of allEmployees) {
    if (e.personId) empMap.set(e.personId, e);
  }

  let newRecords = 0;
  let updatedRecords = 0;

  // Barcha kameralardan parallel ravishda eventlarni olamiz
  const cameraResults = await Promise.allSettled(
    cameras.map(cam => fetchEventsFromCamera(cam, startTimeStr, endTimeStr))
  );

  for (let i = 0; i < cameraResults.length; i++) {
    const result = cameraResults[i];
    const cam = cameras[i];
    if (result.status === 'rejected') continue;

    const events = result.value;
    if (events.length === 0) continue;

    const branch = await getOrCreateBranch(cam.name, cam.startTime, cam.endTime);

    for (const evt of events) {
      const rawPhone = evt.employeeNoString;
      if (!rawPhone) continue;
      const cleanPhone = String(rawPhone).replace(/\D/g, '');
      if (!cleanPhone) continue;

      const employee = empMap.get(cleanPhone);
      if (!employee) continue;

      if (!evt.time) continue;
      const eventDate = new Date(String(evt.time));
      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(eventDate);

      let attendance = await Attendance.findOne({ where: { employeeId: employee.id, date: dateStr } });

      if (!attendance) {
        const timeInt = parseInt(
          new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })
            .format(eventDate).replace(':', ''), 10
        );
        const workStartTimeInt = parseInt((branch.workStart || '08:00').replace(':', ''), 10);
        
        await Attendance.create({
          employeeId: employee.id,
          date: dateStr,
          checkIn: eventDate,
          checkOut: null,
          isLate: timeInt > workStartTimeInt,
          wasPresent: true,
          expectedStartTime: branch.workStart || '08:00',
          locationCode: branch.name,
          personId: employee.personId,
          attendanceStatus: evt.attendanceStatus || 'checkIn',
        });
        newRecords++;
      } else {
        const currentCheckIn = new Date(attendance.checkIn as any);
        const updatePayload: any = {};

        if (eventDate.getTime() < currentCheckIn.getTime()) {
          if (!attendance.checkOut) updatePayload.checkOut = attendance.checkIn;
          updatePayload.checkIn = eventDate;
          const timeInt = parseInt(
            new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })
              .format(eventDate).replace(':', ''), 10
          );
          const workStartTimeInt = parseInt((branch.workStart || '08:00').replace(':', ''), 10);
          updatePayload.isLate = timeInt > workStartTimeInt;
        } else if (eventDate.getTime() > currentCheckIn.getTime()) {
          const currentCheckOut = attendance.checkOut ? new Date(attendance.checkOut as any).getTime() : 0;
          if (!attendance.checkOut || eventDate.getTime() > currentCheckOut) {
            updatePayload.checkOut = eventDate;
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          await attendance.update(updatePayload);
          updatedRecords++;
        }
      }
    }
  }

  if (newRecords > 0 || updatedRecords > 0) {
    console.log(`✅ [ATTENDANCE] Yangi: ${newRecords}, O'zgargan: ${updatedRecords}`);
  }
}

// ─── Cron Jobs ────────────────────────────────────────────────────────────────
export function initCronJobs() {
  // Server ishga tushishi bilan darhol sync
  syncCameraUsersWithDB().catch(err => console.error('Initial Sync xatosi:', err));
  syncAttendanceFromCamera().catch(err => console.error('Initial Attendance xatosi:', err));

  // Har kecha 00:00 da xodimlarni to'liq sinxronlash
  cron.schedule('0 0 * * *', () => syncCameraUsersWithDB(), { timezone: 'Asia/Tashkent' });

  // Har 2 daqiqada davomatni yangilash
  cron.schedule('*/2 * * * *', () => syncAttendanceFromCamera(), { timezone: 'Asia/Tashkent' });

  const cameras = loadCameras();
  console.log(`⏰ [CRON JOB] ${cameras.length} ta kamera uchun: davomat har 2 daqiqa, xodimlar har kecha sinxronlanadi.`);
}
