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
      const jsonMatch = bodyString.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;

      const data = JSON.parse(jsonMatch[0]);

      console.log('--- 📸 FACE-ID PUSH EVENT ---');
      console.log(JSON.stringify(data, null, 2));
      console.log('-----------------------------');

      const ace = data.AccessControllerEvent;
      if (!ace) return;

      const rawPhone = ace.employeeNoString;
      const cleanPhone = String(rawPhone).replace(/\D/g, '');
      const phoneSuffix = cleanPhone.slice(-9);

      const employeeName = ace.name;
      const macAddress = data.macAddress;
      const deviceName = ace.deviceName || `Branch ${macAddress}`;

      // Filialni topish yoki yaratish
      let branch = await Branch.findOne({ where: { name: deviceName } });
      if (!branch) {
        branch = await Branch.create({ code: deviceName, name: deviceName });
      }

      // Xodimni telefon raqami orqali topish
      let employee = await Employee.findOne({
        where: { phone: { [Op.like]: `%${phoneSuffix}` } }
      });

      if (!employee) {
        console.log(`⚠️ Yangi xodim push orqali: ${employeeName} (${cleanPhone})`);
        employee = await Employee.create({
          personId: cleanPhone,
          fullName: employeeName || `User ${cleanPhone}`,
          phone: cleanPhone,
          branchId: branch.id,
          isActive: true
        });
      } else {
        const updates: any = {};
        if (employee.phone !== cleanPhone) updates.phone = cleanPhone;
        if (employee.branchId !== branch.id) updates.branchId = branch.id;
        if (Object.keys(updates).length > 0) await employee.update(updates);
      }

      // Vaqtni aniqlash
      let eventDate: Date;
      if (data.dateTime) {
        eventDate = new Date(String(data.dateTime));
      } else {
        eventDate = new Date();
      }

      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(eventDate);
      const timeInt = parseInt(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })
          .format(eventDate).replace(':', ''), 10
      );

      let attendance = await Attendance.findOne({ where: { employeeId: employee.id, date: dateStr } });

      if (!attendance) {
        // Birinchi marta — CHECK IN
        const workStartTimeInt = parseInt((branch.workStart || '08:00').replace(':', ''), 10);
        const isLate = timeInt > workStartTimeInt;

        await Attendance.create({
          employeeId: employee.id,
          date: dateStr,
          checkIn: eventDate,
          checkOut: null,
          isLate,
          wasPresent: true,
          expectedStartTime: branch.workStart || '08:00',
          locationCode: deviceName,
          personId: employee.personId,
          attendanceStatus: ace.attendanceStatus || 'checkIn'
        });
        console.log(`✅ ${employee.fullName} Kirdi (push, expected: ${branch.workStart || '08:00'}).`);

      } else {
        // Mavjud rekordni yangilash logicasi (Polling bilan bir xil)
        const currentCheckIn = new Date(attendance.checkIn as any);
        const updatePayload: any = {};

        // 1. Agar yangi event mavjud checkIn'dan oldinroq bo'lsa -> checkIn'ni yangilaymiz
        if (eventDate.getTime() < currentCheckIn.getTime()) {
          // Eskisini checkOut'ga suramiz (agar bo'sh bo'lsa)
          if (!attendance.checkOut) updatePayload.checkOut = attendance.checkIn;
          
          updatePayload.checkIn = eventDate;
          const workStartTimeInt = parseInt((branch.workStart || '08:00').replace(':', ''), 10);
          updatePayload.isLate = timeInt > workStartTimeInt;
          console.log(`🔄 ${employee.fullName} Kelish vaqti yangilandi (oldinroq vaqt topildi).`);
        } 
        // 2. Agar yangi event checkIn'dan keyin bo'lsa -> checkOut'ni yangilaymiz
        else if (eventDate.getTime() > currentCheckIn.getTime()) {
          const currentCheckOut = attendance.checkOut ? new Date(attendance.checkOut as any).getTime() : 0;
          if (!attendance.checkOut || eventDate.getTime() > currentCheckOut) {
            updatePayload.checkOut = eventDate;
            console.log(`🚪 ${employee.fullName} Chiqish/Harakat vaqti yangilandi.`);
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          await attendance.update({
            ...updatePayload,
            attendanceStatus: ace.attendanceStatus || 'push'
          });
        }
      }

    } catch (err: any) {
      console.error('❌ Push event xatosi:', err.message);
    }
  });
});

export default router;
