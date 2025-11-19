const { query } = require('../database/config');

// Audit logging middleware
const auditLog = async (action, performedBy, targetId = null, meta = {}) => {
  try {
    await query(
      'INSERT INTO audit_logs (action, performed_by, target_id, meta) VALUES (?, ?, ?, ?)',
      [action, performedBy, targetId, JSON.stringify(meta)]
    );
  } catch (error) {
    console.error('Audit logging error:', error);
    // Don't fail the request if audit logging fails
  }
};

// Middleware to audit actions
const auditMiddleware = (action) => {
  return (req, res, next) => {
    // Store original response methods
    const originalJson = res.json;
    const originalSend = res.send;
    const originalStatus = res.status;

    // Override response methods to capture the response
    res.json = function(data) {
      if (req.user && res.statusCode >= 200 && res.statusCode < 300) {
        // Log successful actions
        auditLog(action, req.user.id, req.params.id || req.body.id, {
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          body: req.body,
          response: data
        });
      }
      return originalJson.call(this, data);
    };

    res.send = function(data) {
      if (req.user && res.statusCode >= 200 && res.statusCode < 300) {
        // Log successful actions
        auditLog(action, req.user.id, req.params.id || req.body.id, {
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          body: req.body,
          response: data
        });
      }
      return originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  auditLog,
  auditMiddleware
};
