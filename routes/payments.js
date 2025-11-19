const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/config');
let Payment = null, Booking = null, mongoose = null;
try {
  Payment = require('../models/Payment');
  Booking = require('../models/Booking');
  mongoose = require('mongoose');
} catch (e) {
  Payment = null; Booking = null; mongoose = null;
}

const router = express.Router();

// Add a payment
router.post('/', async (req, res) => {
  try {
    const { booking_id, amount, date, method, metadata } = req.body;
    if (Payment && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const created = await Payment.create({ booking_id, amount, date: date ? new Date(date) : undefined, method, metadata });
      return res.status(201).json({ payment_id: created._id });
    }
    const result = await query(
      'INSERT INTO payments (booking_id, amount, date, method) VALUES (?, ?, ?, ?)',
      [booking_id, amount, date, method]
    );
    res.status(201).json({ payment_id: result.insertId || (result.rows && result.rows.insertId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all payments
router.get('/', async (req, res) => {
  try {
    if (Payment && Booking && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const items = await Payment.aggregate([
        { $lookup: { from: 'bookings', localField: 'booking_id', foreignField: '_id', as: 'booking' } },
        { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
        { $project: { amount:1, date:1, method:1, booking_id: '$booking._id' } }
      ]);
      return res.json(items);
    }

    const payments = await query(
      `SELECT p.*, b.id AS booking_id, g.name AS guest_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN guests g ON b.guest_id = g.id`
    );
    res.json(payments.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get daily/weekly revenue summary
router.get('/summary', async (req, res) => {
  try {
    if (Payment && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const startOfToday = new Date(new Date().setHours(0,0,0,0));
      const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); startOfWeek.setHours(0,0,0,0);
      const daily = await Payment.aggregate([{ $match: { date: { $gte: startOfToday } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } }]);
      const weekly = await Payment.aggregate([{ $match: { date: { $gte: startOfWeek } } }, { $group: { _id: { $week: '$date' }, total: { $sum: '$amount' } } }]);
      return res.json({ daily: daily[0] || {}, weekly: weekly[0] || {} });
    }

    const daily = await query(
      `SELECT DATE(date) AS day, SUM(amount) AS total
       FROM payments
       WHERE DATE(date) = CURDATE()
       GROUP BY day`
    );
    const weekly = await query(
      `SELECT WEEK(date) AS week, SUM(amount) AS total
       FROM payments
       WHERE YEAR(date) = YEAR(CURDATE()) AND WEEK(date) = WEEK(CURDATE())
       GROUP BY week`
    );
    res.json({ daily: daily.rows[0] || {}, weekly: weekly.rows[0] || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;