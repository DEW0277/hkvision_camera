import { Op } from 'sequelize';
import { Branch, Employee, Attendance, Excuse } from '../models';

function formatTime(date: Date | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export async function getDailyReport(dateStr?: string) {
  const date = dateStr || new Date().toISOString().slice(0, 10);

  const branches = await Branch.findAll();
  const employees = await Employee.findAll({ where: { isActive: true } });
  const attendance = await Attendance.findAll({
    where: { date },
    include: [{ model: Employee }],
  });
  const excuses = await Excuse.findAll({
    where: { date },
  });

  const branchMap = new Map(
    branches.map((b) => [b.id, { id: b.id, code: b.code, name: b.name }])
  );

  const perBranch: Record<string, any> = {};

  employees.forEach((emp: any) => {
    const branchInfo = branchMap.get(emp.branchId);
    if (!branchInfo) return;
    if (!perBranch[branchInfo.code]) {
      perBranch[branchInfo.code] = {
        code: branchInfo.code,
        name: branchInfo.name,
        totalEmployees: 0,
        presentEmployees: 0,
        lateEmployees: [],
        absentEmployees: [],
      };
    }
    perBranch[branchInfo.code].totalEmployees += 1;
  });

  const attendanceByEmployee = new Map();
  attendance.forEach((rec: any) => {
    attendanceByEmployee.set(rec.employeeId, rec);
  });

  const excusesByEmployee = new Map();
  excuses.forEach((exc: any) => {
    const list = excusesByEmployee.get(exc.employeeId) || [];
    list.push(exc);
    excusesByEmployee.set(exc.employeeId, list);
  });

  employees.forEach((emp: any) => {
    const empAttendance = attendanceByEmployee.get(emp.id);
    const empExcuses = excusesByEmployee.get(emp.id) || [];
    const branchInfo = branchMap.get(emp.branchId);
    if (!branchInfo) return;
    const bucket = perBranch[branchInfo.code];

    if (!empAttendance || !empAttendance.wasPresent) {
      bucket.absentEmployees.push({
        fullName: emp.fullName,
        hasExcuse: empExcuses.some((e: any) => e.type === 'sick' || e.type === 'dayoff'),
      });
      return;
    }

    bucket.presentEmployees += 1;

    if (empAttendance.isLate) {
      const warned = empExcuses.some((e: any) => e.type === 'late');
      bucket.lateEmployees.push({
        fullName: emp.fullName,
        checkInTime: formatTime(empAttendance.checkIn),
        warned,
      });
    }
  });

  const branchSummaries = Object.values(perBranch).map((b) => {
    const disciplinePercent =
      b.totalEmployees === 0
        ? 0
        : Math.round((b.presentEmployees / b.totalEmployees) * 100);
    return {
      ...b,
      disciplinePercent,
    };
  });

  const overallTotals = branchSummaries.reduce(
    (acc, b) => {
      acc.total += b.totalEmployees;
      acc.present += b.presentEmployees;
      return acc;
    },
    { total: 0, present: 0 }
  );

  const overallDisciplinePercent =
    overallTotals.total === 0
      ? 0
      : Math.round((overallTotals.present / overallTotals.total) * 100);

  return {
    date,
    branches: branchSummaries,
    overallDisciplinePercent,
  };
}

export async function getDailyReportText(dateStr?: string) {
  const summary = await getDailyReport(dateStr);
  const date = summary.date.split('-').reverse().join('.');

  const lines: string[] = [];
  lines.push('📊 КУНЛИК ХИСОБОТ / ЕЖЕДНЕВНЫЙ ОТЧЕТ');
  lines.push(`Сана/Дата: ${date}`);
  lines.push('');
  lines.push('Легенда: ✅ вовремя / предупредил, ⚠ опоздал, 🚫 не пришёл');

  summary.branches.forEach((b: any) => {
    if (b.totalEmployees === 0) return;

    lines.push('');
    lines.push(`📍 ${b.code} — дисциплина: ${b.disciplinePercent}%`);
    lines.push(
      `   👥 Сотрудники: ${b.totalEmployees} | ✅ На месте: ${b.presentEmployees}`
    );

    const unexcusedAbsent = b.absentEmployees.filter((a: any) => !a.hasExcuse);
    if (b.absentEmployees.length > 0) {
      lines.push(
        `   🚫 Не пришли: ${b.absentEmployees.length} (без уваж. причины: ${unexcusedAbsent.length})`
      );
    }

    if (b.lateEmployees.length > 0) {
      lines.push('   ⚠ Опоздали:');
      b.lateEmployees.forEach((l: any) => {
        const warnedSuffix = l.warned ? ' ✅ предупредил' : '';
        lines.push(
          `   • ${l.fullName} — ${l.checkInTime}${warnedSuffix}`
        );
      });
    }
  });

  lines.push('');
  lines.push(
    `Общий показатель дисциплины: ${summary.overallDisciplinePercent}%`
  );

  return lines.join('\n');
}

export async function getDashboardAttendance(
  { date, branchCode, search }: { date?: string; branchCode?: string; search?: string }
) {
  const dateStr = date || new Date().toISOString().slice(0, 10);

  const whereEmployee: any = { isActive: true };
  if (branchCode && branchCode !== 'ALL') {
    const branch = await Branch.findOne({ where: { code: branchCode } });
    if (!branch) {
      return [];
    }
    whereEmployee.branchId = branch.id;
  }
  if (search) {
    whereEmployee.fullName = {
      [Op.like]: `%${search}%`,
    };
  }

  const employees = await Employee.findAll({
    where: whereEmployee,
    include: [{ model: Branch }],
  });

  const employeeIds = employees.map((e) => e.id);

  const attendance = await Attendance.findAll({
    where: {
      date: dateStr,
      employeeId: {
        [Op.in]: employeeIds as number[],
      }
    },
  });
  const excuses = await Excuse.findAll({
    where: {
      date: dateStr,
      employeeId: {
        [Op.in]: employeeIds as number[],
      }
    },
  });

  const attendanceByEmployee = new Map();
  attendance.forEach((rec: any) => {
    attendanceByEmployee.set(rec.employeeId, rec);
  });
  const excusesByEmployee = new Map();
  excuses.forEach((exc: any) => {
    const list = excusesByEmployee.get(exc.employeeId) || [];
    list.push(exc);
    excusesByEmployee.set(exc.employeeId, list);
  });

  const rows = employees.map((emp: any) => {
    const branchName = emp.Branch ? emp.Branch.name : 'Unknown';
    const att = attendanceByEmployee.get(emp.id);
    const employeeExcuses = excusesByEmployee.get(emp.id) || [];

    let status = 'ABSENT';

    const hasSick = employeeExcuses.some((e: any) => e.type === 'sick');
    const hasDayOff = employeeExcuses.some((e: any) => e.type === 'dayoff');
    const hasLateExcuse = employeeExcuses.some((e: any) => e.type === 'late');

    if (hasSick) status = 'SICK';
    else if (hasDayOff) status = 'DAYOFF';
    else if (!att || !att.wasPresent) status = 'ABSENT';
    else if (att.isLate && hasLateExcuse) status = 'WARNED';
    else if (att.isLate) status = 'LATE';
    else status = 'ON_TIME';

    return {
      id: emp.id,
      fullName: emp.fullName,
      branch: branchName,
      date: dateStr,
      checkIn: formatTime(att?.checkIn || null),
      checkOut: formatTime(att?.checkOut || null),
      status,
    };
  });

  return rows;
}

export async function getDashboardStats({ days = 7 }: { days?: number }) {
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - (days - 1));
  const startStr = startDate.toISOString().slice(0, 10);

  const employees = await Employee.count({ where: { isActive: true } });
  if (employees === 0) return [];

  const attendance = await Attendance.findAll({
    where: {
      date: {
        [Op.gte]: startStr,
      },
      wasPresent: true,
    },
  });

  const byDate = new Map();
  attendance.forEach((rec) => {
    const d = rec.date;
    const list = byDate.get(d) || [];
    list.push(rec);
    byDate.set(d, list);
  });

  const result = [];

  for (
    let d = new Date(startDate);
    d <= today;
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = d.toISOString().slice(0, 10);
    const presentCount = (byDate.get(dateStr) || []).length;
    const discipline =
      employees === 0 ? 0 : Math.round((presentCount / employees) * 100);
    result.push({
      date: dateStr,
      presentCount,
      discipline,
    });
  }

  return result;
}

export async function getEmployeeStats(employeeId: number, days: number = 30) {
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - (days - 1));
  const startStr = startDate.toISOString().slice(0, 10);

  const employee = await Employee.findByPk(employeeId);
  if (!employee) {
    throw new Error('Employee not found');
  }

  const attendance = await Attendance.findAll({
    where: {
      employeeId,
      date: {
        [Op.gte]: startStr,
      },
    },
    order: [['date', 'ASC']],
  });

  const excuses = await Excuse.findAll({
    where: {
      employeeId,
      date: {
        [Op.gte]: startStr,
      },
    },
  });

  const attendanceByDate = new Map();
  attendance.forEach((rec: any) => attendanceByDate.set(rec.date, rec));

  const excusesByDate = new Map();
  excuses.forEach((exc: any) => {
    const list = excusesByDate.get(exc.date) || [];
    list.push(exc);
    excusesByDate.set(exc.date, list);
  });

  const result = [];

  for (
    let d = new Date(startDate);
    d <= today;
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = d.toISOString().slice(0, 10);
    const att = attendanceByDate.get(dateStr);
    const dailyExcuses = excusesByDate.get(dateStr) || [];

    let status = 'ABSENT';

    const hasSick = dailyExcuses.some((e: any) => e.type === 'sick');
    const hasDayOff = dailyExcuses.some((e: any) => e.type === 'dayoff');
    const hasLateExcuse = dailyExcuses.some((e: any) => e.type === 'late');

    if (hasSick) status = 'SICK';
    else if (hasDayOff) status = 'DAYOFF';
    else if (!att || !att.wasPresent) status = 'ABSENT';
    else if (att.isLate && hasLateExcuse) status = 'WARNED';
    else if (att.isLate) status = 'LATE';
    else status = 'ON_TIME';

    result.push({
      date: dateStr,
      checkIn: formatTime(att?.checkIn || null),
      checkOut: formatTime(att?.checkOut || null),
      status,
    });
  }

  return {
    employee: {
      id: employee.id,
      fullName: employee.fullName,
    },
    stats: result,
  };
}

