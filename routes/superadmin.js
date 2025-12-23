const express = require('express');
const router = express.Router();
const { Hotel, Employee, Role, Department } = require('../models');
const superAdminAuth = require('../middleware/superAdminAuth');

// Hotel Management
router.get('/hotels', superAdminAuth, async (req, res, next) => {
    try {
        const hotels = await Hotel.findAll({
            include: [
                { model: Employee, as: 'employees' },
                { model: Department, as: 'departments' }
            ]
        });
        res.json({ hotels });
    } catch (err) {
        next(err);
    }
});

router.post('/hotels', superAdminAuth, async (req, res, next) => {
    try {
        const { name, location, contact, email } = req.body;
        const hotel = await Hotel.create({ name, location, contact, email });
        res.status(201).json({ hotel });
    } catch (err) {
        next(err);
    }
});

router.put('/hotels/:id', superAdminAuth, async (req, res, next) => {
    try {
        const hotel = await Hotel.findByPk(req.params.id);
        if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
        await hotel.update(req.body);
        res.json({ hotel });
    } catch (err) {
        next(err);
    }
});

router.delete('/hotels/:id', superAdminAuth, async (req, res, next) => {
    try {
        const hotel = await Hotel.findByPk(req.params.id);
        if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
        await hotel.destroy();
        res.json({ message: 'Hotel deleted' });
    } catch (err) {
        next(err);
    }
});

// Role Management
router.get('/roles', superAdminAuth, async (req, res, next) => {
    try {
        const roles = await Role.findAll();
        res.json({ roles });
    } catch (err) {
        next(err);
    }
});

router.post('/roles', superAdminAuth, async (req, res, next) => {
    try {
        const { name, permissions } = req.body;
        const role = await Role.create({ name, permissions });
        res.status(201).json({ role });
    } catch (err) {
        next(err);
    }
});

router.put('/roles/:id', superAdminAuth, async (req, res, next) => {
    try {
        const role = await Role.findByPk(req.params.id);
        if (!role) return res.status(404).json({ error: 'Role not found' });
        await role.update(req.body);
        res.json({ role });
    } catch (err) {
        next(err);
    }
});

// Global Analytics
router.get('/analytics', superAdminAuth, async (req, res, next) => {
    try {
        const totalHotels = await Hotel.count();
        const totalEmployees = await Employee.count({ where: { status: 'active' } });
        const totalDepartments = await Department.count();

        res.json({
            analytics: {
                totalHotels,
                totalEmployees,
                totalDepartments
            }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
