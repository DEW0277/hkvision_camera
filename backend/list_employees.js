require('dotenv').config();
const { Employee } = require('./src/models');

async function list() {
  const all = await Employee.findAll();
  console.log('--- ALL EMPLOYEES ---');
  all.forEach(e => {
    console.log(`${e.id}: ${e.fullName} (${e.personId}) - Active: ${e.isActive}`);
  });
}

list().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
