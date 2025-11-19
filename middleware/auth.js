const jwt = require('jsonwebtoken');
const { query } = require('../database/config');
let UserModel = null;
let mongoose = null;
try {
  UserModel = require('../models/User');
  mongoose = require('mongoose');
} catch (e) {
  UserModel = null;
}

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Prefer MongoDB user lookup when available and connected
    if (UserModel && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const userDoc = await UserModel.findById(decoded.userId).select('username email first_name last_name role privileges is_active').lean();
      if (!userDoc) return res.status(401).json({ message: 'Invalid token' });
      if (!userDoc.is_active) return res.status(401).json({ message: 'Account is deactivated' });
      const user = Object.assign({}, userDoc);
      // normalize id fields for backwards compatibility
      user.id = user._id ? String(user._id) : user.id;
      user.userId = String(user.id);
      req.user = user;
      return next();
    }

    // Fallback to MySQL lookup
    const result = await query(
      'SELECT id, username, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // keep backward-compatible shape
    user.id = user.id || user.ID || user.userId;
    user.userId = String(user.id);
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(500).json({ message: 'Authentication error' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

const isAdmin = authorizeRoles('admin');
const isManager = authorizeRoles('admin', 'manager');
const isStaff = authorizeRoles('admin', 'manager', 'staff');

module.exports = {
  authenticateToken,
  authorizeRoles,
  isAdmin,
  isManager,
  isStaff
};