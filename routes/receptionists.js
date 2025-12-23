const express = require('express');
const router = express.Router();
const { Reservation, Guest, Room, Billing } = require('../models');
const receptionistAuth = require('../middleware/receptionistAuth');

// Dashboard Stats
router.get('/dashboard', receptionistAuth, async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const totalReservations = await Reservation.count();
        const todayCheckIns = await Reservation.count({
            where: { start_date: today, status: 'confirmed' }
        });
        const todayCheckOuts = await Reservation.count({
            where: { end_date: today, status: 'checked_in' }
        });
        const pendingReservations = await Reservation.count({
            where: { status: 'pending' }
        });

        res.json({
            stats: {
                totalReservations,
                todayCheckIns,
                todayCheckOuts,
                pendingReservations
            }
        });
    } catch (err) {
        next(err);
    }
});

// Quick Check-in
router.post('/checkin', receptionistAuth, async (req, res, next) => {
    try {
        const { reservation_id } = req.body;
        const reservation = await Reservation.findByPk(reservation_id);
        if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

        await reservation.update({ status: 'checked_in' });
        await Room.update({ status: 'occupied' }, { where: { id: reservation.room_id } });

        res.json({ reservation });
    } catch (err) {
        next(err);
    }
});

// Quick Check-out
router.post('/checkout', receptionistAuth, async (req, res, next) => {
    try {
        const { reservation_id } = req.body;
        const reservation = await Reservation.findByPk(reservation_id);
        if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

        await reservation.update({ status: 'checked_out' });
        await Room.update({ status: 'available' }, { where: { id: reservation.room_id } });

        // Create billing if not exists
        const existingBilling = await Billing.findOne({ where: { reservation_id } });
        if (!existingBilling) {
            await Billing.create({
                reservation_id,
                guest_id: reservation.guest_id,
                amount: reservation.total_price,
                payment_method: 'cash',
                status: 'pending'
            });
        }

        res.json({ reservation });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

