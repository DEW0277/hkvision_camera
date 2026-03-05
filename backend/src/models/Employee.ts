import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';
import { IEmployee } from '../types';

export interface EmployeeInstance extends Model<IEmployee, Omit<IEmployee, 'id'>>, IEmployee {}

const Employee = sequelize.define<EmployeeInstance>(
  'Employee',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    personId: {
      // Hikvision-like person identifier
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    telegramUserId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    branchId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'employees',
  }
);

export default Employee;

