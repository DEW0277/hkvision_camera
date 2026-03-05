import Branch from './Branch';
import Employee from './Employee';
import Attendance from './Attendance';
import Excuse from './Excuse';

// Associations
Branch.hasMany(Employee, { foreignKey: 'branchId' });
Employee.belongsTo(Branch, { foreignKey: 'branchId' });

Employee.hasMany(Attendance, { foreignKey: 'employeeId' });
Attendance.belongsTo(Employee, { foreignKey: 'employeeId' });

Employee.hasMany(Excuse, { foreignKey: 'employeeId' });
Excuse.belongsTo(Employee, { foreignKey: 'employeeId' });

export { Branch, Employee, Attendance, Excuse };

