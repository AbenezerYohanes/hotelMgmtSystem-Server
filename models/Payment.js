const { Schema, model } = require('mongoose');

const PaymentSchema = new Schema({
  booking_id: { type: Schema.Types.ObjectId, ref: 'Booking' },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  method: { type: String, default: 'unknown' },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = model('Payment', PaymentSchema);
