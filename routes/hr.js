const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/config');
const { isManager } = require('../middleware/auth');
let Department = null, Employee = null, User = null, mongoose = null;
try {
  Department = require('../models/Department');
  Employee = require('../models/Employee');
  User = require('../models/User');
  mongoose = require('mongoose');
} catch (e) {
  Department = null; Employee = null; User = null; mongoose = null;
}

const router = express.Router();

// Get all departments
router.get('/departments', async (req, res) => {
  try {
    if (Department && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const docs = await Department.aggregate([
        { $lookup: { from: 'users', localField: 'manager_id', foreignField: '_id', as: 'manager' } },
        { $unwind: { path: '$manager', preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, description: 1, manager_id:1, manager_name: { $concat: ['$manager.first_name',' ','$manager.last_name'] } } },
        { $sort: { name: 1 } }
      ]);
      return res.json({ success: true, data: docs });
    }

    const result = await query(`
      SELECT d.*, u.first_name, u.last_name as manager_name
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.id
      ORDER BY d.name
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Departments error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching departments' 
    });
  }
});

// Create new department
router.post('/departments', isManager, [
  body('name').notEmpty().withMessage('Department name is required'),
  body('description').optional(),
  body('manager_id').optional().isInt().withMessage('Manager ID must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: errors.array() 
      });
    }

    const { name, description, manager_id } = req.body;

    if (Department && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const created = await Department.create({ name, description, manager_id: manager_id || null });
      const doc = await Department.aggregate([
        { $match: { _id: created._id } },
        { $lookup: { from: 'users', localField: 'manager_id', foreignField: '_id', as: 'manager' } },
        { $unwind: { path: '$manager', preserveNullAndEmptyArrays: true } },
        { $project: { name:1, description:1, manager_id:1, manager_name: { $concat: ['$manager.first_name',' ','$manager.last_name'] } } }
      ]);
      return res.status(201).json({ success: true, message: 'Department created successfully', data: doc[0] });
    }

    // MySQL doesn't support RETURNING; perform INSERT then SELECT the created row
    const insertResult = await query(
      'INSERT INTO departments (name, description, manager_id) VALUES (?, ?, ?)',
      [name, description, manager_id]
    );

    // insertResult.rows for INSERT is the OkPacket object from mysql2
    const insertedId = insertResult.rows && insertResult.rows.insertId;

    if (!insertedId) {
      // fallback: try to fetch by unique name if insertId not available
      const fallback = await query('SELECT * FROM departments WHERE name = ? ORDER BY id DESC LIMIT 1', [name]);
      return res.status(201).json({
        success: true,
        message: 'Department created successfully',
        data: fallback.rows[0]
      });
    }

    const created = await query('SELECT d.*, u.first_name, u.last_name as manager_name FROM departments d LEFT JOIN users u ON d.manager_id = u.id WHERE d.id = ?', [insertedId]);

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: created.rows[0]
    });
  } catch (error) {
    console.error('Department creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating department' 
    });
  }
});

// Update department
router.put('/departments/:id', isManager, [
  body('name').optional().notEmpty().withMessage('Department name cannot be empty'),
  body('description').optional(),
  body('manager_id').optional().isInt().withMessage('Manager ID must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { name, description, manager_id } = req.body;

    if (Department && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const updated = await Department.findByIdAndUpdate(id, { $set: { name, description, manager_id: manager_id ? manager_id : undefined } }, { new: true }).lean();
      if (!updated) return res.status(404).json({ success: false, message: 'Department not found' });
      const doc = await Department.aggregate([
        { $match: { _id: updated._id } },
        { $lookup: { from: 'users', localField: 'manager_id', foreignField: '_id', as: 'manager' } },
        { $unwind: { path: '$manager', preserveNullAndEmptyArrays: true } },
        { $project: { name:1, description:1, manager_id:1, manager_name: { $concat: ['$manager.first_name',' ','$manager.last_name'] } } }
      ]);
      return res.json({ success: true, message: 'Department updated successfully', data: doc[0] });
    }

    const updateResult = await query(
      `UPDATE departments SET 
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       manager_id = COALESCE(?, manager_id)
       WHERE id = ?`,
      [name, description, manager_id, id]
    );

    const updated = await query('SELECT d.*, u.first_name, u.last_name as manager_name FROM departments d LEFT JOIN users u ON d.manager_id = u.id WHERE d.id = ?', [id]);

    if (!updated.rows || updated.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    res.json({ success: true, message: 'Department updated successfully', data: updated.rows[0] });
  } catch (error) {
    console.error('Department update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating department' 
    });
  }
});

// Get all employees
router.get('/employees', async (req, res) => {
  try {
    const { page = 1, limit = 10, department_id, status } = req.query;
    const offset = (page - 1) * limit;

    if (Employee && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const filter = {};
      if (department_id) filter.department_id = mongoose.Types.ObjectId(department_id);
      if (status) filter.status = status;
      const [items, total] = await Promise.all([
        Employee.find(filter).populate('user_id','first_name last_name email phone').populate('department_id','name').sort({ created_at: -1 }).limit(Number(limit)).skip(Number(offset)).lean(),
        Employee.countDocuments(filter)
      ]);
      return res.json({ success: true, data: items, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
    }

    const { page = 1, limit = 10, department_id: dept_q, status: status_q } = req.query;
    const offset2 = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (department_id) {
      whereClause += ` AND e.department_id = ?`;
      params.push(department_id);
    }

    if (status) {
      whereClause += ` AND e.status = ?`;
      params.push(status);
    }

    const result = await query(`
      SELECT e.*, u.first_name, u.last_name, u.email, u.phone,
             d.name as department_name
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM employees e
      ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Employees error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching employees' 
    });
  }
});

// Create new employee
router.post('/employees', isManager, [
  body('user_id').isInt().withMessage('User ID is required'),
  body('employee_id').notEmpty().withMessage('Employee ID is required'),
  body('department_id').isInt().withMessage('Department ID is required'),
  body('position').notEmpty().withMessage('Position is required'),
  body('hire_date').isDate().withMessage('Valid hire date is required'),
  body('salary').isFloat({ min: 0 }).withMessage('Valid salary is required'),
  body('emergency_contact').optional(),
  body('emergency_phone').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: errors.array() 
      });
    }

    const { 
      user_id, employee_id, department_id, position, hire_date, 
      salary, emergency_contact, emergency_phone 
    } = req.body;

    if (Employee && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      // Check uniqueness by employee_id
      const exists = await Employee.findOne({ $or: [{ employee_id }, { user_id }] }).lean();
      if (exists) return res.status(409).json({ success: false, message: 'Employee already exists' });
      const created = await Employee.create({ user_id, employee_id, department_id: department_id || null, position, hire_date, salary, emergency_contact, emergency_phone });
      return res.status(201).json({ success: true, message: 'Employee created successfully', data: created });
    }

    // MySQL fallback
    const existingEmployee = await query(
      'SELECT id FROM employees WHERE employee_id = ? OR user_id = ?',
      [employee_id, user_id]
    );

    if (existingEmployee.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Employee already exists' 
      });
    }

    const insertRes = await query(
      `INSERT INTO employees (user_id, employee_id, department_id, position, hire_date, 
       salary, emergency_contact, emergency_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, employee_id, department_id, position, hire_date, salary, emergency_contact, emergency_phone]
    );

    const insertedId = insertRes.rows && insertRes.rows.insertId;
    if (!insertedId) {
      // fallback: return minimal info
      return res.status(201).json({ success: true, message: 'Employee created successfully' });
    }

    const created = await query('SELECT * FROM employees WHERE id = ?', [insertedId]);
    res.status(201).json({ success: true, message: 'Employee created successfully', data: created.rows[0] });
  } catch (error) {
    console.error('Employee creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating employee' 
    });
  }
});

// Update employee
router.put('/employees/:id', isManager, [
  body('department_id').optional().isInt().withMessage('Department ID must be a number'),
  body('position').optional().notEmpty().withMessage('Position cannot be empty'),
  body('salary').optional().isFloat({ min: 0 }).withMessage('Valid salary is required'),
  body('status').optional().isIn(['active', 'inactive', 'terminated']).withMessage('Invalid status'),
  body('emergency_contact').optional(),
  body('emergency_phone').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { department_id, position, salary, status, emergency_contact, emergency_phone } = req.body;

    if (Employee && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const updated = await Employee.findByIdAndUpdate(id, { $set: { department_id: department_id ? department_id : undefined, position, salary, status, emergency_contact, emergency_phone, updated_at: new Date() } }, { new: true }).lean();
      if (!updated) return res.status(404).json({ success: false, message: 'Employee not found' });
      return res.json({ success: true, message: 'Employee updated successfully', data: updated });
    }

    await query(
      `UPDATE employees SET 
       department_id = COALESCE(?, department_id),
       position = COALESCE(?, position),
       salary = COALESCE(?, salary),
       status = COALESCE(?, status),
       emergency_contact = COALESCE(?, emergency_contact),
       emergency_phone = COALESCE(?, emergency_phone),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [department_id, position, salary, status, emergency_contact, emergency_phone, id]
    );

    const updatedEmp = await query('SELECT * FROM employees WHERE id = ?', [id]);
    if (!updatedEmp.rows || updatedEmp.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, message: 'Employee updated successfully', data: updatedEmp.rows[0] });
  } catch (error) {
    console.error('Employee update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating employee' 
    });
  }
});

// Get employee details
router.get('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (Employee && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const doc = await Employee.findById(id).populate('user_id','first_name last_name email phone address').populate('department_id','name').lean();
      if (!doc) return res.status(404).json({ success: false, message: 'Employee not found' });
      return res.json({ success: true, data: doc });
    }

    const result = await query(`
      SELECT e.*, u.first_name, u.last_name, u.email, u.phone, u.address,
             d.name as department_name
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.id = ?
    `, [id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Employee details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching employee details' 
    });
  }
});

// Get HR dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    if (Employee && Department && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const [totalEmployees, employeesByDept, recentHires, avgSalaryByDept] = await Promise.all([
        Employee.countDocuments({ status: 'active' }),
        Employee.aggregate([
          { $match: { status: 'active' } },
          { $lookup: { from: 'departments', localField: 'department_id', foreignField: '_id', as: 'dept' } },
          { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
          { $group: { _id: '$department_id', name: { $first: '$dept.name' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Employee.find({ hire_date: { $gte: new Date(new Date().getTime() - 30*24*60*60*1000) } }).populate('user_id','first_name last_name').limit(5).lean(),
        Employee.aggregate([
          { $match: { status: 'active' } },
          { $lookup: { from: 'departments', localField: 'department_id', foreignField: '_id', as: 'dept' } },
          { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
          { $group: { _id: '$department_id', name: { $first: '$dept.name' }, avg_salary: { $avg: '$salary' } } },
          { $sort: { avg_salary: -1 } }
        ])
      ]);
      return res.json({ success: true, data: { totalEmployees, employeesByDepartment: employeesByDept, recentHires, averageSalaryByDepartment: avgSalaryByDept } });
    }

    // Total employees
    const totalEmployees = await query('SELECT COUNT(*) as count FROM employees WHERE status = ?', ['active']);
    
    // Employees by department
    const employeesByDept = await query(`
      SELECT d.name, COUNT(e.id) as count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `);

    // Recent hires (last 30 days)
    const recentHires = await query(`
      SELECT e.*, u.first_name, u.last_name, d.name as department_name
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
  WHERE e.hire_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
      ORDER BY e.hire_date DESC
      LIMIT 5
    `);

    // Average salary by department
    const avgSalaryByDept = await query(`
      SELECT d.name, AVG(e.salary) as avg_salary
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
      GROUP BY d.id, d.name
      HAVING AVG(e.salary) IS NOT NULL
      ORDER BY avg_salary DESC
    `);

    res.json({
      success: true,
      data: {
        totalEmployees: parseInt(totalEmployees.rows[0].count),
        employeesByDepartment: employeesByDept.rows,
        recentHires: recentHires.rows,
        averageSalaryByDepartment: avgSalaryByDept.rows
      }
    });
  } catch (error) {
    console.error('HR dashboard error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching HR dashboard data' 
    });
  }
});

module.exports = router; 