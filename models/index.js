const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Import all models
const Role = require('./Role')(sequelize, DataTypes);
const Hotel = require('./Hotel')(sequelize, DataTypes);
const Department = require('./Department')(sequelize, DataTypes);
const Employee = require('./Employee')(sequelize, DataTypes);
const Shift = require('./Shift')(sequelize, DataTypes);
const Attendance = require('./Attendance')(sequelize, DataTypes);
const LeaveRequest = require('./LeaveRequest')(sequelize, DataTypes);
const Payroll = require('./Payroll')(sequelize, DataTypes);
const PerformanceReview = require('./PerformanceReview')(sequelize, DataTypes);
const EmployeeDocument = require('./EmployeeDocument')(sequelize, DataTypes);
const Guest = require('./Guest')(sequelize, DataTypes);
const Room = require('./Room')(sequelize, DataTypes);
const Reservation = require('./Reservation')(sequelize, DataTypes);
const Billing = require('./Billing')(sequelize, DataTypes);

// Define Associations

// Hotel Associations
Hotel.hasMany(Employee, { foreignKey: 'hotel_id', as: 'employees' });
Employee.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });

Hotel.hasMany(Room, { foreignKey: 'hotel_id', as: 'rooms' });
Room.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });

Hotel.hasMany(Department, { foreignKey: 'hotel_id', as: 'departments' });
Department.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });

// Employee-Department Association
Department.hasMany(Employee, { foreignKey: 'department_id', as: 'employees' });
Employee.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

// Role Associations
Role.hasMany(Employee, { foreignKey: 'role_id', as: 'employees' });
Employee.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// Employee HR Associations
Employee.hasMany(Attendance, { foreignKey: 'employee_id', as: 'attendances' });
Attendance.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Employee.hasMany(LeaveRequest, { foreignKey: 'employee_id', as: 'leaveRequests' });
LeaveRequest.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Employee.hasMany(Payroll, { foreignKey: 'employee_id', as: 'payrolls' });
Payroll.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Employee.hasMany(PerformanceReview, { foreignKey: 'employee_id', as: 'reviews' });
PerformanceReview.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Employee.hasMany(PerformanceReview, { foreignKey: 'reviewer_id', as: 'reviewedBy' });
PerformanceReview.belongsTo(Employee, { foreignKey: 'reviewer_id', as: 'reviewer' });

Employee.hasMany(EmployeeDocument, { foreignKey: 'employee_id', as: 'documents' });
EmployeeDocument.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// Guest & Reservation Associations
Guest.hasMany(Reservation, { foreignKey: 'guest_id', as: 'reservations' });
Reservation.belongsTo(Guest, { foreignKey: 'guest_id', as: 'guest' });

Room.hasMany(Reservation, { foreignKey: 'room_id', as: 'reservations' });
Reservation.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });

// Billing Associations
Reservation.hasOne(Billing, { foreignKey: 'reservation_id', as: 'billing' });
Billing.belongsTo(Reservation, { foreignKey: 'reservation_id', as: 'reservation' });

Guest.hasMany(Billing, { foreignKey: 'guest_id', as: 'billings' });
Billing.belongsTo(Guest, { foreignKey: 'guest_id', as: 'guest' });

module.exports = {
  sequelize,
  Role,
  Hotel,
  Department,
  Employee,
  Shift,
  Attendance,
  LeaveRequest,
  Payroll,
  PerformanceReview,
  EmployeeDocument,
  Guest,
  Room,
  Reservation,
  Billing
};
