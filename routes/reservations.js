const express = require('express');
const router = express.Router();
const { Reservation, Room, Guest, Billing } = require('../models');
const guestAuth = require('../middleware/guestAuth');
const receptionistAuth = require('../middleware/receptionistAuth');
const adminAuth = require('../middleware/adminAuth');

// Get all reservations (Receptionist/Admin)
router.get('/', receptionistAuth, async (req, res, next) => {
    try {
        const { status, guest_id } = req.query;
        const where = {};
        if (status) where.status = status;
        if (guest_id) where.guest_id = guest_id;

        const reservations = await Reservation.findAll({
            where,
            include: [
                { model: Guest, as: 'guest' },
                { model: Room, as: 'room' }
            ],
            order: [['created_at', 'DESC']]
        });
        res.json({ reservations });
    } catch (err) {
        next(err);
    }
});

// Get single reservation
router.get('/:id', receptionistAuth, async (req, res, next) => {
    try {
        const reservation = await Reservation.findByPk(req.params.id, {
            include: [
                { model: Guest, as: 'guest' },
                { model: Room, as: 'room' },
                { model: Billing, as: 'billing' }
            ]
        });
        if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
        res.json({ reservation });
    } catch (err) {
        next(err);
    }
});

// Create reservation (Guest or Receptionist)
router.post('/', guestAuth, async (req, res, next) => {
    try {
        const { room_id, start_date, end_date } = req.body;
        const guest_id = req.user.role === 'guest' ? req.user.id : req.body.guest_id;

        if (!room_id || !start_date || !end_date) {
            return res.status(400).json({ error: 'Room ID, start date, and end date are required' });
        }

        if (!guest_id) {
            return res.status(400).json({ error: 'Guest ID is required' });
        }

        // Check room availability
        const room = await Room.findByPk(room_id);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        if (room.status !== 'available') {
            return res.status(400).json({ error: 'Room is not available' });
        }

        // Check for conflicting reservations
        const conflicts = await Reservation.findAll({
            where: {
                room_id,
                status: ['confirmed', 'checked_in'],
                [require('sequelize').Op.or]: [
                    {
                        start_date: { [require('sequelize').Op.lte]: end_date },
                        end_date: { [require('sequelize').Op.gte]: start_date }
                    }
                ]
            }
        });

        if (conflicts.length > 0) {
            return res.status(400).json({ error: 'Room is already booked for these dates' });
        }

        // Calculate total price
        const start = new Date(start_date);
        const end = new Date(end_date);
        const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const total_price = room.price * nights;

        const reservation = await Reservation.create({
            guest_id,
            room_id,
            start_date,
            end_date,
            total_price,
            status: 'pending'
        });

        const created = await Reservation.findByPk(reservation.id, {
            include: [
                { model: Guest, as: 'guest' },
                { model: Room, as: 'room' }
            ]
        });

        res.status(201).json({ reservation: created });
    } catch (err) {
        next(err);
    }
});

// Update reservation (Receptionist/Admin)
router.put('/:id', receptionistAuth, async (req, res, next) => {
    try {
        const reservation = await Reservation.findByPk(req.params.id);
        if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

        await reservation.update(req.body);
        const updated = await Reservation.findByPk(reservation.id, {
            include: [
                { model: Guest, as: 'guest' },
                { model: Room, as: 'room' }
            ]
        });

        res.json({ reservation: updated });
    } catch (err) {
        next(err);
    }
});

// Cancel reservation (Guest or Receptionist/Admin)
router.put('/:id/cancel', guestAuth, async (req, res, next) => {
    try {
        const reservation = await Reservation.findByPk(req.params.id);
        if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

        // Check if user owns this reservation or is staff
        if (req.user.role === 'guest' && reservation.guest_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await reservation.update({ status: 'cancelled' });
        res.json({ reservation });
    } catch (err) {
        next(err);
    }
});

// Check-in (Receptionist/Admin)
router.put('/:id/checkin', receptionistAuth, async (req, res, next) => {
    try {
        const reservation = await Reservation.findByPk(req.params.id);
        if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

        await reservation.update({ status: 'checked_in' });
        await Room.update({ status: 'occupied' }, { where: { id: reservation.room_id } });

        const updated = await Reservation.findByPk(reservation.id, {
            include: [
                { model: Guest, as: 'guest' },
                { model: Room, as: 'room' }
            ]
        });

        res.json({ reservation: updated });
    } catch (err) {
        next(err);
    }
});

// Check-out (Receptionist/Admin)
router.put('/:id/checkout', receptionistAuth, async (req, res, next) => {
    try {
        const reservation = await Reservation.findByPk(req.params.id);
        if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

        await reservation.update({ status: 'checked_out' });
        await Room.update({ status: 'available' }, { where: { id: reservation.room_id } });

        const updated = await Reservation.findByPk(reservation.id, {
            include: [
                { model: Guest, as: 'guest' },
                { model: Room, as: 'room' }
            ]
        });

        res.json({ reservation: updated });
    } catch (err) {
        next(err);
    }
});

// Get own reservations (Guest)
router.get('/me/list', guestAuth, async (req, res, next) => {
    try {
        const reservations = await Reservation.findAll({
            where: { guest_id: req.user.id },
            include: [{ model: Room, as: 'room' }],
            order: [['created_at', 'DESC']]
        });
        res.json({ reservations });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
