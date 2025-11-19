const { Schema, model } = require('mongoose');

const DepartmentSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  manager_id: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = model('Department', DepartmentSchema);
