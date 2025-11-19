const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/config');
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

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username || null]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
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

    // Create user
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

    const user = userResult.rows[0];

    // Audit log
    await auditLog('user_created', req.user?.id || user.id, user.id, {
      new_user_role: role,
      privileges: userPrivileges
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user.id,
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

// Login user
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

    const { email, username, password } = req.body;
    if (!email && !username) {
      return res.status(400).json({ success: false, message: 'Email or username is required' });
    }

    const identifier = email || username;

    // Find user by email OR username
    const result = await query(
      'SELECT id, email, password_hash, username, first_name, last_name, role, privileges, is_active FROM users WHERE email = ? OR username = ?',
      [identifier, identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is suspended or deactivated'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role, privileges: user.privileges },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Audit log
    await auditLog('user_login', user.id, null, {
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
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
    res.status(500).json({
      success: false,
      message: 'Error during login'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, username, first_name, last_name, role, privileges, is_active, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('first_name').optional().notEmpty().withMessage('First name cannot be empty'),
  body('last_name').optional().notEmpty().withMessage('Last name cannot be empty')
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

    const { first_name, last_name } = req.body;

    const result = await query(
      `UPDATE users SET
       first_name = COALESCE(?, first_name),
       last_name = COALESCE(?, last_name),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [first_name || null, last_name || null, req.user.id]
    );

    // Get updated user data
    const updatedUser = await query(
      'SELECT id, email, username, first_name, last_name, role, privileges, is_active FROM users WHERE id = ?',
      [req.user.id]
    );

    if (updatedUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser.rows[0]
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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

    const { current_password, new_password } = req.body;

    // Get current password hash
    const result = await query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await query(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
});

module.exports = router; 