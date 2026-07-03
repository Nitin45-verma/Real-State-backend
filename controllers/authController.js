const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT token explicitly mapped
const generateToken = (id) => {
  return jwt.sign({ user: { id } }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d',
  });
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role
    });

    if (user) {
      res.status(201).json({
        success: true,
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } else {
      res.status(400).json({ success: false, error: 'Invalid user data received' });
    }
  } catch (error) {
    console.error('Registration Error:', error.message);
    res.status(500).json({ success: false, error: 'Server error during registration. Please try again.' });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login Error:', error.message);
    res.status(500).json({ success: false, error: 'Server error during login. Please try again.' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(404).json({ success: false, error: 'User profile not found in database' });
    }
  } catch (error) {
    console.error('Fetch Profile Error:', error.message);
    res.status(500).json({ success: false, error: 'Server error while fetching profile' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile
};
