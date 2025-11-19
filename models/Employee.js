const { Schema, model } = require('mongoose');

const EmployeeSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  employee_id: { type: String, required: true, unique: true },
  department_id: { type: Schema.Types.ObjectId, ref: 'Department' },
  position: { type: String, required: true },
  hire_date: { type: Date },
  salary: { type: Number, default: 0 },
  emergency_contact: String,
  emergency_phone: String,
  status: { type: String, enum: ['active','inactive','terminated'], default: 'active' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = model('Employee', EmployeeSchema);
