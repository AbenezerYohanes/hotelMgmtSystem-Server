const { Schema, model } = require('mongoose');

const BookingSchema = new Schema({
  hotel_id: { type: Schema.Types.ObjectId, ref: 'Hotel' },
  room_id: { type: Schema.Types.ObjectId, ref: 'Room' },
  user_id: { type: Schema.Types.ObjectId, ref: 'User' },
  check_in_date: { type: Date, required: true },
  check_out_date: { type: Date, required: true },
  total_amount: { type: Number, required: true },
  nights: { type: Number, required: true },
  status: { type: String, enum: ['pending','confirmed','cancelled','checked_in','checked_out'], default: 'pending' },
  stripe_payment_intent: String,
  payment_status: { type: String, enum: ['pending','succeeded','refunded'], default: 'pending' },
  receipt_url: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = model('Booking', BookingSchema);
