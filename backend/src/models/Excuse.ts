import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';
import { IExcuse } from '../types';

export interface ExcuseInstance extends Model<IExcuse, Omit<IExcuse, 'id'>>, IExcuse {}

const Excuse = sequelize.define<ExcuseInstance>(
  'Excuse',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('late', 'sick', 'dayoff'),
      allowNull: false,
    },
    minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'excuses',
  }
);

export default Excuse;

