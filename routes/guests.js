const express = require('express');
const router = express.Router();
const { Guest, Reservation, Billing } = require('../models');
const guestAuth = require('../middleware/guestAuth');
const receptionistAuth = require('../middleware/receptionistAuth');
const adminAuth = require('../middleware/adminAuth');

// Get all guests (Receptionist/Admin/SuperAdmin)
router.get('/', receptionistAuth, async (req, res, next) => {
    try {
        const guests = await Guest.findAll({
            order: [['created_at', 'DESC']]
        });
        res.json({ guests });
    } catch (err) {
        next(err);
    }
});

// Get single guest
router.get('/:id', receptionistAuth, async (req, res, next) => {
    try {
        const guest = await Guest.findByPk(req.params.id, {
            include: [
                { model: Reservation, as: 'reservations' },
                { model: Billing, as: 'billings' }
            ]
        });
        if (!guest) return res.status(404).json({ error: 'Guest not found' });
        res.json({ guest });
    } catch (err) {
        next(err);
    }
});

// Get own profile (Guest)
router.get('/me/profile', guestAuth, async (req, res, next) => {
    try {
        const guest = await Guest.findByPk(req.user.id);
        if (!guest) return res.status(404).json({ error: 'Guest not found' });
        res.json({ guest });
    } catch (err) {
        next(err);
    }
});

// Update own profile (Guest)
router.put('/me/profile', guestAuth, async (req, res, next) => {
    try {
        const guest = await Guest.findByPk(req.user.id);
        if (!guest) return res.status(404).json({ error: 'Guest not found' });

        const { first_name, last_name, contact, address } = req.body;
        await guest.update({ first_name, last_name, contact, address });
        
        res.json({ guest });
    } catch (err) {
        next(err);
    }
});

// Get own reservations (Guest)
router.get('/me/reservations', guestAuth, async (req, res, next) => {
    try {
        const reservations = await Reservation.findAll({
            where: { guest_id: req.user.id },
            include: [{ model: require('../models').Room, as: 'room' }],
            order: [['created_at', 'DESC']]
        });
        res.json({ reservations });
    } catch (err) {
        next(err);
    }
});

// Get own billings (Guest)
router.get('/me/billings', guestAuth, async (req, res, next) => {
    try {
        const billings = await Billing.findAll({
            where: { guest_id: req.user.id },
            include: [{ model: Reservation, as: 'reservation' }],
            order: [['created_at', 'DESC']]
        });
        res.json({ billings });
    } catch (err) {
        next(err);
    }
});

// Update guest (Admin/Receptionist)
router.put('/:id', receptionistAuth, async (req, res, next) => {
    try {
        const guest = await Guest.findByPk(req.params.id);
        if (!guest) return res.status(404).json({ error: 'Guest not found' });
        await guest.update(req.body);
        res.json({ guest });
    } catch (err) {
        next(err);
    }
});

// Delete guest (Admin only)
router.delete('/:id', adminAuth, async (req, res, next) => {
    try {
        const guest = await Guest.findByPk(req.params.id);
        if (!guest) return res.status(404).json({ error: 'Guest not found' });
        await guest.destroy();
        res.json({ message: 'Guest deleted' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

