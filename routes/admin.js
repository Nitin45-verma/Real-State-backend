const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const Property = require('../models/Property');
const Inquiry = require('../models/Inquiry');
const Contact = require('../models/Contact');
const Transaction = require('../models/Transaction');
const Booking = require('../models/Booking');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { sendSellerVerifiedEmailToUser } = require('../utils/emailService');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Endpoint for current user to promote themselves to Admin (useful for testing/initial admin setup)
router.post('/make-me-admin', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const allowedAdminEmails = ['nikn63641@gmail.com', 'admin@nitinrealestate.com', process.env.ADMIN_EMAIL].filter(Boolean).map(e => e.toLowerCase());
    if (!allowedAdminEmails.includes(user.email.toLowerCase())) {
      return res.status(403).json({ error: 'Admin access is restricted to authorized emails' });
    }
    user.role = 'Admin';
    user.isVerified = true;
    await user.save();
    res.json({ success: true, message: 'User role updated to Admin successfully', user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Stats
router.get('/stats', adminMiddleware, async (req, res) => {
  try {
    const [
      totalProperties,
      totalUsers,
      buyersCount,
      sellersCount,
      adminsCount,
      totalInquiries,
      totalContacts,
      totalTransactions,
      totalBookings,
      transactionsList,
      recentProperties,
      recentUsers
    ] = await Promise.all([
      Property.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ role: 'Buyer' }),
      User.countDocuments({ role: 'Seller' }),
      User.countDocuments({ role: 'Admin' }),
      Inquiry.countDocuments(),
      Contact.countDocuments(),
      Transaction.countDocuments(),
      Booking.countDocuments(),
      Transaction.find(),
      Property.find().sort({ createdAt: -1 }).limit(5).populate('user_id', 'name email'),
      User.find().select('-password').sort({ createdAt: -1 }).limit(5)
    ]);

    const totalRevenue = transactionsList
      .filter(t => t.status === 'Success')
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    res.json({
      success: true,
      stats: {
        totalProperties,
        totalUsers,
        buyersCount,
        sellersCount,
        adminsCount,
        totalInquiries,
        totalContacts,
        totalTransactions,
        totalBookings,
        totalRevenue,
        recentProperties,
        recentUsers
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Properties Management
router.get('/properties', adminMiddleware, async (req, res) => {
  try {
    const properties = await Property.find()
      .populate('user_id', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, properties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/properties', adminMiddleware, upload.single('image'), async (req, res) => {
  try {
    let targetUserId = req.user.id;
    const { sellerEmail } = req.body;

    if (sellerEmail) {
      let seller = await User.findOne({ email: sellerEmail.trim().toLowerCase() });
      if (seller) {
        seller.isVerified = true;
        await seller.save();
        targetUserId = seller._id;
      }
    }

    const propertyData = {
      ...req.body,
      user_id: targetUserId,
      isApproved: true
    };
    if (req.file) {
      propertyData.image = '/uploads/' + req.file.filename;
    }
    const newProperty = new Property(propertyData);
    const savedProperty = await newProperty.save();
    res.status(201).json({ success: true, property: savedProperty, message: 'Property listed successfully by admin' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/properties/:id', adminMiddleware, upload.single('image'), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const updates = { ...req.body };
    if (req.file) {
      updates.image = '/uploads/' + req.file.filename;
    }

    Object.assign(property, updates);
    const updatedProperty = await property.save();
    res.json({ success: true, property: updatedProperty, message: 'Property details updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/properties/:id', adminMiddleware, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    await property.deleteOne();
    res.json({ success: true, message: 'Property deleted successfully by admin' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/properties/:id/verify', adminMiddleware, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    
    const newlyVerified = req.body.isApproved !== undefined ? req.body.isApproved : !property.isApproved;
    property.isApproved = newlyVerified;
    await property.save();
    
    res.json({ 
      success: true, 
      message: `Property is now ${property.isApproved ? 'approved' : 'pending'}.`,
      property 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Users Management
router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/role', adminMiddleware, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['Seller', 'Buyer', 'Admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const allowedAdminEmails = ['nikn63641@gmail.com', 'admin@nitinrealestate.com', process.env.ADMIN_EMAIL].filter(Boolean).map(e => e.toLowerCase());
    if (role === 'Admin' && !allowedAdminEmails.includes(user.email.toLowerCase())) {
      return res.status(403).json({ error: 'Admin role is strictly reserved for authorized admin emails' });
    }
    user.role = role;
    await user.save();
    res.json({ success: true, message: `Role updated to ${role} successfully`, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/verify', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const newlyVerified = req.body.isVerified !== undefined ? req.body.isVerified : !user.isVerified;
    user.isVerified = newlyVerified;
    await user.save();

    // If seller is verified, send email notification to seller
    if (newlyVerified && user.role === 'Seller') {
      sendSellerVerifiedEmailToUser({
        sellerName: user.name,
        sellerEmail: user.email
      }).catch(err => console.error('Background Seller Email Error:', err.message));
    }

    res.json({
      success: true,
      message: `Seller email (${user.email}) ${user.isVerified ? 'verified' : 'unverified'} successfully`,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }
    await user.deleteOne();
    // Clean up associated properties & inquiries
    await Property.deleteMany({ user_id: req.params.id });
    await Inquiry.deleteMany({ $or: [{ buyer_id: req.params.id }, { seller_id: req.params.id }] });
    res.json({ success: true, message: 'User and related records removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inquiries Management
router.get('/inquiries', adminMiddleware, async (req, res) => {
  try {
    const inquiries = await Inquiry.find()
      .populate('buyer_id', 'name email')
      .populate('seller_id', 'name email')
      .populate('property_id', 'title price location')
      .sort({ createdAt: -1 });
    res.json({ success: true, inquiries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/inquiries/:id', adminMiddleware, async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    await inquiry.deleteOne();
    res.json({ success: true, message: 'Inquiry deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contacts Management
router.get('/contacts', adminMiddleware, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, contacts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/contacts/:id', adminMiddleware, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact message not found' });
    await contact.deleteOne();
    res.json({ success: true, message: 'Contact message deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transactions Management
router.get('/transactions', adminMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('user_id', 'name email role')
      .populate('property_id', 'title price location')
      .sort({ createdAt: -1 });
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bookings Management
router.get('/bookings', adminMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('propertyId', 'title price location')
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/bookings/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Pending Verification', 'Confirmed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/bookings/:id', adminMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    await booking.deleteOne();
    res.json({ success: true, message: 'Booking deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
