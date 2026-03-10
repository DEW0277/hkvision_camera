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

  const holdingBranch = (await Branch.findOne({ where: { code: 'Holding' } })) || (await Branch.findOne());
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

// Xodim kontaktini tekshirish
router.get('/me', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId } = req.query;
    if (!telegramUserId) return res.status(400).json({ error: 'telegramUserId is required' });
    
    const employee = await Employee.findOne({
      where: { telegramUserId: String(telegramUserId) },
      attributes: ['id', 'fullName', 'phone', 'telegramUserId', 'language'],
    });
    if (!employee) return res.json({ hasContact: false, language: null });
    
    return res.json({
      hasContact: Boolean(employee.phone),
      fullName: employee.fullName,
      phone: employee.phone,
      language: employee.language,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Tilni saqlash
router.post('/language', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId, language } = req.body;
    if (!telegramUserId || !language) return res.status(400).json({ error: 'telegramUserId and language are required' });
    
    let employee = await findOrCreateEmployeeByTelegram({ telegramUserId: String(telegramUserId) });
    if (employee) await employee.update({ language });
    
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save language' });
  }
});

// Kontaktni saqlash (ASOSIY QISM)
router.post('/contact', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId, phone_number, first_name, last_name } = req.body;
    if (!telegramUserId || !phone_number) {
      return res.status(400).json({ error: 'telegramUserId and phone_number are required' });
    }

    const cleanPhone = String(phone_number).replace(/\D/g, '');
    const fullName = [first_name, last_name].filter(Boolean).join(' ').trim();
    const phoneSuffix = cleanPhone.slice(-9);

    // 1. Shu telefon bilan xodim bormi?
    let employee = await Employee.findOne({ 
      where: { phone: { [Op.like]: `%${phoneSuffix}` } } 
    });

    // 2. Bu ID boshqa vaqtinchalik xodimda bo'lsa tozalash
    await Employee.update(
      { telegramUserId: null },
      { 
        where: { 
          telegramUserId: String(telegramUserId),
          id: { [Op.ne]: employee ? employee.id : 0 }
        } 
      }
    );

    if (employee) {
      // Mavjud xodimga biriktirish
      await employee.update({
        telegramUserId: String(telegramUserId),
        phone: cleanPhone,
        ...(fullName && { fullName })
      });
    } else {
      // Yangi yaratish
      employee = await findOrCreateEmployeeByTelegram({
        telegramUserId: String(telegramUserId),
        fullName: fullName || undefined,
      });
      if (employee) {
        await employee.update({ phone: cleanPhone });
      }
    }

    if (!employee) return res.status(400).json({ error: 'Employee not found' });

    return res.json({ ok: true, fullName: employee.fullName, branchId: employee.branchId });
  } catch (err: any) {
    console.error('Error in /contact:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Yangi xodim qo'shish (Admin)
router.post('/add', async (req: express.Request, res: express.Response) => {
  try {
    const { personId, fullName, phone, branchId } = req.body;
    if (!personId || !fullName || !branchId) return res.status(400).json({ error: 'Missing fields' });

    const employee = await Employee.create({
      personId, fullName, 
      phone: phone ? String(phone).replace(/\D/g, '') : null,
      branchId: Number(branchId), isActive: true
    });
    return res.json({ ok: true, employee });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Kechikish holati
router.post('/status/late', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId, fullName, minutes, reason, date } = req.body;
    const employee = await findOrCreateEmployeeByTelegram({ telegramUserId: String(telegramUserId), fullName });
    if (!employee) return res.status(400).json({ error: 'Employee not found' });

    await Excuse.create({
      employeeId: employee.id,
      date: date || new Date().toISOString().slice(0, 10),
      type: 'late', minutes, reason
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed' });
  }
});

// Kasallik holati
router.post('/status/sick', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId, fullName, reason, date } = req.body;
    const employee = await findOrCreateEmployeeByTelegram({ telegramUserId: String(telegramUserId), fullName });
    if (!employee) return res.status(400).json({ error: 'Employee not found' });

    await Excuse.create({
      employeeId: employee.id,
      date: date || new Date().toISOString().slice(0, 10),
      type: 'sick', reason
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed' });
  }
});

// Javob so'rash
router.post('/status/dayoff', async (req: express.Request, res: express.Response) => {
  try {
    const { telegramUserId, fullName, reason, date } = req.body;
    const employee = await findOrCreateEmployeeByTelegram({ telegramUserId: String(telegramUserId), fullName });
    if (!employee) return res.status(400).json({ error: 'Employee not found' });

    await Excuse.create({
      employeeId: employee.id,
      date: date || new Date().toISOString().slice(0, 10),
      type: 'dayoff', reason
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed' });
  }
});

export default router;
