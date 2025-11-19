const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/config');

const router = express.Router();

// Add a payment
router.post('/', async (req, res) => {
  try {
    const { booking_id, amount, date, method } = req.body;
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