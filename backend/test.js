const { getEmployeeStats } = require('./src/services/reportService');
async function test() {
  try {
    const res = await getEmployeeStats(1, 30);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();
