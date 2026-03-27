import { request } from 'urllib';
import cron from 'node-cron';
import { Employee, Branch } from '../models'; 

const IP = process.env.CAMERA_IP || "192.168.11.88";
const USER = process.env.CAMERA_USER || "admin";
const PASS = process.env.CAMERA_PASS || "1q2w3e4R";

const DatabaseService = {
  async upsertUser(employeeNo: string, name: string) {
    try {
      const cleanPhone = String(employeeNo).replace(/\D/g, ''); 
      if (!cleanPhone) return;

      let employee = await Employee.findOne({ where: { personId: cleanPhone } });

      if (employee) {
        // Faqat ismini yangilaymiz (agar bo'sh bo'lmasa)
        if (name && employee.fullName !== name) {
          await employee.update({ fullName: name });
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
    const limit = 50; 
    let hasMore = true;
    while (hasMore) {
        const url = `http://${IP}/ISAPI/AccessControl/UserInfo/Search?format=json`;
        const payload = {
            UserInfoSearchCond: {
                searchID: "1",
                maxResults: limit,
                searchResultPosition: position
            }
        };
        try {
            const response = await request(url, {
                method: 'POST',
                digestAuth: `${USER}:${PASS}`,
                data: payload,
                contentType: 'json',
                dataType: 'json',
                timeout: 5000
            });
            if (response.status === 200) {
                const users = response.data?.UserInfoSearch?.UserInfo || [];
                allUsers.push(...users);
                if (users.length < limit) {
                    hasMore = false;
                } else {
                    position += limit;
                }
            } else {
                console.error(`[INFO] Kameradan holat (${position}-${position+limit}): ${response.status}`);
                hasMore = false;
            }
        } catch (error: any) {
            console.error(`[XATO] Kameradan ma'lumot olishda xatolik: ${error.message || error}`);
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
        
        for (const u of users) {
             await DatabaseService.upsertUser(u.employeeNo, u.name);
        }
        console.log("✅ Ma'lumotlar bazasi muvaffaqiyatli sinxronlashtirildi.");
    } else {
        console.log("ℹ️ Hech qanday xodim topilmadi (yoki ulanish xatosi).");
    }
}

export function initCronJobs() {
    cron.schedule('0 0 * * *', async () => {
        await syncCameraUsersWithDB();
    }, {
        timezone: "Asia/Tashkent" 
    });
    
    console.log("⏰ [CRON JOB] Xodimlar ro'yxatini sinxronlashtirish har kuni soat 24:00 da ishlashga rejalashtirildi.");
}
