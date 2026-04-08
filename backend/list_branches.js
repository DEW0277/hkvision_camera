require('dotenv').config();
const { Branch } = require('./src/models');

async function listBranches() {
  const all = await Branch.findAll();
  console.log('--- ALL BRANCHES ---');
  all.forEach(b => {
    console.log(`${b.id}: ${b.name} (${b.code})`);
  });
}

listBranches().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
