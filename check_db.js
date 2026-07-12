require('dotenv').config({ path: './backend/.env' });
const { Timetable, BiometricDevice } = require('./backend/models');
async function check() {
  const devices = await BiometricDevice.findAll({ raw: true });
  console.log("DEVICES:", devices.map(d => ({ name: d.device_name, room: d.room_identifier })));
  
  const tt = await Timetable.findAll({ raw: true });
  console.log("TIMETABLES:", tt.map(t => ({ id: t.id, room: t.room_number })));
  process.exit(0);
}
check();
