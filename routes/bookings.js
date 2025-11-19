const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/config');
const { authenticateToken } = require('../middleware/auth');
let Booking = null, Room = null, RoomType = null, User = null;
let mongoose = null;
try {
  Booking = require('../models/Booking');
  Room = require('../models/Room');
  RoomType = require('../models/RoomType');
  User = require('../models/User');
  mongoose = require('mongoose');
} catch (e) {
  Booking = null; Room = null; RoomType = null; User = null; mongoose = null;
}

const router = express.Router();

// Generate unique booking number
function generateBookingNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BK${timestamp}${random}`;
}

// Create a new booking
router.post('/', authenticateToken, [
  body('guest_id').isInt().withMessage('Valid guest ID is required'),
  body('room_id').isInt().withMessage('Valid room ID is required'),
  body('check_in_date').isDate().withMessage('Valid check-in date is required'),
  body('check_out_date').isDate().withMessage('Valid check-out date is required'),
  body('adults').optional().isInt({ min: 1 }).withMessage('Adults must be at least 1'),
  body('children').optional().isInt({ min: 0 }).withMessage('Children cannot be negative'),
  body('special_requests').optional().isLength({ max: 1000 }).withMessage('Special requests too long')
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

    const {
      guest_id,
      room_id,
      check_in_date,
      check_out_date,
      adults = 1,
      children = 0,
      special_requests
    } = req.body;

    // Validate dates
    const checkIn = new Date(check_in_date);
    const checkOut = new Date(check_out_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      return res.status(400).json({
        success: false,
        message: 'Check-in date cannot be in the past'
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be after check-in date'
      });
    }

    // If Mongoose models available, use Mongo implementation
    if (Booking && Room && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      // Check room exists and pricing
      const roomDoc = await Room.findById(room_id).populate('room_type').lean();
      if (!roomDoc) return res.status(404).json({ success: false, message: 'Room not found' });
      const roomType = roomDoc.room_type;
      const max_occupancy = roomType ? roomType.capacity || roomType.max_occupancy || 1 : 1;
      const totalGuests = adults + children;
      if (totalGuests > max_occupancy) return res.status(400).json({ success: false, message: `Room can accommodate maximum ${max_occupancy} guests` });

      // Check overlapping bookings
      const overlapping = await Booking.countDocuments({
        room_id: room_id,
        status: { $in: ['confirmed', 'checked_in'] },
        $or: [
          { check_in_date: { $lte: checkIn }, check_out_date: { $gt: checkIn } },
          { check_in_date: { $lt: checkOut }, check_out_date: { $gte: checkOut } },
          { check_in_date: { $gte: checkIn }, check_out_date: { $lte: checkOut } }
        ]
      });
      if (overlapping > 0) return res.status(409).json({ success: false, message: 'Room is not available for the selected dates' });

      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const basePrice = roomType ? parseFloat(roomType.base_price || 0) : 0;
      const totalAmount = nights * basePrice;
      const bookingNumber = generateBookingNumber();

      const created = await Booking.create({
        booking_number: bookingNumber,
        user_id: req.user?.userId || null,
        room_id,
        check_in_date: checkIn,
        check_out_date: checkOut,
        adults,
        children,
        total_amount: totalAmount,
        status: 'pending',
        special_requests
      });

      return res.status(201).json({ success: true, message: 'Booking created successfully', data: { booking_id: created._id, booking_number: bookingNumber, total_amount: totalAmount } });
    }

    // Fallback to MySQL implementation
    // Check room availability
    const availabilityCheck = await query(`
      SELECT COUNT(*) as count FROM bookings
      WHERE room_id = ?
      AND status IN ('confirmed', 'checked_in')
      AND (
        (check_in_date <= ? AND check_out_date > ?) OR
        (check_in_date < ? AND check_out_date >= ?) OR
        (check_in_date >= ? AND check_out_date <= ?)
      )
    `, [room_id, check_in_date, check_in_date, check_out_date, check_out_date, check_in_date, check_out_date]);

    if (parseInt(availabilityCheck.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        message: 'Room is not available for the selected dates'
      });
    }

    // Get room details for pricing
    const roomDetails = await query(`
      SELECT rt.base_price, rt.max_occupancy
      FROM rooms r
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.id = ?
    `, [room_id]);

    if (!roomDetails.rows || roomDetails.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const room = roomDetails.rows[0];
    const totalGuests = adults + children;

    if (totalGuests > room.max_occupancy) {
      return res.status(400).json({
        success: false,
        message: `Room can accommodate maximum ${room.max_occupancy} guests`
      });
    }

    // Calculate total amount
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const totalAmount = nights * parseFloat(room.base_price);

    // Generate booking number
    const bookingNumber = generateBookingNumber();

    // Create booking
    const result = await query(
      `INSERT INTO bookings
       (booking_number, guest_id, room_id, check_in_date, check_out_date,
        adults, children, total_amount, status, special_requests, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingNumber, guest_id, room_id, check_in_date, check_out_date,
       adults, children, totalAmount, 'pending', special_requests, req.user?.id]
    );

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        booking_id: result.insertId || (result.rows && result.rows.insertId),
        booking_number: bookingNumber,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating booking'
    });
  }
});

// Get all bookings
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, guest_id, room_id, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    // If Mongo models available, use aggregation
    if (Booking && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const match = {};
      if (status) match.status = status;
      if (room_id) match.room_id = mongoose.Types.ObjectId(room_id);
      if (guest_id) match.user_id = mongoose.Types.ObjectId(guest_id);
      if (start_date && end_date) {
        match.check_in_date = { $gte: new Date(start_date) };
        match.check_out_date = { $lte: new Date(end_date) };
      }

      const pipeline = [
        { $match: match },
        { $sort: { created_at: -1 } },
        { $skip: Number(offset) },
        { $limit: Number(limit) },
        { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'rooms', localField: 'room_id', foreignField: '_id', as: 'room' } },
        { $unwind: { path: '$room', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'roomtypes', localField: 'room.room_type', foreignField: '_id', as: 'room_type' } },
        { $unwind: { path: '$room_type', preserveNullAndEmptyArrays: true } }
      ];

      const [items, totalCountArr] = await Promise.all([
        Booking.aggregate(pipeline),
        Booking.countDocuments(match)
      ]);

      return res.json({ success: true, data: items, pagination: { page: Number(page), limit: Number(limit), total: Number(totalCountArr), pages: Math.ceil(Number(totalCountArr) / Number(limit)) } });
    }

    // Fallback to MySQL
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND b.status = ?';
      params.push(status);
    }

    if (guest_id) {
      whereClause += ' AND b.guest_id = ?';
      params.push(guest_id);
    }

    if (room_id) {
      whereClause += ' AND b.room_id = ?';
      params.push(room_id);
    }

    if (start_date && end_date) {
      whereClause += ' AND b.check_in_date >= ? AND b.check_out_date <= ?';
      params.push(start_date, end_date);
    }

    const result = await query(`
      SELECT b.*, g.first_name, g.last_name, g.email, g.phone,
             r.room_number, r.floor, rt.name as room_type, rt.base_price,
             u.first_name as created_by_name, u.last_name as created_by_last_name
      FROM bookings b
      LEFT JOIN guests g ON b.guest_id = g.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN users u ON b.created_by = u.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), Number(offset)]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM bookings b
      ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings'
    });
  }
});

// Update booking
router.put('/:id', authenticateToken, [
  body('check_in_date').optional().isDate().withMessage('Valid check-in date is required'),
  body('check_out_date').optional().isDate().withMessage('Valid check-out date is required'),
  body('adults').optional().isInt({ min: 1 }).withMessage('Adults must be at least 1'),
  body('children').optional().isInt({ min: 0 }).withMessage('Children cannot be negative'),
  body('status').optional().isIn(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']).withMessage('Invalid status'),
  body('special_requests').optional().isLength({ max: 1000 }).withMessage('Special requests too long')
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
    const { check_in_date, check_out_date, adults, children, status, special_requests } = req.body;

    // If Mongo models available, use Mongo implementation
    if (Booking && Room && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const bookingDoc = await Booking.findById(id).lean();
      if (!bookingDoc) return res.status(404).json({ success: false, message: 'Booking not found' });

      let totalAmount = bookingDoc.total_amount;
      let newCheckIn = check_in_date ? new Date(check_in_date) : bookingDoc.check_in_date;
      let newCheckOut = check_out_date ? new Date(check_out_date) : bookingDoc.check_out_date;

      if (check_in_date || check_out_date) {
        const today = new Date(); today.setHours(0,0,0,0);
        if (newCheckIn < today) return res.status(400).json({ success: false, message: 'Check-in date cannot be in the past' });
        if (newCheckOut <= newCheckIn) return res.status(400).json({ success: false, message: 'Check-out date must be after check-in date' });

        // Check overlapping excluding current booking
        const overlapping = await Booking.countDocuments({
          room_id: bookingDoc.room_id,
          _id: { $ne: bookingDoc._id },
          status: { $in: ['confirmed','checked_in'] },
          $or: [
            { check_in_date: { $lte: newCheckIn }, check_out_date: { $gt: newCheckIn } },
            { check_in_date: { $lt: newCheckOut }, check_out_date: { $gte: newCheckOut } },
            { check_in_date: { $gte: newCheckIn }, check_out_date: { $lte: newCheckOut } }
          ]
        });
        if (overlapping > 0) return res.status(409).json({ success: false, message: 'Room is not available for the selected dates' });

        // recalc price
        const roomDoc = await Room.findById(bookingDoc.room_id).populate('room_type').lean();
        const roomType = roomDoc.room_type;
        const nights = Math.ceil((newCheckOut - newCheckIn) / (1000*60*60*24));
        totalAmount = nights * (roomType ? parseFloat(roomType.base_price || 0) : 0);

        const totalGuests = (adults !== undefined ? adults : bookingDoc.adults) + (children !== undefined ? children : bookingDoc.children);
        const maxOcc = roomType ? roomType.capacity || roomType.max_occupancy || 1 : 1;
        if (totalGuests > maxOcc) return res.status(400).json({ success: false, message: `Room can accommodate maximum ${maxOcc} guests` });
      }

      const update = {
        ...(check_in_date ? { check_in_date: new Date(check_in_date) } : {}),
        ...(check_out_date ? { check_out_date: new Date(check_out_date) } : {}),
        ...(adults !== undefined ? { adults } : {}),
        ...(children !== undefined ? { children } : {}),
        ...(status ? { status } : {}),
        ...(special_requests ? { special_requests } : {}),
        total_amount: totalAmount,
        updated_at: new Date()
      };

      const updated = await Booking.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
      if (!updated) return res.status(404).json({ success: false, message: 'Booking not found' });
      return res.json({ success: true, message: 'Booking updated successfully' });
    }

    // Fallback: original MySQL implementation
    // Get current booking
    const currentBooking = await query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!currentBooking.rows || currentBooking.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = currentBooking.rows[0];
    let totalAmount = booking.total_amount;

    // If dates are being changed, check availability and recalculate price
    if (check_in_date || check_out_date) {
      const newCheckIn = check_in_date || booking.check_in_date;
      const newCheckOut = check_out_date || booking.check_out_date;

      // Validate dates
      const checkIn = new Date(newCheckIn);
      const checkOut = new Date(newCheckOut);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (checkIn < today) {
        return res.status(400).json({
          success: false,
          message: 'Check-in date cannot be in the past'
        });
      }

      if (checkOut <= checkIn) {
        return res.status(400).json({
          success: false,
          message: 'Check-out date must be after check-in date'
        });
      }

      // Check room availability (exclude current booking)
      const availabilityCheck = await query(`
        SELECT COUNT(*) as count FROM bookings
        WHERE room_id = ?
        AND id != ?
        AND status IN ('confirmed', 'checked_in')
        AND (
          (check_in_date <= ? AND check_out_date > ?) OR
          (check_in_date < ? AND check_out_date >= ?) OR
          (check_in_date >= ? AND check_out_date <= ?)
        )
      `, [booking.room_id, id, newCheckIn, newCheckIn, newCheckOut, newCheckOut, newCheckIn, newCheckOut]);
      if (parseInt(availabilityCheck.rows[0].count) > 0) {
        return res.status(409).json({
          success: false,
          message: 'Room is not available for the selected dates'
        });
      }

      // Recalculate total amount
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const roomDetails = await query(`
        SELECT rt.base_price, rt.max_occupancy
        FROM rooms r
        LEFT JOIN room_types rt ON r.room_type_id = rt.id
        WHERE r.id = ?
      `, [booking.room_id]);
      const room = roomDetails.rows[0];
      totalAmount = nights * parseFloat(room.base_price);

      // Check occupancy
      const totalGuests = (adults !== undefined ? adults : booking.adults) + (children !== undefined ? children : booking.children);
      if (totalGuests > room.max_occupancy) {
        return res.status(400).json({
          success: false,
          message: `Room can accommodate maximum ${room.max_occupancy} guests`
        });
      }
    }

    // Update booking
    const updateResult = await query(
      `UPDATE bookings SET
       check_in_date = COALESCE(?, check_in_date),
       check_out_date = COALESCE(?, check_out_date),
       adults = COALESCE(?, adults),
       children = COALESCE(?, children),
       status = COALESCE(?, status),
       special_requests = COALESCE(?, special_requests),
       total_amount = ?,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [check_in_date, check_out_date, adults, children, status, special_requests, totalAmount, id]
    );
    const affected = updateResult.affectedRows || (updateResult.rows && updateResult.rows.affectedRows) || 0;
    if (affected === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({
      success: true,
      message: 'Booking updated successfully'
    });
  } catch (error) {
    console.error('Booking update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating booking'
    });
  }
});

// Check-in booking
router.put('/:id/checkin', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // If Mongo models available, use them
    if (Booking && Room && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const bookingDoc = await Booking.findById(id).lean();
      if (!bookingDoc) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (bookingDoc.status !== 'confirmed') return res.status(400).json({ success: false, message: 'Only confirmed bookings can be checked in' });
      const today = new Date(); today.setHours(0,0,0,0);
      const checkInDate = new Date(bookingDoc.check_in_date);
      if (checkInDate > today) return res.status(400).json({ success: false, message: 'Cannot check-in before the check-in date' });

      await Booking.findByIdAndUpdate(id, { $set: { status: 'checked_in', updated_at: new Date() } });
      await Room.findByIdAndUpdate(bookingDoc.room_id, { $set: { status: 'occupied' } });
      return res.json({ success: true, message: 'Guest checked in successfully' });
    }

    // Fallback MySQL
    // Get booking details
    const bookingResult = await query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!bookingResult.rows || bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    const booking = bookingResult.rows[0];

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be checked in'
      });
    }

    // Check if check-in date is today or in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(booking.check_in_date);

    if (checkInDate > today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot check-in before the check-in date'
      });
    }

    // Update booking status and room status
    await query('UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['checked_in', id]);
    await query('UPDATE rooms SET status = ? WHERE id = ?', ['occupied', booking.room_id]);

    res.json({
      success: true,
      message: 'Guest checked in successfully'
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during check-in'
    });
  }
});

// Check-out booking
router.put('/:id/checkout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // If Mongo models available
    if (Booking && Room && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const bookingDoc = await Booking.findById(id).lean();
      if (!bookingDoc) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (bookingDoc.status !== 'checked_in') return res.status(400).json({ success: false, message: 'Only checked-in bookings can be checked out' });

      await Booking.findByIdAndUpdate(id, { $set: { status: 'checked_out', updated_at: new Date() } });
      await Room.findByIdAndUpdate(bookingDoc.room_id, { $set: { status: 'available' } });
      return res.json({ success: true, message: 'Guest checked out successfully' });
    }

    // Fallback MySQL
    // Get booking details
    const bookingResult = await query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!bookingResult.rows || bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    const booking = bookingResult.rows[0];

    if (booking.status !== 'checked_in') {
      return res.status(400).json({
        success: false,
        message: 'Only checked-in bookings can be checked out'
      });
    }

    // Update booking status and room status
    await query('UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['checked_out', id]);
    await query('UPDATE rooms SET status = ? WHERE id = ?', ['available', booking.room_id]);

    res.json({
      success: true,
      message: 'Guest checked out successfully'
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during check-out'
    });
  }
});

// Get booking details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (Booking && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const doc = await Booking.findById(id).populate({ path: 'room_id', populate: { path: 'room_type' } }).populate('user_id', 'first_name last_name email phone address').lean();
      if (!doc) return res.status(404).json({ success: false, message: 'Booking not found' });
      return res.json({ success: true, data: doc });
    }

    const result = await query(`
      SELECT b.*, g.first_name, g.last_name, g.email, g.phone, g.address,
             r.room_number, r.floor, rt.name as room_type, rt.base_price, rt.amenities,
             u.first_name as created_by_name, u.last_name as created_by_last_name
      FROM bookings b
      LEFT JOIN guests g ON b.guest_id = g.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.id = ?
    `, [id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Booking details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking details'
    });
  }
});

// Get booking dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    if (Booking && Room && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [todayBookings, monthBookings, monthRevenue, occupiedBookingsCount, totalRooms, upcomingCheckins, recentBookings] = await Promise.all([
        Booking.countDocuments({ created_at: { $gte: startOfToday } }),
        Booking.countDocuments({ created_at: { $gte: startOfMonth } }),
        Booking.aggregate([{ $match: { created_at: { $gte: startOfMonth }, status: { $in: ['confirmed','checked_in','checked_out'] } } }, { $group: { _id: null, total: { $sum: '$total_amount' } } }]),
        Booking.countDocuments({ check_in_date: { $lte: new Date() }, check_out_date: { $gt: new Date() }, status: { $in: ['confirmed','checked_in'] } }),
        Room.countDocuments({ status: { $ne: 'maintenance' } }),
        Booking.aggregate([{ $match: { check_in_date: { $gte: new Date() }, check_in_date: { $lte: new Date(new Date().getTime() + 7*24*60*60*1000) }, status: 'confirmed' } }, { $limit: 10 }]),
        Booking.aggregate([{ $sort: { created_at: -1 } }, { $limit: 5 }])
      ]);

      const monthRevenueVal = (monthRevenue && monthRevenue[0] && monthRevenue[0].total) ? monthRevenue[0].total : 0;
      const occupancyRate = (totalRooms === 0) ? 0 : Math.round((occupiedBookingsCount * 10000.0 / totalRooms)) / 100.0;

      return res.json({ success: true, data: { todayBookings, monthBookings, monthRevenue: monthRevenueVal, occupancyRate, upcomingCheckins, recentBookings } });
    }

    // Fallback to MySQL
    // Total bookings today
    const todayBookingsRes = await query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE DATE(created_at) = CURDATE()
    `);

    // Total bookings this month
    const monthBookingsRes = await query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
    `);

    // Revenue this month
    const monthRevenueRes = await query(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM bookings
      WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
      AND status IN ('confirmed', 'checked_in', 'checked_out')
    `);

    // Occupancy rate
    const occupancyRateRes = await query(`
      SELECT 
        ROUND(
          (COUNT(CASE WHEN status IN ('confirmed', 'checked_in') THEN 1 END) * 100.0 / 
           (SELECT COUNT(*) FROM rooms WHERE status != 'maintenance')
          ), 2
        ) as rate
      FROM bookings
      WHERE check_in_date <= CURDATE() AND check_out_date > CURDATE()
    `);

    // Upcoming check-ins (next 7 days)
    const upcomingCheckinsRes = await query(`
      SELECT b.*, g.first_name, g.last_name, r.room_number
      FROM bookings b
      LEFT JOIN guests g ON b.guest_id = g.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.check_in_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      AND b.status = 'confirmed'
      ORDER BY b.check_in_date
      LIMIT 10
    `);

    // Recent bookings
    const recentBookingsRes = await query(`
      SELECT b.*, g.first_name, g.last_name, r.room_number
      FROM bookings b
      LEFT JOIN guests g ON b.guest_id = g.id
      LEFT JOIN rooms r ON b.room_id = r.id
      ORDER BY b.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        todayBookings: parseInt(todayBookingsRes.rows[0].count),
        monthBookings: parseInt(monthBookingsRes.rows[0].count),
        monthRevenue: parseFloat(monthRevenueRes.rows[0].total),
        occupancyRate: parseFloat(occupancyRateRes.rows[0].rate || 0),
        upcomingCheckins: upcomingCheckinsRes.rows,
        recentBookings: recentBookingsRes.rows
      }
    });
  } catch (error) {
    console.error('Booking dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking dashboard data'
    });
  }
});

// Delete booking (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // If Mongo available
    if (Booking && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const bookingDoc = await Booking.findById(id).lean();
      if (!bookingDoc) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (!['pending','cancelled'].includes(bookingDoc.status)) return res.status(400).json({ success: false, message: 'Cannot delete active bookings' });
      await Booking.findByIdAndDelete(id);
      return res.json({ success: true, message: 'Booking deleted successfully' });
    }

    // Fallback MySQL
    // Check if booking exists
    const bookingResult = await query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!bookingResult.rows || bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // Only allow deletion of pending or cancelled bookings
    if (!['pending', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active bookings'
      });
    }

    // Delete booking
    await query('DELETE FROM bookings WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    console.error('Booking deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting booking'
    });
  }
});

module.exports = router;
