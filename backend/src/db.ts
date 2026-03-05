import * as path from 'path';
import { Sequelize } from 'sequelize';

const DB_FILE =
  process.env.DB_FILE ||
  path.join(__dirname, '..', 'data', 'hr_monitor.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: DB_FILE,
  logging: false,
});

export default sequelize;

