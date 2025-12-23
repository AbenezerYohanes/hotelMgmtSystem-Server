const jwt = require('jsonwebtoken');
const path = require('path');

const { initDb } = require('../config/database');

const login = async (req, res) => {
  try {
    const sequelize = await initDb();
    const models = require('../models');
    const { email, password } = req.body;
    const user = await models.Employee.findOne({
      where: { email },
      include: [{ model: models.Role, as: 'role' }]
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await user.validatePassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role.name }, process.env.JWT_SECRET || 'secret', { expiresIn: '12h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role.name, name: `${user.first_name} ${user.last_name}` } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const register = async (req, res) => {
  try {
    const sequelize = await initDb();
    const models = require('../models')(sequelize);
    const { email, password, name, role } = req.body;
    const exists = await models.User.findOne({ where: { email } });
    if (exists) return res.status(400).json({ error: 'User exists' });
    const user = await models.User.create({ email, password, name, role: role || 'guest' });
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { login, register };
