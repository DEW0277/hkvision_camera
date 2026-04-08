require('dotenv').config();
const sequelize = require('./src/db').default;
require('./src/models');

async function sync() {
  console.log('🔄 Syncing database...');
  await sequelize.sync({ alter: true });
  console.log('✅ Database synced.');
}

sync().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
