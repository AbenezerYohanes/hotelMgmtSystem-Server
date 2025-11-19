const { Schema, model } = require('mongoose');

const RoomTypeSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  base_price: { type: Number, required: true },
  capacity: { type: Number, default: 1 },
  amenities: { type: [String], default: [] }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = model('RoomType', RoomTypeSchema);
