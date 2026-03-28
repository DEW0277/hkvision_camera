import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);
import cron from 'node-cron';
import { Employee, Branch, Attendance } from '../models'; 

const IP = process.env.CAMERA_IP || "10.10.25.33";
const USER = process.env.CAMERA_USER || "admin";
const PASS = process.env.CAMERA_PASS || "aslzar2021";

const DatabaseService = {
  async upsertUser(employeeNo: string, name: string) {
    try {
      const cleanPhone = String(employeeNo).replace(/\D/g, ''); 
      if (!cleanPhone) return;

      let employee = await Employee.findOne({ where: { personId: cleanPhone } });

      if (employee) {
        let updated = false;
        // Faqat ismini yangilaymiz (agar bo'sh bo'lmasa)
        if (name && employee.fullName !== name) {
          employee.fullName = name;
          updated = true;
        }
        // Agar o'chirilgan bo'lsa yana qayta faollashtiramiz
        if (!employee.isActive) {
          employee.isActive = true;
          updated = true;
        }
        
        if (updated) {
          await employee.save();
          console.log(`[DB Yangilandi] Xodim INFO: ${cleanPhone} - ${name}`);
        }
      } else {
        // Yangi qo'shish
        let holdingBranch = await Branch.findOne({ where: { code: 'Holding' } });
        if (!holdingBranch) {
          holdingBranch = await Branch.create({ code: 'Holding', name: 'Holding (Auto-generated)' });
        }
        
        await Employee.create({
          personId: cleanPhone,
          fullName: name || `User ${cleanPhone}`,
          phone: cleanPhone,
          branchId: holdingBranch.id,
          isActive: true
        });
        console.log(`[DB Qo'shildi] Yangi Xodim: ${cleanPhone} - ${name}`);
      }
    } catch (err: any) {
      console.error(`[DB XATO] Xodimni DB ga yozishda xatolik: ${err.message}`);
    }
  }
};

async function fetchAllCameraUsers() {
    let allUsers: any[] = [];
    let position = 0;
    const limit = 30; 
    let hasMore = true;
    while (hasMore) {
        const payloadData = JSON.stringify({
            UserInfoSearchCond: {
                searchID: "1",
                maxResults: limit,
                searchResultPosition: position
            }
        });

        const curlCmd = `curl -s --digest -u "${USER}:${PASS}" -X POST "http://${IP}/ISAPI/AccessControl/UserInfo/Search?format=json" -H "Content-Type: application/json" -H "Accept: application/json" -d '${payloadData}'`;

        try {
            const { stdout } = await execPromise(curlCmd);
            const parsedData = JSON.parse(stdout);
            const searchResult = parsedData.UserInfoSearch || {};
            const users = searchResult.UserInfo || [];

            allUsers.push(...users);

            if (searchResult.responseStatusStrg === "MORE") {
                position += limit;
            } else {
                hasMore = false;
            }
        } catch (error: any) {
            console.error(`[XATO] Kamera (Curl) ulanishida xato qildi: ${error.message || error}`);
            hasMore = false;
        }
    }
    return allUsers;
}

export async function syncCameraUsersWithDB() {
    console.log(`[${new Date().toISOString()}] Kameradan xodimlarni olish boshlandi...`);
    const users = await fetchAllCameraUsers();
    
    if (users.length > 0) {
        console.log(`[QURILMA] Jami ${users.length} ta xodim topildi. Bazaga sinxronizatsiya qilinmoqda...`);
        
        const cameraEmployeeMap = new Set<string>();
        
        for (const u of users) {
             const cleanPhone = String(u.employeeNo).replace(/\D/g, ''); 
             if (cleanPhone) cameraEmployeeMap.add(cleanPhone);
             await DatabaseService.upsertUser(u.employeeNo, u.name);
        }
        
        // Bazada bor, lekin kameradan o'chib ketgan (ishdan ketgan) xodimlarni nofaol qilish
        const activeEmployees = await Employee.findAll({ where: { isActive: true } });
        let deactivatedCount = 0;
        
        for (const emp of activeEmployees) {
            if (emp.personId && !cameraEmployeeMap.has(emp.personId)) {
                await emp.update({ isActive: false });
                console.log(`[DB O'chirilgan] Xodim kamerada topilmadi, va faollikdan olindi: ${emp.fullName} (${emp.personId})`);
                deactivatedCount++;
            }
        }
        
        console.log(`✅ Ma'lumotlar bazasi muvaffaqiyatli sinxronlashtirildi. O'chirilgan (Nofaol) xodimlar soni: ${deactivatedCount}`);
    } else {
        console.log("ℹ️ Hech qanday xodim topilmadi (yoki ulanish xatosi).");
    }
}

async function fetchCameraEvents(startTime: string, endTime: string) {
    let allEvents: any[] = [];
    let position = 0;
    const limit = 30; 
    let hasMore = true;

    while (hasMore) {
        const payloadData = JSON.stringify({
            AcsEventCond: {
                searchID: "1",
                searchResultPosition: position,
                maxResults: limit,
                major: 5,
                minor: 75,
                startTime,
                endTime
            }
        });

        const curlCmd = `curl -s --digest -u "${USER}:${PASS}" -X POST "http://${IP}/ISAPI/AccessControl/AcsEvent?format=json" -H "Content-Type: application/json" -H "Accept: application/json" -d '${payloadData}'`;

        try {
            const { stdout } = await execPromise(curlCmd);
            const parsedData = JSON.parse(stdout);
            const searchResult = parsedData.AcsEvent || {};
            const events = searchResult.InfoList || [];
            allEvents.push(...events);

            if (searchResult.responseStatusStrg === "MORE") {
                position += limit;
            } else {
                hasMore = false;
            }
        } catch (error: any) {
            console.error(`[XATO] Kamera Event (Curl) ulanishida xato: ${error.message || error}`);
            hasMore = false;
        }
    }
    return allEvents;
}

export async function syncAttendanceFromCamera() {
    try {
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        // Sanani to'g'ri formatga o'tkazish (YYYY-MM-DDTHH:MM:SS+05:00)
        const startTimeStr = startOfDay.toISOString().replace(/\.\d+Z$/, '+05:00');
        const endTimeStr = endOfDay.toISOString().replace(/\.\d+Z$/, '+05:00');

        const events = await fetchCameraEvents(startTimeStr, endTimeStr);
        if (events.length === 0) return;

        const activeEmployees = await Employee.findAll();
        const empMap = new Map();
        for (const e of activeEmployees) empMap.set(e.personId, e);

        const defaultBranch = await Branch.findOne({ where: { name: 'Главный офис' } });

        let newRecords = 0;
        let updatedRecords = 0;

        for (const evt of events) {
            const rawPhone = evt.employeeNoString;
            if (!rawPhone) continue;
            
            const cleanPhone = String(rawPhone).replace(/\D/g, '');
            if (!cleanPhone) continue;
            
            const employee = empMap.get(cleanPhone);
            if (!employee) continue;

            if (!evt.time) continue;
            const rawTime = String(evt.time);
            const hasTimezone = /[Z+\-]\d{2}:?\d{2}$/.test(rawTime) || rawTime.endsWith('Z');
            const eventDate = hasTimezone ? new Date(rawTime) : new Date(rawTime + '+05:00');

            const tashkentOffset = 5 * 60;
            const localTime = new Date(eventDate.getTime() + tashkentOffset * 60 * 1000);
            const dateStr = localTime.toISOString().slice(0, 10);

            let attendance = await Attendance.findOne({ where: { employeeId: employee.id, date: dateStr } });

            if (!attendance) {
                await Attendance.create({
                    employeeId: employee.id,
                    date: dateStr,
                    checkIn: eventDate,
                    checkOut: null,
                    isLate: localTime.getUTCHours() > 8 || (localTime.getUTCHours() === 8 && localTime.getUTCMinutes() > 0), // 08:00
                    wasPresent: true,
                    expectedStartTime: '08:00',
                    locationCode: defaultBranch?.name || 'Camera',
                    personId: employee.personId,
                    attendanceStatus: evt.attendanceStatus || 'checkIn'
                });
                newRecords++;
            } else {
                const currentCheckIn = new Date(attendance.checkIn as any);
                let updatePayload: any = {};
                
                // Eng birinchi vaqt kirish, eng so'ngi vaqt chiqish hisoblanadi.
                if (eventDate.getTime() < currentCheckIn.getTime()) {
                    if (!attendance.checkOut) updatePayload.checkOut = attendance.checkIn;
                    updatePayload.checkIn = eventDate;
                    
                    const earlyLocalTime = new Date(eventDate.getTime() + tashkentOffset * 60 * 1000);
                    updatePayload.isLate = earlyLocalTime.getUTCHours() > 8 || (earlyLocalTime.getUTCHours() === 8 && earlyLocalTime.getUTCMinutes() > 0);
                } else if (eventDate.getTime() > currentCheckIn.getTime()) {
                    if (!attendance.checkOut || eventDate.getTime() > new Date(attendance.checkOut as any).getTime()) {
                        updatePayload.checkOut = eventDate;
                    }
                }
                
                if (Object.keys(updatePayload).length > 0) {
                    await attendance.update(updatePayload);
                    updatedRecords++;
                }
            }
        }
        
        if (newRecords > 0 || updatedRecords > 0) {
            console.log(`✅ [ATTENDANCE] Davomat jurnali yangilandi. Yangi: ${newRecords}, O'zgargan: ${updatedRecords}`);
        }
    } catch (err: any) {
        console.error("Davomat sinxronizatsiyasida xatolik:", err.message);
    }
}

export function initCronJobs() {
    // 1. Server ishga tushishi bilanoq avtomatik yuklab olish
    syncCameraUsersWithDB().catch(err => console.error("Initial Sync Xatosi:", err));
    syncAttendanceFromCamera().catch(err => console.error("Initial Attendance Sync xatosi:", err));

    // 2. Tunda Xodimlar ro'yxatini to'liq sinxronlash (00:00)
    cron.schedule('0 0 * * *', async () => {
        await syncCameraUsersWithDB();
    }, {
        timezone: "Asia/Tashkent" 
    });
    
    // 3. Har 2 daqiqada FaceID jurnalidan yangi davomatlarni o'qib kelish
    cron.schedule('*/2 * * * *', async () => {
        await syncAttendanceFromCamera();
    }, {
        timezone: "Asia/Tashkent" 
    });
    
    console.log("⏰ [CRON JOB] Davomat o'qish har 2 daqiqaga, jami foydalanuvchilar obunasi har tunga sozlandi.");
}
