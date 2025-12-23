const express = require('express');
const router = express.Router();
const { Employee, Attendance, LeaveRequest, Payroll, PerformanceReview, Department, Shift } = require('../models');
const adminAuth = require('../middleware/adminAuth');

// HR Management Routes

// Get HR Dashboard Stats
router.get('/hr/dashboard', adminAuth, async (req, res, next) => {
    try {
        const hotel_id = req.user.hotel_id;
        
        const totalEmployees = await Employee.count({ where: { hotel_id, status: 'active' } });
        const totalDepartments = await Department.count({ where: { hotel_id } });
        const pendingLeaves = await LeaveRequest.count({ 
            where: { status: 'pending' },
            include: [{ model: Employee, as: 'employee', where: { hotel_id } }]
        });
        const todayAttendance = await Attendance.count({ 
            where: { date: new Date().toISOString().split('T')[0], status: 'present' },
            include: [{ model: Employee, as: 'employee', where: { hotel_id } }]
        });

        res.json({
            stats: {
                totalEmployees,
                totalDepartments,
                pendingLeaves,
                todayAttendance
            }
        });
    } catch (err) {
        next(err);
    }
});

// Attendance Management
router.post('/hr/attendance', adminAuth, async (req, res, next) => {
    try {
        const { employee_id, date, clock_in, clock_out, status } = req.body;
        
        const [attendance, created] = await Attendance.findOrCreate({
            where: { employee_id, date },
            defaults: { employee_id, date, clock_in, clock_out, status: status || 'present' }
        });

        if (!created) {
            await attendance.update({ clock_in, clock_out, status: status || attendance.status });
        }

        res.json({ attendance });
    } catch (err) {
        next(err);
    }
});

// Leave Request Management
router.get('/hr/leaves', adminAuth, async (req, res, next) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status) where.status = status;

        const leaves = await LeaveRequest.findAll({
            where,
            include: [{ model: Employee, as: 'employee' }],
            order: [['created_at', 'DESC']]
        });
        res.json({ leaves });
    } catch (err) {
        next(err);
    }
});

router.put('/hr/leaves/:id', adminAuth, async (req, res, next) => {
    try {
        const { status } = req.body;
        const leave = await LeaveRequest.findByPk(req.params.id);
        if (!leave) return res.status(404).json({ error: 'Leave request not found' });

        await leave.update({ status });
        res.json({ leave });
    } catch (err) {
        next(err);
    }
});

// Payroll Management
router.post('/hr/payroll', adminAuth, async (req, res, next) => {
    try {
        const { employee_id, salary, allowances, deductions, date } = req.body;
        
        const payroll = await Payroll.create({
            employee_id,
            salary,
            allowances: allowances || 0,
            deductions: deductions || 0,
            date
        });

        res.status(201).json({ payroll });
    } catch (err) {
        next(err);
    }
});

router.get('/hr/payroll', adminAuth, async (req, res, next) => {
    try {
        const { employee_id, date } = req.query;
        const where = {};
        if (employee_id) where.employee_id = employee_id;
        if (date) where.date = date;

        const payrolls = await Payroll.findAll({
            where,
            include: [{ model: Employee, as: 'employee' }],
            order: [['date', 'DESC']]
        });
        res.json({ payrolls });
    } catch (err) {
        next(err);
    }
});

// Performance Review Management
router.post('/hr/reviews', adminAuth, async (req, res, next) => {
    try {
        const { employee_id, rating, comments, date } = req.body;
        
        const review = await PerformanceReview.create({
            employee_id,
            reviewer_id: req.user.id,
            rating,
            comments,
            date: date || new Date().toISOString().split('T')[0]
        });

        res.status(201).json({ review });
    } catch (err) {
        next(err);
    }
});

router.get('/hr/reviews', adminAuth, async (req, res, next) => {
    try {
        const { employee_id } = req.query;
        const where = {};
        if (employee_id) where.employee_id = employee_id;

        const reviews = await PerformanceReview.findAll({
            where,
            include: [
                { model: Employee, as: 'employee' },
                { model: Employee, as: 'reviewer' }
            ],
            order: [['date', 'DESC']]
        });
        res.json({ reviews });
    } catch (err) {
        next(err);
    }
});

// Department Management
router.get('/hr/departments', adminAuth, async (req, res, next) => {
    try {
        const departments = await Department.findAll({
            where: { hotel_id: req.user.hotel_id }
        });
        res.json({ departments });
    } catch (err) {
        next(err);
    }
});

router.post('/hr/departments', adminAuth, async (req, res, next) => {
    try {
        const { name } = req.body;
        const department = await Department.create({
            name,
            hotel_id: req.user.hotel_id
        });
        res.status(201).json({ department });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
