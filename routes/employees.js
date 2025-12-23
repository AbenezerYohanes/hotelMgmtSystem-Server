const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const { Employee, Role, Department, Hotel, Attendance, LeaveRequest, Payroll, PerformanceReview, EmployeeDocument } = require('../models');
const staffAuth = require('../middleware/staffAuth');
const adminAuth = require('../middleware/adminAuth');
const superAdminAuth = require('../middleware/superAdminAuth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/profiles'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Get all employees (Admin/SuperAdmin only)
router.get('/', adminAuth, async (req, res, next) => {
    try {
        const employees = await Employee.findAll({
            include: [
                { model: Role, as: 'role' },
                { model: Hotel, as: 'hotel' },
                { model: Department, as: 'department' }
            ]
        });
        res.json({ employees });
    } catch (err) {
        next(err);
    }
});

// Get single employee
router.get('/:id', adminAuth, async (req, res, next) => {
    try {
        const employee = await Employee.findByPk(req.params.id, {
            include: [
                { model: Role, as: 'role' },
                { model: Hotel, as: 'hotel' },
                { model: Department, as: 'department' }
            ]
        });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        res.json({ employee });
    } catch (err) {
        next(err);
    }
});

// Create employee (Admin/SuperAdmin)
router.post('/', adminAuth, upload.single('picture'), async (req, res, next) => {
    try {
        const { first_name, last_name, email, password, role_id, hotel_id, contact, address, working_year } = req.body;
        
        const exists = await Employee.findOne({ where: { email } });
        if (exists) return res.status(400).json({ error: 'Email already exists' });

        const hashed = await bcrypt.hash(password, 10);
        const picture = req.file ? `/uploads/profiles/${req.file.filename}` : null;

        const employee = await Employee.create({
            first_name,
            last_name,
            email,
            password: hashed,
            role_id,
            hotel_id: hotel_id || req.user.hotel_id,
            contact,
            address,
            working_year: working_year || 0,
            total_working_year: working_year || 0,
            picture,
            status: 'active'
        });

        const created = await Employee.findByPk(employee.id, {
            include: [{ model: Role, as: 'role' }]
        });

        res.status(201).json({ employee: created });
    } catch (err) {
        next(err);
    }
});

// Update employee
router.put('/:id', adminAuth, upload.single('picture'), async (req, res, next) => {
    try {
        const employee = await Employee.findByPk(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const updates = { ...req.body };
        if (req.file) {
            updates.picture = `/uploads/profiles/${req.file.filename}`;
        }
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        }

        await employee.update(updates);
        const updated = await Employee.findByPk(employee.id, {
            include: [{ model: Role, as: 'role' }]
        });

        res.json({ employee: updated });
    } catch (err) {
        next(err);
    }
});

// Delete employee (SuperAdmin only)
router.delete('/:id', superAdminAuth, async (req, res, next) => {
    try {
        const employee = await Employee.findByPk(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        await employee.update({ status: 'terminated' });
        res.json({ message: 'Employee terminated' });
    } catch (err) {
        next(err);
    }
});

// Get own profile (Staff/Receptionist)
router.get('/me/profile', staffAuth, async (req, res, next) => {
    try {
        const employee = await Employee.findByPk(req.user.id, {
            include: [
                { model: Role, as: 'role' },
                { model: Hotel, as: 'hotel' }
            ]
        });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        res.json({ employee });
    } catch (err) {
        next(err);
    }
});

// Get own attendance
router.get('/me/attendance', staffAuth, async (req, res, next) => {
    try {
        const attendance = await Attendance.findAll({
            where: { employee_id: req.user.id },
            order: [['date', 'DESC']],
            limit: 30
        });
        res.json({ attendance });
    } catch (err) {
        next(err);
    }
});

// Get own leave requests
router.get('/me/leaves', staffAuth, async (req, res, next) => {
    try {
        const leaves = await LeaveRequest.findAll({
            where: { employee_id: req.user.id },
            order: [['created_at', 'DESC']]
        });
        res.json({ leaves });
    } catch (err) {
        next(err);
    }
});

// Get own payroll
router.get('/me/payroll', staffAuth, async (req, res, next) => {
    try {
        const payrolls = await Payroll.findAll({
            where: { employee_id: req.user.id },
            order: [['date', 'DESC']]
        });
        res.json({ payrolls });
    } catch (err) {
        next(err);
    }
});

// Get own performance reviews
router.get('/me/reviews', staffAuth, async (req, res, next) => {
    try {
        const reviews = await PerformanceReview.findAll({
            where: { employee_id: req.user.id },
            include: [{ model: Employee, as: 'reviewer', attributes: ['id', 'first_name', 'last_name'] }],
            order: [['date', 'DESC']]
        });
        res.json({ reviews });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
