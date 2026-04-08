require('dotenv').config();
const { Attendance, Employee } = require('./src/models');

async function debug() {
  const today = new Date().toISOString().slice(0, 10);
  const atts = await Attendance.findAll({
    where: { date: today },
    include: [{ model: Employee }]
  });

  console.log(`--- ATTENDANCE FOR ${today} ---`);
  atts.forEach(a => {
    console.log(`${a.Employee ? a.Employee.fullName : 'UNKNOWN'} - ID: ${a.employeeId} - CheckIn: ${a.checkIn}`);
  });
}

debug().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
