import { Sequelize } from 'sequelize';

const DB_NAME = process.env.DB_NAME || 'psqldb';
const DB_USER = process.env.DB_USER || 'admin';
const DB_PASSWORD = process.env.DB_PASSWORD || '1234';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 5432;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false, // loglarni o'chirish
});

export default sequelize;

