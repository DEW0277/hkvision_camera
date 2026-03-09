import express from 'express';
import multer from 'multer';
import * as xml2js from 'xml2js';
import { Employee, Attendance } from '../models';

const router = express.Router();
const upload = multer();
const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });

// Multer middleware-ni alohida o'zgaruvchiga olamiz
const uploadHandler = upload.any();

router.post('/event', (req, res) => {
  // 1. Har doim Multer orqali o'tkazamiz
  uploadHandler(req, res, async (err) => {
    // Xato bo'lsa ham (Unexpected end of form kabi) baribir ichini tekshirib ko'ramiz
    if (err) {
      console.warn('Multer ogohlantirishi:', err.message);
    }

    console.log(`\n--- 🔔 Kiruvchi so'rov: [${new Date().toLocaleTimeString()}] ---`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', req.body);

    try {
      const data = req.body || {};
      
      // Hikvision odatda ma'lumotni 'AccessControllerEvent' yoki 'event_log' maydonida yuboradi
      let mainData = data['AccessControllerEvent'] || data['event_log'];
      let finalResult: any = null;

      if (mainData) {
        // Ma'lumot formatini aniqlash va parse qilish
        if (typeof mainData === 'string') {
          if (mainData.includes('<?xml')) {
            finalResult = await parser.parseStringPromise(mainData);
          } else if (mainData.trim().startsWith('{')) {
            finalResult = JSON.parse(mainData);
          } else {
            finalResult = mainData;
          }
        } else {
          finalResult = mainData;
        }

        console.log("👤 FaceID Ma'lumotlari:");
        console.dir(finalResult, { depth: null, colors: true });

        // Kerakli maydonlarni ajratib olamiz
        // Eslatma: finalResult ichidagi maydonlar nomini sizning rasmingizga qarab moslaymiz
        const personId = finalResult.employeeNoString || finalResult.employeeNo;
        const eventTime = data.dateTime || finalResult.eventTime || new Date();
        const deviceName = finalResult.deviceName || 'Camera';
        const status = finalResult.attendanceStatus || 'checkIn';

        if (personId) {
          const employee = await Employee.findOne({ where: { personId } });
          if (employee) {
            const eventDate = new Date(eventTime);
            const dateStr = eventDate.toISOString().slice(0, 10);
            
            let attendance = await Attendance.findOne({ where: { employeeId: employee.id, date: dateStr } });
            
            if (!attendance) {
              await Attendance.create({
                employeeId: employee.id,
                date: dateStr,
                checkIn: eventDate,
                checkOut: null,
                isLate: eventDate.getHours() >= 8 && eventDate.getMinutes() > 0,
                wasPresent: true,
                expectedStartTime: '08:00',
                locationCode: deviceName,
                personId: employee.personId,
                attendanceStatus: status
              });
              console.log(`✅ Bazaga yozildi: ${employee.fullName}`);
            } else {
              await attendance.update({ checkOut: eventDate, attendanceStatus: status });
              console.log(`✅ Yangilandi: ${employee.fullName}`);
            }
          } else {
            console.log(`❓ Xodim topilmadi: ${personId}`);
          }
        }
      } else {
        console.log("📦 Body bo'sh yoki kutilgan maydon topilmadi.");
      }

      // Har doim OK qaytaramiz
      res.status(200).send('OK');

    } catch (error: any) {
      console.error("❌ Xatolik:", error.message);
      res.status(200).send('OK');
    }
  });
});

export default router;
