const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded.user;

    const dbUser = await User.findById(req.user.id);
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const allowedAdminEmails = ['admin@nitinrealestate.com', 'nikn63641@gmail.com'];
    if (dbUser.role !== 'Admin' || !allowedAdminEmails.includes(dbUser.email)) {
      return res.status(403).json({ error: 'Access denied: Admin panel access restricted to authorized administrators.' });
    }

    req.dbUser = dbUser;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid or expired' });
  }
};
