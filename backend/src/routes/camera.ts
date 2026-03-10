import express from 'express';
import { Op } from 'sequelize';
import { Employee, Attendance, Branch } from '../models';

const router = express.Router();

router.post('/event', (req, res) => {
  // Kameraga darhol javob qaytaramiz
  res.status(200).json({ ok: true });

  let rawData = Buffer.alloc(0);

  req.on('data', (chunk) => {
    rawData = Buffer.concat([rawData, chunk]);
  });

  req.on('end', async () => {
    const bodyString = rawData.toString('utf-8');

    try {
      // 1. JSON qismini ajratib olish
      const jsonMatch = bodyString.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;

      const data = JSON.parse(jsonMatch[0]);

      // 2. Console-ga chiqarish (Siz so'raganingizdek)
      console.log('--- 📸 FACE-ID DATA ---');
      console.log(JSON.stringify(data, null, 2));
      console.log('-----------------------');

      const ace = data.AccessControllerEvent;
      if (!ace) return;

      const rawPhone = ace.employeeNoString; 
      const cleanPhone = String(rawPhone).replace(/\D/g, ''); // Faqat raqamlar
      const phoneSuffix = cleanPhone.slice(-9); // Oxirgi 9 ta raqam
      
      const employeeName = ace.name;
      const macAddress = data.macAddress; 
      const deviceName = ace.deviceName || `Branch ${macAddress}`; 

      // 1. Filialni aniqlash...
      let branch = await Branch.findOne({ where: { code: macAddress } });
      if (!branch) {
        branch = await Branch.create({ code: macAddress, name: deviceName });
      }

      // 2. Xodimni telefon raqamining OXIRGI 9 TA raqami orqali qidirish
      let employee = await Employee.findOne({ 
        where: { 
          phone: { [Op.like]: `%${phoneSuffix}` } 
        } 
      });

      if (!employee) {
        console.log(`⚠️ Yangi xodim: ${employeeName} (${cleanPhone})`);
        employee = await Employee.create({
          personId: cleanPhone,
          fullName: employeeName || `User ${cleanPhone}`,
          phone: cleanPhone,
          branchId: branch.id,
          isActive: true
        });
      } else {
        // Xodim topilsa, uning asosiy telefonini ham to'liq formatga yangilab qo'yamiz (ixtiyoriy)
        if (employee.phone !== cleanPhone) {
          await employee.update({ phone: cleanPhone });
        }
        if (employee.branchId !== branch.id) {
          await employee.update({ branchId: branch.id });
        }
      }


      const eventDate = new Date(data.dateTime || new Date());
      const dateStr = eventDate.toISOString().slice(0, 10);

      // 4. Davomatni yozish
      let attendance = await Attendance.findOne({ where: { employeeId: employee.id, date: dateStr } });

      if (!attendance) {
        await Attendance.create({
          employeeId: employee.id,
          date: dateStr,
          checkIn: eventDate,
          checkOut: null,
          isLate: eventDate.getHours() >= 8 && eventDate.getMinutes() > 0, // 08:00 dan keyin bo'lsa kechikish
          wasPresent: true,
          expectedStartTime: '08:00',
          locationCode: ace.deviceName || 'Camera',
          personId: employee.personId,
          attendanceStatus: ace.attendanceStatus || 'checkIn'
        });
        console.log(`✅ ${employee.fullName} Kirdi.`);
      } else {
        await attendance.update({
          checkOut: eventDate,
          attendanceStatus: ace.attendanceStatus || 'checkOut'
        });
        console.log(`✅ ${employee.fullName} Chiqdi / Harakat yangilandi.`);
      }

    } catch (err: any) {
      console.error('❌ Error handling camera data:', err.message);
    }
  });
});

export default router;
