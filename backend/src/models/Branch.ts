import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';
import { IBranch } from '../types';

export interface BranchInstance extends Model<IBranch, Omit<IBranch, 'id'>>, IBranch {}

const Branch = sequelize.define<BranchInstance>(
  'Branch',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: 'branches',
  }
);

export default Branch;

