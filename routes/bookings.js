const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const adminMiddleware = require('../middleware/adminMiddleware');

// POST /api/bookings — public; buyer submits a visit slot
router.post('/', async (req, res) => {
  try {
    const { buyerName, phone, propertyId, propertyTitle, date, slot } = req.body;

    if (!buyerName || !phone || !propertyId || !date || !slot) {
      return res.status(400).json({
        success: false,
        error: 'buyerName, phone, propertyId, date, and slot are required.'
      });
    }

    if (!['Morning', 'Evening'].includes(slot)) {
      return res.status(400).json({ success: false, error: 'slot must be Morning or Evening.' });
    }

    // Prevent double-booking the same slot
    const existing = await Booking.findOne({ propertyId, date, slot });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `This ${slot} slot on ${date} is already booked for this property. Please choose another slot or date.`
      });
    }

    const booking = await Booking.create({
      buyerName,
      phone,
      propertyId,
      propertyTitle: propertyTitle || '',
      date,
      slot,
      status: 'Pending Verification'
    });

    res.status(201).json({ success: true, booking });
  } catch (err) {
    console.error('Booking POST error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bookings — admin only
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('propertyId', 'title price location')
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/bookings/:id/status — admin only; update status
router.put('/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Pending Verification', 'Confirmed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/bookings/:id — admin only
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });
    await booking.deleteOne();
    res.json({ success: true, message: 'Booking deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
