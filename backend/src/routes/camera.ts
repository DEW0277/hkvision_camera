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
        console.log(`⚠️ Bazada yo'q xodim (push e'tiborsiz qoldirildi): ${employeeName || 'Unknown'} (${cleanPhone})`);
        return;
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

      const label = (ace.label || '').toLowerCase();

      let attendance = await Attendance.findOne({ where: { employeeId: employee.id, date: dateStr } });

      if (!attendance) {
        // Yangi rekord yaratish
        const workStartTimeInt = parseInt((branch.workStart || '08:00').replace(':', ''), 10);
        const isLate = timeInt > workStartTimeInt;

        const createPayload: any = {
          employeeId: employee.id,
          date: dateStr,
          wasPresent: true,
          expectedStartTime: branch.workStart || '08:00',
          locationCode: deviceName,
          personId: employee.personId,
          attendanceStatus: label || ace.attendanceStatus || (label === 'ketdim' ? 'checkOut' : 'checkIn')
        };

        if (label === 'ketdim') {
          createPayload.checkIn = null;
          createPayload.checkOut = eventDate;
          createPayload.isLate = false; // Ketishda kechikish bo'lmaydi
        } else {
          // 'keldim' yoki boshqa holat (default checkIn)
          createPayload.checkIn = eventDate;
          createPayload.checkOut = null;
          createPayload.isLate = isLate;
        }

        await Attendance.create(createPayload);
        console.log(`✅ ${employee.fullName} ${label === 'ketdim' ? 'Ketdi' : 'Kirdi'} (push, label: ${label || 'auto'}).`);

      } else {
        // Mavjud rekordni yangilash
        const updatePayload: any = {};
        const currentCheckIn = attendance.checkIn ? new Date(attendance.checkIn as any) : null;
        const currentCheckOut = attendance.checkOut ? new Date(attendance.checkOut as any).getTime() : 0;

        if (label === 'keldim') {
          // Explicit Check-In
          if (!currentCheckIn || eventDate.getTime() < currentCheckIn.getTime()) {
            updatePayload.checkIn = eventDate;
            const workStartTimeInt = parseInt((branch.workStart || '08:00').replace(':', ''), 10);
            updatePayload.isLate = timeInt > workStartTimeInt;
          }
        } else if (label === 'ketdim') {
          // Explicit Check-Out
          if (!attendance.checkOut || eventDate.getTime() > currentCheckOut) {
            updatePayload.checkOut = eventDate;
          }
        } else {
          // Label yo'q bo'lsa - avvalgi vaqtga asoslangan mantiq
          if (currentCheckIn && eventDate.getTime() < currentCheckIn.getTime()) {
            if (!attendance.checkOut) updatePayload.checkOut = attendance.checkIn;
            updatePayload.checkIn = eventDate;
            const workStartTimeInt = parseInt((branch.workStart || '08:00').replace(':', ''), 10);
            updatePayload.isLate = timeInt > workStartTimeInt;
          } else if (currentCheckIn && eventDate.getTime() > currentCheckIn.getTime()) {
            if (!attendance.checkOut || eventDate.getTime() > currentCheckOut) {
              updatePayload.checkOut = eventDate;
            }
          } else if (!currentCheckIn) {
            // Agar faqat checkOut bo'lsa va yangi event kelsa (checkIn bo'lishi mumkin)
            updatePayload.checkIn = eventDate;
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          await attendance.update({
            ...updatePayload,
            attendanceStatus: label || ace.attendanceStatus || 'push'
          });
          console.log(`🔄 ${employee.fullName} ma'lumotlari yangilandi (${label || 'auto-update'}).`);
        }
      }

    } catch (err: any) {
      console.error('❌ Push event xatosi:', err.message);
    }
  });
});

export default router;
