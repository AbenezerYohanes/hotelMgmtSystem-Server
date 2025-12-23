const { verifyToken } = require('./authHelpers');

module.exports = function guestAuth(req, res, next) {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: 'Unauthorized' });
    // allow guests and logged-in users
    req.user = payload;
    next();
};
