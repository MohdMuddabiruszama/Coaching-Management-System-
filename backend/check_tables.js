const { sequelize } = require('./models');
sequelize.query('SELECT table_name FROM information_schema.tables WHERE table_schema=\'public\' AND table_name ILIKE \'institute%\'')
  .then(res => { console.log(res[0]); process.exit(0); })
  .catch(console.error);
