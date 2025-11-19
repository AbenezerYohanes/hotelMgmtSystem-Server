const { Schema, model } = require('mongoose');

const RoomSchema = new Schema({
  hotel_id: { type: Schema.Types.ObjectId, ref: 'Hotel' },
  room_number: { type: String, required: true },
  room_type: { type: Schema.Types.ObjectId, ref: 'RoomType' },
  floor: { type: Number, default: 1 },
  status: { type: String, enum: ['available','occupied','maintenance','cleaning'], default: 'available' },
  is_clean: { type: Boolean, default: true },
  notes: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

RoomSchema.index({ room_number: 1 }, { unique: true, sparse: true });

module.exports = model('Room', RoomSchema);
