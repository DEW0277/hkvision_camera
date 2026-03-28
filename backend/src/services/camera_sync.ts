import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);
import cron from 'node-cron';
import { Employee, Branch } from '../models'; 

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

export function initCronJobs() {
    // 1. Server ishga tushishi bilanoq avtomatik bir marta yuklab olish (Sizning server.ts scripti kabi)
    syncCameraUsersWithDB().catch(err => console.error("Initial Sync Xatosi:", err));

    // 2. Har kuni 24:00 (00:00) da Cron orqali takrorlash
    cron.schedule('0 0 * * *', async () => {
        await syncCameraUsersWithDB();
    }, {
        timezone: "Asia/Tashkent" 
    });
    
    console.log("⏰ [CRON JOB] Xodimlar ro'yxatini sinxronlashtirish har kuni soat 24:00 da ishlashga rejalashtirildi.");
}
