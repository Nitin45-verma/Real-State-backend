const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// POST /api/leads - Create new lead
router.post('/', async (req, res) => {
  try {
    const { name, phone, propertyType, budget, preferredLocation, message } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required to save lead' });
    }

    const lead = await Lead.create({
      name: name || 'Website Lead',
      phone,
      propertyType: propertyType || 'General Inquiry',
      budget: budget || 'Not specified',
      preferredLocation: preferredLocation || 'Not specified',
      message: message || 'Lead captured via Aura Chatbot',
      source: 'Aura AI Chatbot'
    });

    console.log(`📌 New AI Chatbot Lead Captured: ${lead.phone} (${lead.name})`);

    return res.status(201).json({
      success: true,
      message: 'Lead captured successfully',
      lead
    });
  } catch (err) {
    console.error('❌ Lead Capture Error:', err);
    return res.status(500).json({ error: 'Failed to capture lead', details: err.message });
  }
});

// GET /api/leads - Admin get all captured leads
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    return res.json(leads);
  } catch (err) {
    console.error('❌ Fetch Leads Error:', err);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

module.exports = router;
