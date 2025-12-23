const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Employee, Guest, Role } = require('../models');

// Employee/Staff/Receptionist/Admin/SuperAdmin Login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const employee = await Employee.findOne({ 
            where: { email },
            include: [{ model: Role, as: 'role' }]
        });

        if (!employee) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (employee.status !== 'active') {
            return res.status(403).json({ error: 'Account is inactive' });
        }

        const match = await bcrypt.compare(password, employee.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const roleName = employee.role ? employee.role.name : 'staff';
        const payload = { 
            id: employee.id, 
            email: employee.email, 
            role: roleName,
            role_id: employee.role_id,
            hotel_id: employee.hotel_id,
            first_name: employee.first_name,
            last_name: employee.last_name
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
        res.json({ 
            token, 
            user: {
                id: employee.id,
                email: employee.email,
                role: roleName,
                first_name: employee.first_name,
                last_name: employee.last_name,
                hotel_id: employee.hotel_id
            }
        });
    } catch (err) {
        next(err);
    }
});

// Guest Register
router.post('/guest/register', async (req, res, next) => {
    try {
        const { email, password, first_name, last_name, contact, address } = req.body;
        
        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
        }

        const exists = await Guest.findOne({ where: { email } });
        if (exists) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const guest = await Guest.create({ 
            email, 
            password: hashed, 
            first_name, 
            last_name,
            contact: contact || null,
            address: address || null
        });

        const payload = { id: guest.id, email: guest.email, role: 'guest' };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });

        res.status(201).json({ 
            token,
            guest: {
                id: guest.id,
                email: guest.email,
                first_name: guest.first_name,
                last_name: guest.last_name
            }
        });
    } catch (err) {
        next(err);
    }
});

// Guest Login
router.post('/guest/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const guest = await Guest.findOne({ where: { email } });
        if (!guest) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, guest.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const payload = { id: guest.id, email: guest.email, role: 'guest' };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });

        res.json({ 
            token, 
            guest: {
                id: guest.id,
                email: guest.email,
                first_name: guest.first_name,
                last_name: guest.last_name
            }
        });
    } catch (err) {
        next(err);
    }
});

// Get current user (for token verification)
router.get('/me', async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        
        if (decoded.role === 'guest') {
            const guest = await Guest.findByPk(decoded.id);
            if (!guest) return res.status(404).json({ error: 'Guest not found' });
            return res.json({ user: { id: guest.id, email: guest.email, role: 'guest', first_name: guest.first_name, last_name: guest.last_name } });
        } else {
            const employee = await Employee.findByPk(decoded.id, {
                include: [{ model: Role, as: 'role' }]
            });
            if (!employee) return res.status(404).json({ error: 'Employee not found' });
            return res.json({ 
                user: {
                    id: employee.id,
                    email: employee.email,
                    role: employee.role?.name || 'staff',
                    first_name: employee.first_name,
                    last_name: employee.last_name,
                    hotel_id: employee.hotel_id
                }
            });
        }
    } catch (err) {
        next(err);
    }
});

module.exports = router;
