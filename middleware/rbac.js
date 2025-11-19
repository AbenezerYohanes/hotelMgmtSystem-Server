const { query } = require('../database/config');
let UserModel = null;
let mongoose = null;
try {
  UserModel = require('../models/User');
  mongoose = require('mongoose');
} catch (e) {
  UserModel = null;
}

// Role hierarchy: super_admin > admin > manager > staff > client
const ROLE_HIERARCHY = {
  'super_admin': 5,
  'admin': 4,
  'manager': 3,
  'staff': 2,
  'client': 1
};

// Check if user has required role or higher
const hasRole = (userRole, requiredRole) => {
  if (!userRole || !requiredRole) return false;
  const normalize = (r) => String(r).toLowerCase();
  const u = normalize(userRole).replace(/\s+/g, '_');
  const req = normalize(requiredRole).replace(/\s+/g, '_');
  const uRank = ROLE_HIERARCHY[u];
  const reqRank = ROLE_HIERARCHY[req];
  if (uRank === undefined || reqRank === undefined) return false;
  return uRank >= reqRank;
};

// Check if user has specific privilege
const hasPrivilege = (userPrivileges, privilege) => {
  if (!userPrivileges) return false;
  try {
    const privileges = typeof userPrivileges === 'string' ? JSON.parse(userPrivileges) : userPrivileges;
    return privileges[privilege] === true;
  } catch (error) {
    console.error('Error parsing privileges:', error);
    return false;
  }
};

// Middleware to check role (requiredRole can be a single role string)
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!hasRole(req.user.role, requiredRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Middleware to check privilege
const requirePrivilege = (privilege) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Superadmin has all privileges (normalize role)
    if (hasRole(req.user.role, 'super_admin')) {
      return next();
    }

    // Check if user has the specific privilege
    if (!hasPrivilege(req.user.privileges, privilege)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions for this action'
      });
    }

    next();
  };
};

// Middleware to check if user can manage another user
const canManageUser = (targetUserId) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super_admin can manage everyone
    if (String(req.user.role).toLowerCase().replace(/\s+/g, '_') === 'super_admin') {
      return next();
    }

    // Admin can manage users with lower roles
    if (String(req.user.role).toLowerCase().replace(/\s+/g, '_') === 'admin') {
      try {
        // If Mongo user model available and connected, use it
        if (UserModel && mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
          const target = await UserModel.findById(targetUserId).select('role').lean();
          if (!target) {
            return res.status(404).json({ success: false, message: 'User not found' });
          }
          const targetRole = target.role;
          if (hasRole(req.user.role, targetRole) && req.user.role !== targetRole) {
            return next();
          }
        } else {
          const result = await query('SELECT role FROM users WHERE id = ?', [targetUserId]);
          if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
          }
          const targetRole = result.rows[0].role;
          if (hasRole(req.user.role, targetRole) && req.user.role !== targetRole) {
            return next();
          }
        }
      } catch (error) {
        console.error('Error checking user management permissions:', error);
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Cannot manage this user'
    });
  };
};

module.exports = {
  hasRole,
  hasPrivilege,
  requireRole,
  requirePrivilege,
  canManageUser,
  ROLE_HIERARCHY
};
