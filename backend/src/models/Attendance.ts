import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';
import { IAttendance } from '../types';

export interface AttendanceInstance extends Model<IAttendance, Omit<IAttendance, 'id'>>, IAttendance {}

const Attendance = sequelize.define<AttendanceInstance>(
  'Attendance',
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
    checkIn: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    checkOut: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isLate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    wasPresent: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    expectedStartTime: {
      type: DataTypes.STRING,
      defaultValue: '08:00',
    },
    locationCode: {
      // Branch/location identifier (e.g. Andijon, Bekobod)
      type: DataTypes.STRING,
      allowNull: false,
    },
    personId: {
      // Redundant, to mimic Hikvision-style logs
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: 'attendance',
  }
);

export default Attendance;

