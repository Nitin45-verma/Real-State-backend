const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendSellerRegistrationEmailToAdmin } = require('../utils/emailService');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

    const assignedRole = ['Buyer', 'Seller'].includes(role) ? role : 'Buyer';

    const user = await User.create({
      name,
      email,
      password,
      role: assignedRole,
      isVerified: assignedRole === 'Seller' ? false : false
    });

    if (user) {
      // If user registered as a Seller, trigger email notification to Admin for verification
      if (user.role === 'Seller') {
        sendSellerRegistrationEmailToAdmin({
          sellerName: user.name,
          sellerEmail: user.email,
          sellerId: user._id
        }).catch(err => console.error('Background Email Dispatch Error:', err.message));
      }

      res.status(201).json({
        success: true,
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.role === 'Admin' ? true : !!user.isVerified
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
          role: user.role,
          isVerified: user.role === 'Admin' ? true : !!user.isVerified
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

const googleLogin = async (req, res) => {
  try {
    const { token, role } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Google credential token is required' });
    }

    // Mock login for development mode/placeholder client IDs
    if (token === 'mock_google_token') {
      const email = req.body.email || 'dev.googleuser@example.com';
      const name = req.body.name || 'Dev Google User';

      let user = await User.findOne({ email });

      if (user) {
        return res.json({
          success: true,
          token: generateToken(user._id),
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isVerified: user.role === 'Admin' ? true : !!user.isVerified
          }
        });
      } else {
        const assignedRole = ['Buyer', 'Seller'].includes(role) ? role : 'Buyer';
        const crypto = require('crypto');
        const randomPassword = crypto.randomBytes(16).toString('hex');

        user = await User.create({
          name,
          email,
          password: randomPassword,
          role: assignedRole,
          isVerified: assignedRole === 'Seller' ? false : false
        });

        if (user) {
          if (user.role === 'Seller') {
            sendSellerRegistrationEmailToAdmin({
              sellerName: user.name,
              sellerEmail: user.email,
              sellerId: user._id
            }).catch(err => console.error('Background Email Dispatch Error:', err.message));
          }

          return res.status(201).json({
            success: true,
            token: generateToken(user._id),
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
              isVerified: user.role === 'Admin' ? true : !!user.isVerified
            }
          });
        } else {
          return res.status(400).json({ success: false, error: 'Failed to create mock Google user' });
        }
      }
    }

    // Verify token with Google
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifError) {
      console.error('Google token verification failed:', verifError.message);
      return res.status(400).json({ success: false, error: 'Invalid Google credential token' });
    }

    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    // Search for existing user
    let user = await User.findOne({ email });

    if (user) {
      // User exists, log them in
      res.json({
        success: true,
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.role === 'Admin' ? true : !!user.isVerified
        }
      });
    } else {
      // User doesn't exist, register them
      const assignedRole = ['Buyer', 'Seller'].includes(role) ? role : 'Buyer';
      
      // Generate a secure random password since schema requires password
      const crypto = require('crypto');
      const randomPassword = crypto.randomBytes(16).toString('hex');

      user = await User.create({
        name,
        email,
        password: randomPassword,
        role: assignedRole,
        isVerified: assignedRole === 'Seller' ? false : false
      });

      if (user) {
        if (user.role === 'Seller') {
          sendSellerRegistrationEmailToAdmin({
            sellerName: user.name,
            sellerEmail: user.email,
            sellerId: user._id
          }).catch(err => console.error('Background Email Dispatch Error:', err.message));
        }

        res.status(201).json({
          success: true,
          token: generateToken(user._id),
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isVerified: user.role === 'Admin' ? true : !!user.isVerified
          }
        });
      } else {
        res.status(400).json({ success: false, error: 'Failed to create user from Google profile' });
      }
    }
  } catch (error) {
    console.error('Google Auth Controller Error:', error.message);
    res.status(500).json({ success: false, error: 'Server error during Google Authentication. Please try again.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  googleLogin
};

