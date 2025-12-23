const express = require('express');
const router = express.Router();
const { Billing, Reservation, Guest } = require('../models');
const guestAuth = require('../middleware/guestAuth');
const receptionistAuth = require('../middleware/receptionistAuth');
const adminAuth = require('../middleware/adminAuth');

// Get all billings (Receptionist/Admin)
router.get('/', receptionistAuth, async (req, res, next) => {
    try {
        const { status, guest_id } = req.query;
        const where = {};
        if (status) where.status = status;
        if (guest_id) where.guest_id = guest_id;

        const billings = await Billing.findAll({
            where,
            include: [
                { model: Guest, as: 'guest' },
                { model: Reservation, as: 'reservation' }
            ],
            order: [['created_at', 'DESC']]
        });
        res.json({ billings });
    } catch (err) {
        next(err);
    }
});

// Get single billing
router.get('/:id', receptionistAuth, async (req, res, next) => {
    try {
        const billing = await Billing.findByPk(req.params.id, {
            include: [
                { model: Guest, as: 'guest' },
                { model: Reservation, as: 'reservation' }
            ]
        });
        if (!billing) return res.status(404).json({ error: 'Billing not found' });
        res.json({ billing });
    } catch (err) {
        next(err);
    }
});

// Create billing (Receptionist/Admin)
router.post('/', receptionistAuth, async (req, res, next) => {
    try {
        const { reservation_id, guest_id, amount, payment_method } = req.body;

        if (!guest_id || !amount) {
            return res.status(400).json({ error: 'Guest ID and amount are required' });
        }

        const billing = await Billing.create({
            reservation_id: reservation_id || null,
            guest_id,
            amount,
            payment_method: payment_method || 'cash',
            status: 'pending'
        });

        const created = await Billing.findByPk(billing.id, {
            include: [
                { model: Guest, as: 'guest' },
                { model: Reservation, as: 'reservation' }
            ]
        });

        res.status(201).json({ billing: created });
    } catch (err) {
        next(err);
    }
});

// Update billing (Receptionist/Admin)
router.put('/:id', receptionistAuth, async (req, res, next) => {
    try {
        const billing = await Billing.findByPk(req.params.id);
        if (!billing) return res.status(404).json({ error: 'Billing not found' });

        await billing.update(req.body);
        const updated = await Billing.findByPk(billing.id, {
            include: [
                { model: Guest, as: 'guest' },
                { model: Reservation, as: 'reservation' }
            ]
        });

        res.json({ billing: updated });
    } catch (err) {
        next(err);
    }
});

// Process payment (Receptionist/Admin)
router.put('/:id/pay', receptionistAuth, async (req, res, next) => {
    try {
        const { payment_method, transaction_id } = req.body;
        const billing = await Billing.findByPk(req.params.id);
        if (!billing) return res.status(404).json({ error: 'Billing not found' });

        await billing.update({
            payment_method: payment_method || billing.payment_method,
            transaction_id: transaction_id || null,
            status: 'completed'
        });

        // Update reservation status if exists
        if (billing.reservation_id) {
            await Reservation.update(
                { status: 'confirmed' },
                { where: { id: billing.reservation_id } }
            );
        }

        const updated = await Billing.findByPk(billing.id, {
            include: [
                { model: Guest, as: 'guest' },
                { model: Reservation, as: 'reservation' }
            ]
        });

        res.json({ billing: updated });
    } catch (err) {
        next(err);
    }
});

// Get own billings (Guest)
router.get('/me/list', guestAuth, async (req, res, next) => {
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

module.exports = router;
