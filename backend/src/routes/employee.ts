import express from 'express';
import { Op } from 'sequelize';
import { Branch, Employee, Excuse } from '../models';

// eslint-disable-next-line no-console
console.log('employee routes loaded');

const router = express.Router();

async function findOrCreateEmployeeByTelegram({ telegramUserId, fullName }: { telegramUserId: string; fullName?: string }) {
  if (!telegramUserId) return null;

  let employee = await Employee.findOne({ where: { telegramUserId } });
  if (employee) return employee;

  // Fallback: attach to Holding branch by default
  const holdingBranch =
    (await Branch.findOne({ where: { code: 'Holding' } })) ||
    (await Branch.findOne());

  const personId = `TG${telegramUserId}`;

  employee = await Employee.create({
    personId,
    fullName: fullName || `Telegram User ${telegramUserId}`,
    telegramUserId,
    branchId: holdingBranch ? holdingBranch.id : null, 
    isActive: true,
  });

  return employee;
}

// Xodim kontaktini tekshirish (bot /start da)
router.get('/me', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId } = req.query;
    if (!telegramUserId) {
      return res.status(400).json({ error: 'telegramUserId is required' });
    }
    const employee = await Employee.findOne({
      where: { telegramUserId: String(telegramUserId) },
      attributes: ['id', 'fullName', 'phone', 'telegramUserId', 'language'],
    });
    if (!employee) {
      return res.json({ hasContact: false, language: null });
    }
    return res.json({
      hasContact: Boolean(employee.phone),
      fullName: employee.fullName,
      phone: employee.phone,
      language: employee.language,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /employee/me', err);
    return res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Tilni saqlash
router.post('/language', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId, language } = req.body;
    if (!telegramUserId || !language) {
      return res
        .status(400)
        .json({ error: 'telegramUserId and language are required' });
    }
    let employee = await findOrCreateEmployeeByTelegram({
      telegramUserId: String(telegramUserId),
    });
    if (employee) {
      await employee.update({ language });
    }
    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /employee/language', err);
    return res.status(500).json({ error: 'Failed to save language' });
  }
});

// Kontakt yuborilganda: telefon va ism-familiyani saqlash
router.post('/contact', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId, phone_number, first_name, last_name } = req.body;
    if (!telegramUserId || !phone_number) {
      return res.status(400).json({ error: 'telegramUserId and phone_number are required' });
    }

    const cleanPhone = String(phone_number).replace(/\s/g, '').replace('+', '');
    const fullName = [first_name, last_name].filter(Boolean).join(' ').trim();

    // 1. Avval shu telefon raqami bilan xodim bormi qidiramiz
    let employee = await Employee.findOne({ 
      where: { 
        phone: { [Op.like]: `%${cleanPhone.slice(-9)}%` } // Oxirgi 9 ta raqam bo'yicha qidirish (99890... yoki 90...)
      } 
    });

    if (employee) {
      // 2. Agar bo'lsa, uning Telegram ID-sini yangilaymiz
      await employee.update({
        telegramUserId: String(telegramUserId),
        ...(fullName && { fullName })
      });
    } else {
      // 3. Agar bo'lmasa, yangi xodim yaratamiz (Holding filialiga)
      employee = await findOrCreateEmployeeByTelegram({
        telegramUserId: String(telegramUserId),
        fullName: fullName || undefined,
      });
      await employee.update({
        phone: cleanPhone,
        ...(fullName && { fullName }),
      });
    }

    return res.json({ ok: true, fullName: employee.fullName, branchId: employee.branchId });
  } catch (err) {
    console.error('Error in /employee/contact', err);
    return res.status(500).json({ error: 'Failed to save contact' });
  }
});

router.post('/status/late', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId, fullName, minutes, reason, date } = req.body;
    if (!telegramUserId || !minutes) {
      return res
        .status(400)
        .json({ error: 'telegramUserId and minutes are required' });
    }

    const effectiveDate =
      date || new Date().toISOString().slice(0, 10);

    const employee = await findOrCreateEmployeeByTelegram({
      telegramUserId: String(telegramUserId),
      fullName,
    });
    if (!employee) {
      return res.status(400).json({ error: 'Employee not found/created' });
    }

    await Excuse.create({
      employeeId: employee.id,
      date: effectiveDate,
      type: 'late',
      minutes,
      reason,
    });

    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /employee/status/late', err);
    return res.status(500).json({ error: 'Failed to save late status' });
  }
});

router.post('/status/sick', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId, fullName, reason, date } = req.body;
    if (!telegramUserId) {
      return res.status(400).json({ error: 'telegramUserId is required' });
    }

    const effectiveDate =
      date || new Date().toISOString().slice(0, 10);

    const employee = await findOrCreateEmployeeByTelegram({
      telegramUserId: String(telegramUserId),
      fullName,
    });
    if (!employee) {
      return res.status(400).json({ error: 'Employee not found/created' });
    }

    await Excuse.create({
      employeeId: employee.id,
      date: effectiveDate,
      type: 'sick',
      minutes: null,
      reason,
    });

    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /employee/status/sick', err);
    return res.status(500).json({ error: 'Failed to save sick status' });
  }
});

router.post('/status/dayoff', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId, fullName, reason, date } = req.body;
    if (!telegramUserId) {
      return res.status(400).json({ error: 'telegramUserId is required' });
    }

    const effectiveDate =
      date || new Date().toISOString().slice(0, 10);

    const employee = await findOrCreateEmployeeByTelegram({
      telegramUserId: String(telegramUserId),
      fullName,
    });
    if (!employee) {
      return res.status(400).json({ error: 'Employee not found/created' });
    }

    await Excuse.create({
      employeeId: employee.id,
      date: effectiveDate,
      type: 'dayoff',
      minutes: null,
      reason,
    });

    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /employee/status/dayoff', err);
    return res.status(500).json({ error: 'Failed to save dayoff status' });
  }
});

export default router;

