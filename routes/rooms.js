const express = require('express');
const router = express.Router();
const { Room, Hotel, Reservation } = require('../models');
const adminAuth = require('../middleware/adminAuth');
const receptionistAuth = require('../middleware/receptionistAuth');

// Get all rooms (Public for browsing, Auth for management)
router.get('/', async (req, res, next) => {
    try {
        const { status, hotel_id, room_type } = req.query;
        const where = {};
        if (status) where.status = status;
        if (hotel_id) where.hotel_id = hotel_id;
        if (room_type) where.room_type = room_type;

        const rooms = await Room.findAll({
            where,
            include: [{ model: Hotel, as: 'hotel' }],
            order: [['created_at', 'DESC']]
        });
        res.json({ rooms });
    } catch (err) {
        next(err);
    }
});

// Get single room
router.get('/:id', async (req, res, next) => {
    try {
        const room = await Room.findByPk(req.params.id, {
            include: [
                { model: Hotel, as: 'hotel' },
                { model: Reservation, as: 'reservations' }
            ]
        });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json({ room });
    } catch (err) {
        next(err);
    }
});

// Create room (Admin/SuperAdmin)
router.post('/', adminAuth, async (req, res, next) => {
    try {
        const { hotel_id, room_type, location, capacity, amenities, price } = req.body;
        
        const room = await Room.create({
            hotel_id: hotel_id || req.user.hotel_id,
            room_type,
            location,
            capacity: capacity || 1,
            amenities: amenities || [],
            price: price || 0.00,
            status: 'available'
        });

        const created = await Room.findByPk(room.id, {
            include: [{ model: Hotel, as: 'hotel' }]
        });

        res.status(201).json({ room: created });
    } catch (err) {
        next(err);
    }
});

// Update room (Admin/SuperAdmin)
router.put('/:id', adminAuth, async (req, res, next) => {
    try {
        const room = await Room.findByPk(req.params.id);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        await room.update(req.body);
        const updated = await Room.findByPk(room.id, {
            include: [{ model: Hotel, as: 'hotel' }]
        });
        res.json({ room: updated });
    } catch (err) {
        next(err);
    }
});

// Delete room (Admin/SuperAdmin)
router.delete('/:id', adminAuth, async (req, res, next) => {
    try {
        const room = await Room.findByPk(req.params.id);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        await room.destroy();
        res.json({ message: 'Room deleted' });
    } catch (err) {
        next(err);
    }
});

// Get available rooms for date range (Public/Guest)
router.get('/available/check', async (req, res, next) => {
    try {
        const { start_date, end_date, hotel_id } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date required' });
        }

        // Get all rooms
        const allRooms = await Room.findAll({
            where: { 
                status: 'available',
                ...(hotel_id && { hotel_id })
            }
        });

        // Get reserved rooms for the date range
        const reserved = await Reservation.findAll({
            where: {
                status: ['confirmed', 'checked_in'],
                [require('sequelize').Op.or]: [
                    {
                        start_date: { [require('sequelize').Op.lte]: end_date },
                        end_date: { [require('sequelize').Op.gte]: start_date }
                    }
                ]
            }
        });

        const reservedRoomIds = reserved.map(r => r.room_id);
        const availableRooms = allRooms.filter(r => !reservedRoomIds.includes(r.id));

        res.json({ rooms: availableRooms });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
