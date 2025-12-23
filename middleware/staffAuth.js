const { verifyToken } = require('./authHelpers');

module.exports = function staffAuth(req, res, next) {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: 'Unauthorized' });
    if (payload.role !== 'staff' && payload.role !== 'admin' && payload.role !== 'superadmin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = payload;
    next();
};
