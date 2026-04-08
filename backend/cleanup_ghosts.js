require('dotenv').config();
const { Employee } = require('./src/models');
const { Op } = require('sequelize');

async function cleanup() {
  const ghosts = await Employee.findAll({
    where: {
      fullName: { [Op.like]: 'User %' }
    }
  });

  console.log(`🔍 Found ${ghosts.length} ghost employees.`);
  for (const ghost of ghosts) {
    console.log(`🚮 Deleting: ${ghost.fullName} (${ghost.personId})`);
    await ghost.destroy(); // This will also cascade delete attendance if configured, but let's be careful.
  }
}

cleanup().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
