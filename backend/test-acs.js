const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function run() {
  const payloadData = JSON.stringify({
    AcsEventCond: {
      searchID: "1",
      searchResultPosition: 0,
      maxResults: 10,
      major: 5,
      minor: 75,
      startTime: "2026-03-28T00:00:00+05:00",
      endTime: "2026-03-28T23:59:59+05:00"
    }
  });

  const curlCmd = `curl -s --digest -u "admin:aslzar2021" -m 10 -X POST "http://10.10.25.33/ISAPI/AccessControl/AcsEvent?format=json" -H "Content-Type: application/json" -H "Accept: application/json" -d '${payloadData}'`;

  try {
    console.log("Running...");
    const { stdout } = await execPromise(curlCmd);
    console.log(stdout);
  } catch (err) {
    console.error("Exec error:", err.message);
  }
}
run();
