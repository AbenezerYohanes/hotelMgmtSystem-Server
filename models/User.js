const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  username: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  first_name: String,
  last_name: String,
  phone: String,
  address: String,
  role: { type: String, enum: ['super_admin','admin','manager','staff','client'], default: 'client' },
  privileges: { type: Schema.Types.Mixed, default: {} },
  is_active: { type: Boolean, default: true },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = model('User', UserSchema);
