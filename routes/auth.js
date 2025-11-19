const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/config');
// If MongoDB is available, prefer mongoose-backed User model
let UserMongo = null;
try { UserMongo = require('../models/User'); } catch (e) { UserMongo = null; }
const { authenticateToken } = require('../middleware/auth');
const { requireRole, requirePrivilege } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// Register new user (public registration for clients, superadmin for admins)
router.post('/register', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').optional(),
  body('last_name').optional(),
  body('name').optional(),
  body('role').optional().isIn(['superadmin', 'super_admin', 'admin', 'manager', 'staff', 'user', 'client']).withMessage('Invalid role')
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

    const { email, password } = req.body;
    // support multiple name inputs for backward compatibility
    let { first_name, last_name, name, role = 'client', username } = req.body;

    if (!first_name && !last_name && name) {
      const parts = String(name).trim().split(/\s+/);
      first_name = parts.shift() || '';
      last_name = parts.join(' ') || '';
    }

    // Normalize role values
    if (role === 'superadmin') role = 'super_admin';
    if (role === 'user') role = 'client';

    // Check if user already exists (Mongo or MySQL)
    if (UserMongo) {
      const found = await UserMongo.findOne({ $or: [{ email }, { username: username || null }] }).lean();
      if (found) {
        return res.status(409).json({ success: false, message: 'Email or username already exists' });
      }
    } else {
      const existingUser = await query(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        [email, username || null]
      );
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ success: false, message: 'Email already exists' });
      }
    }

    // Only super_admin can create admin accounts
    if (role === 'admin' || role === 'super_admin') {
      if (!req.user || String(req.user.role).toLowerCase().replace(/\s+/g, '_') !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super_admin can create admin accounts'
        });
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Set default privileges based on role
    let defaultPrivileges = {};
    if (role === 'admin') {
      defaultPrivileges = {
        manage_rooms: true,
        manage_bookings: true,
        manage_hr: true,
        view_reports: true
      };
    } else if (role === 'user' || role === 'client') {
      defaultPrivileges = {
        book_rooms: true,
        view_own_bookings: true
      };
    }

    // Override with provided privileges if any
    const userPrivileges = req.body.privileges ? { ...defaultPrivileges, ...req.body.privileges } : defaultPrivileges;

    // Create user (MongoDB if available else MySQL)
    let user = null;
    if (UserMongo) {
      const u = new UserMongo({
        username: username || null,
        email,
        password_hash: passwordHash,
        first_name: first_name || null,
        last_name: last_name || null,
        role,
        privileges: userPrivileges,
        is_active: true,
        created_by: req.user?.id || null
      });
      user = await u.save();
    } else {
      const result = await query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role, privileges, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [username || null, email, passwordHash, first_name || null, last_name || null, role, JSON.stringify(userPrivileges), true, req.user?.id || null]
      );

      // Get the inserted user
      const userResult = await query(
        'SELECT id, email, username, first_name, last_name, role, privileges, is_active FROM users WHERE id = ?',
        [result.insertId]
      );

      user = userResult.rows[0];
    }

    // Audit log
    await auditLog('user_created', req.user?.id || (user._id || user.id), (user._id || user.id), {
      new_user_role: role,
      privileges: userPrivileges
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user._id || user.id,
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          privileges: user.privileges,
          is_active: user.is_active
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user'
    });
  }
});

// Login user (MongoDB-backed)
router.post('/login', [
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('username').optional().notEmpty().withMessage('Username cannot be empty'),
  body('password').notEmpty().withMessage('Password is required')
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

    if (!UserMongo) {
      return res.status(500).json({ success: false, message: 'Authentication not configured (MongoDB unavailable)' });
    }

    const { email, username, password } = req.body;
    if (!email && !username) {
      return res.status(400).json({ success: false, message: 'Email or username is required' });
    }

    const identifier = email || username;

    // Find user by email OR username
    const user = await UserMongo.findOne({ $or: [{ email: identifier }, { username: identifier }] }).lean();

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is suspended or deactivated' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: String(user._id), role: user.role, privileges: user.privileges },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Audit log
    await auditLog('user_login', String(user._id), null, { email: user.email, role: user.role });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: String(user._id),
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          privileges: user.privileges,
          is_active: user.is_active
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Error during login' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    if (!UserMongo) return res.status(500).json({ success: false, message: 'Profile not available (MongoDB unavailable)' });
    const user = await UserMongo.findById(req.user.userId).select('email username first_name last_name role privileges is_active created_at').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('first_name').optional().notEmpty().withMessage('First name cannot be empty'),
  body('last_name').optional().notEmpty().withMessage('Last name cannot be empty')
], async (req, res) => {
  try {
    if (!UserMongo) return res.status(500).json({ success: false, message: 'Profile update not available (MongoDB unavailable)' });
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    const { first_name, last_name } = req.body;
    const updated = await UserMongo.findByIdAndUpdate(req.user.userId, { $set: { first_name: first_name || undefined, last_name: last_name || undefined } }, { new: true, select: 'email username first_name last_name role privileges is_active' }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'Profile updated successfully', data: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

// Change password
router.put('/change-password', authenticateToken, [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    if (!UserMongo) return res.status(500).json({ success: false, message: 'Password change not available (MongoDB unavailable)' });
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    const { current_password, new_password } = req.body;
    const user = await UserMongo.findById(req.user.userId).select('password_hash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!isValidPassword) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);
    user.password_hash = newPasswordHash;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'Error changing password' });
  }
});

module.exports = router; 