import { Op } from 'sequelize';
import sequelize from '../db';
import { Branch, Employee, Attendance, Excuse } from '../models';

const BRANCHES = [
  { code: 'Andijon', name: 'Andijon' },
  { code: 'Bekobod', name: 'Bekobod' },
  { code: 'Chortoq', name: 'Chortoq' },
  { code: 'Holding', name: 'Holding' },
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createDateWithTime(dateOnly: string, hour: number, minute: number) {
  const d = new Date(dateOnly);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function isLate(checkInDate: Date | null | string, threshold = '08:00') {
  if (!checkInDate) return false;
  const [h, m] = threshold.split(':').map((x) => parseInt(x, 10));
  const t = new Date(checkInDate);
  if (t.getHours() > h) return true;
  if (t.getHours() === h && t.getMinutes() > m) return true;
  return false;
}

async function seedBranches() {
  const count = await Branch.count();
  if (count > 0) return;

  await Branch.bulkCreate(BRANCHES);
}

const SAMPLE_LAST_NAMES = [
  'Каримов',
  'Саидов',
  'Ахмедов',
  'Нурматов',
  'Исмоилов',
  'Рахмонов',
  'Абдуллаев',
  'Юсупов',
  'Тошпулатов',
  'Собиров',
];

const SAMPLE_FIRST_NAMES = [
  'Алижон',
  'Бехруз',
  'Дилшод',
  'Мансур',
  'Шахзода',
  'Сардор',
  'Азиза',
  'Мадина',
  'Фарход',
  'Жахонгир',
];

async function seedEmployees(minEmployees = 50) {
  const count = await Employee.count();
  if (count > 0) return; // Agar bazada bitta bo'lsa ham xodim bo'lsa, mock ma'lumot qo'shmaymiz

  const branches = await Branch.findAll();
  const employeesToCreate: any[] = [];
  ...

async function seedAttendanceDays(daysBack = 7) {
  const today = new Date();
  const startDate = new Date();
  // Har safar backend ishga tushganda oxirgi N kun uchun mock ma'lumotni
  // boshidan generatsiya qilamiz (MVP uchun qulayroq).
  startDate.setDate(today.getDate() - (daysBack - 1));

  const employees = await Employee.findAll({ where: { isActive: true } });
  const branches = await Branch.findAll();

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);

    // Eski yozuvlarni o'chirib, shu sana uchun ma'lumotni qayta yaratamiz
    await Attendance.destroy({ where: { date: dateStr } });
    await Excuse.destroy({ where: { date: dateStr } });

    const records: any[] = [];

    employees.forEach((emp: any) => {
      const presentRoll = Math.random();
      if (presentRoll < 0.1) {
        // 10% chance absent
        records.push({
          employeeId: emp.id,
          date: dateStr,
          checkIn: null,
          checkOut: null,
          wasPresent: false,
          isLate: false,
          expectedStartTime: '08:00',
          locationCode:
            branches.find((b: any) => b.id === emp.branchId)?.code || 'Unknown',
          personId: emp.personId,
        });
        return;
      }

      // Present: generate realistic times
      const hour = randomInt(7, 9);
      const minute = randomInt(0, 59);
      const checkIn = createDateWithTime(dateStr, hour, minute);

      const outHour = randomInt(17, 19);
      const outMinute = randomInt(0, 59);
      const checkOut = createDateWithTime(dateStr, outHour, outMinute);

      const locationCode =
        branches.find((b: any) => b.id === emp.branchId)?.code || 'Unknown';

      records.push({
        employeeId: emp.id,
        date: dateStr,
        checkIn,
        checkOut,
        wasPresent: true,
        isLate: isLate(checkIn),
        expectedStartTime: '08:00',
        locationCode,
        personId: emp.personId,
      });
    });

    if (records.length > 0) {
      await Attendance.bulkCreate(records);
    }

    // Mark some late employees as "warned" via Excuse
    const lateRecords = await Attendance.findAll({
      where: {
        date: dateStr,
        isLate: true,
      },
      include: [{ model: Employee }],
    });

    for (const rec of lateRecords as any[]) {
      if (Math.random() < 0.4) {
        // 40% of late employees notified
        // Ensure there is no existing excuse
        const existingExcuse = await Excuse.findOne({
          where: {
            employeeId: rec.employeeId,
            date: dateStr,
            type: 'late',
          },
        });
        if (!existingExcuse) {
          await Excuse.create({
            employeeId: rec.employeeId,
            date: dateStr,
            type: 'late',
            minutes: randomInt(10, 60),
            reason: 'Автоматически сгенерированное оправданное опоздание',
          });
        }
      }
    }
  }
}

export async function initializeMockData() {
  await sequelize.sync({ alter: true });

  await seedBranches();
  await seedEmployees(50);
  await seedAttendanceDays(7);
}



