require('dotenv').config();
const { Employee } = require('./src/models');

async function listAll() {
  const all = await Employee.findAll({ paranoid: false }); // Include deleted if paranoia is on, but we don't use it.
  console.log(`Total Employees in DB: ${all.length}`);
  all.forEach(e => {
    console.log(`${e.id}: ${e.fullName} - Active: ${e.isActive}`);
  });
}

listAll().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
