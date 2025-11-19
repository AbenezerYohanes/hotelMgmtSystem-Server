const express = require('express');
const { body, validationResult } = require('express-validator');
const { isManager } = require('../middleware/auth');
// Mongoose models
let RoomType = null, Room = null, Booking = null;
try {
  RoomType = require('../models/RoomType');
  Room = require('../models/Room');
  Booking = require('../models/Booking');
} catch (e) {
  RoomType = null; Room = null; Booking = null;
}

const router = express.Router();

// Get all room types
router.get('/types', async (req, res) => {
  try {
    if (!RoomType) return res.status(500).json({ success: false, message: 'Room types not available (MongoDB models missing)' });
    const types = await RoomType.find().sort('base_price').lean();
    res.json({ success: true, data: types });
  } catch (error) {
    console.error('Room types error:', error);
    res.status(500).json({ success: false, message: 'Error fetching room types' });
  }
});

// Create room type
router.post('/types', isManager, [
  body('name').notEmpty().withMessage('Room type name is required'),
  body('description').optional(),
  body('base_price').isFloat({ min: 0 }).withMessage('Valid base price is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('amenities').optional().isArray().withMessage('Amenities must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: errors.array() 
      });
    }

    const { name, description, base_price, capacity, amenities } = req.body;

    if (!RoomType) return res.status(500).json({ success: false, message: 'Room types not available (MongoDB models missing)' });
    const created = await RoomType.create({ name, description, base_price, capacity, amenities: amenities || [] });
    res.status(201).json({ success: true, message: 'Room type created successfully', data: { id: created._id } });
  } catch (error) {
    console.error('Room type creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating room type' 
    });
  }
});

// Update room type
router.put('/types/:id', isManager, [
  body('name').optional().notEmpty().withMessage('Room type name cannot be empty'),
  body('description').optional(),
  body('base_price').optional().isFloat({ min: 0 }).withMessage('Valid base price is required'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('amenities').optional().isArray().withMessage('Amenities must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { name, description, base_price, capacity, amenities } = req.body;

    if (!RoomType) return res.status(500).json({ success: false, message: 'Room types not available (MongoDB models missing)' });
    const updated = await RoomType.findByIdAndUpdate(id, { $set: { name, description, base_price, capacity, amenities: amenities ? amenities : undefined } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Room type not found' });
    res.json({ success: true, message: 'Room type updated successfully', data: updated });
  } catch (error) {
    console.error('Room type update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating room type' 
    });
  }
});

// Get all rooms
router.get('/', async (req, res) => {
  try {
    if (!Room) return res.status(500).json({ success: false, message: 'Rooms model not available (MongoDB models missing)' });
    const { page = 1, limit = 10, status, room_type_id, floor } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};
    if (status) filter.status = status;
    if (floor) filter.floor = Number(floor);
    if (room_type_id) filter.room_type = room_type_id;
    const [items, total] = await Promise.all([
      Room.find(filter).populate('room_type').sort('room_number').limit(Number(limit)).skip(skip).lean(),
      Room.countDocuments(filter)
    ]);
    res.json({ success: true, data: items, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    console.error('Rooms error:', error);
    res.status(500).json({ success: false, message: 'Error fetching rooms' });
  }
});

// Create new room
router.post('/', isManager, [
  body('room_number').notEmpty().withMessage('Room number is required'),
  body('room_type_id').isInt().withMessage('Room type ID is required'),
  body('floor').isInt({ min: 1 }).withMessage('Floor must be at least 1'),
  body('notes').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: errors.array() 
      });
    }

    const { room_number, room_type_id, floor, notes } = req.body;

    if (!Room) return res.status(500).json({ success: false, message: 'Rooms model not available (MongoDB models missing)' });
    const existingRoom = await Room.findOne({ room_number }).lean();
    if (existingRoom) return res.status(409).json({ success: false, message: 'Room number already exists' });
    const created = await Room.create({ room_number, room_type: room_type_id, floor, notes });
    res.status(201).json({ success: true, message: 'Room created successfully', data: { id: created._id } });
  } catch (error) {
    console.error('Room creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating room' 
    });
  }
});

// Update room
router.put('/:id', isManager, [
  body('room_number').optional().notEmpty().withMessage('Room number cannot be empty'),
  body('room_type_id').optional().isInt().withMessage('Room type ID must be a number'),
  body('floor').optional().isInt({ min: 1 }).withMessage('Floor must be at least 1'),
  body('status').optional().isIn(['available', 'occupied', 'maintenance', 'cleaning']).withMessage('Invalid status'),
  body('is_clean').optional().isBoolean().withMessage('is_clean must be a boolean'),
  body('notes').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { room_number, room_type_id, floor, status, is_clean, notes } = req.body;

    if (!Room) return res.status(500).json({ success: false, message: 'Rooms model not available (MongoDB models missing)' });
    if (room_number) {
      const existingRoom = await Room.findOne({ room_number, _id: { $ne: id } }).lean();
      if (existingRoom) return res.status(409).json({ success: false, message: 'Room number already exists' });
    }
    const updated = await Room.findByIdAndUpdate(id, { $set: { room_number, room_type: room_type_id, floor, status, is_clean, notes } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, message: 'Room updated successfully', data: updated });
  } catch (error) {
    console.error('Room update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating room' 
    });
  }
});

// Get room availability
router.get('/availability', async (req, res) => {
  try {
    const { check_in_date, check_out_date, room_type_id } = req.query;

    if (!check_in_date || !check_out_date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Check-in and check-out dates are required' 
      });
    }

    if (!Room || !Booking) return res.status(500).json({ success: false, message: 'Models not available (MongoDB models missing)' });
    const checkIn = new Date(check_in_date);
    const checkOut = new Date(check_out_date);
    // Find bookings that overlap and are confirmed/checked_in
    const overlapping = await Booking.find({
      status: { $in: ['confirmed','checked_in'] },
      $or: [
        { check_in_date: { $lte: checkIn }, check_out_date: { $gt: checkIn } },
        { check_in_date: { $lt: checkOut }, check_out_date: { $gte: checkOut } },
        { check_in_date: { $gte: checkIn }, check_out_date: { $lte: checkOut } }
      ]
    }).select('room_id').lean();
    const bookedRoomIds = overlapping.map(b => String(b.room_id));
    const filter = { status: 'available' };
    if (room_type_id) filter.room_type = room_type_id;
    if (bookedRoomIds.length > 0) filter._id = { $nin: bookedRoomIds };
    const rooms = await Room.find(filter).populate('room_type').sort('room_number').lean();
    res.json({ success: true, data: rooms });
  } catch (error) {
    console.error('Room availability error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching room availability' 
    });
  }
});

// Get room details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!Room) return res.status(500).json({ success: false, message: 'Rooms model not available (MongoDB models missing)' });
    const room = await Room.findById(id).populate('room_type').lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, data: room });
  } catch (error) {
    console.error('Room details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching room details' 
    });
  }
});

// Get room dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    // Total rooms
    if (!Room) return res.status(500).json({ success: false, message: 'Rooms model not available (MongoDB models missing)' });
    const totalRooms = await Room.countDocuments();
    const availableRooms = await Room.countDocuments({ status: 'available' });
    const occupiedRooms = await Room.countDocuments({ status: 'occupied' });
    const maintenanceRooms = await Room.countDocuments({ status: 'maintenance' });
    const roomsByType = await Room.aggregate([
      { $lookup: { from: 'roomtypes', localField: 'room_type', foreignField: '_id', as: 'rt' } },
      { $unwind: { path: '$rt', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$room_type', name: { $first: '$rt.name' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const occupancyRate = totalRooms === 0 ? 0 : (occupiedRooms * 100.0) / totalRooms;
    res.json({ success: true, data: { totalRooms, availableRooms, occupiedRooms, maintenanceRooms, roomsByType, occupancyRate } });
  } catch (error) {
    console.error('Room dashboard error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching room dashboard data' 
    });
  }
});

module.exports = router; 