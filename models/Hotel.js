const { Schema, model } = require('mongoose');

const HotelSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  country: String,
  city: String,
  address: String,
  created_by: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = model('Hotel', HotelSchema);
