const { sequelize } = require('./backend/models');
sequelize.query("SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE table_name = 'users' AND constraint_type = 'UNIQUE';")
  .then(res => { console.log("Users uniques:", res[0]); return sequelize.query("SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE table_name = 'student_parents' AND constraint_type = 'UNIQUE';"); })
  .then(res => console.log("student_parents uniques:", res[0]))
  .catch(console.error)
  .finally(() => process.exit(0));
