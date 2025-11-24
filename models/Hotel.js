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


const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, unique: true },

    roomType: {
      type: String,
      enum: ["Single", "Double", "Suite", "Deluxe", "Family"],
      required: true,
    },

    pricePerNight: { type: Number, required: true },

    capacity: Number,
    floor: Number,

    amenities: [String], // WiFi, AC, TV, etc.

    description: String,

    images: [String], // image URLs

    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Room", roomSchema);
