require('dotenv').config();
const { Employee } = require('./src/models');
const { Op } = require('sequelize');

async function listAll() {
  const all = await Employee.findAll({
    where: {
      fullName: { [Op.iLike]: '%User%' }
    }
  });

  console.log(`--- FOUND ${all.length} POTENTIAL GHOSTS ---`);
  all.forEach(e => {
    console.log(`${e.id}: ${e.fullName} (${e.personId}) - Active: ${e.isActive}`);
  });
}

listAll().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
