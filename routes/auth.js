const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile, googleLogin } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', registerUser);

// POST /api/auth/login
router.post('/login', loginUser);

// POST /api/auth/google
router.post('/google', googleLogin);

// GET /api/auth/me (Get logged in user info)
router.get('/me', authMiddleware, getUserProfile);

module.exports = router;
