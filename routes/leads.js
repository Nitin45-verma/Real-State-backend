const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');

// POST /api/leads - Create new lead
router.post('/', async (req, res) => {
  try {
    const { name, phone, propertyType, budget, preferredLocation, message, requirement, location } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required to save lead' });
    }

    const lead = await Lead.create({
      name: name || 'Website Lead',
      phone,
      propertyType: propertyType || requirement || 'General Inquiry',
      budget: budget || 'Not specified',
      preferredLocation: preferredLocation || location || 'Not specified',
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

// GET /api/leads - Fetch all captured leads (sorted by newest first)
router.get('/', async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    return res.json({
      success: true,
      count: leads.length,
      leads
    });
  } catch (err) {
    console.error('❌ Fetch Leads Error:', err);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// PATCH /api/leads/:id - Update lead status (New, Contacted, Closed)
router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['New', 'Contacted', 'Closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    return res.json({ success: true, lead });
  } catch (err) {
    console.error('❌ Update Lead Error:', err);
    return res.status(500).json({ error: 'Failed to update lead status' });
  }
});

// DELETE /api/leads/:id - Delete lead
router.delete('/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    return res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    console.error('❌ Delete Lead Error:', err);
    return res.status(500).json({ error: 'Failed to delete lead' });
  }
});

module.exports = router;
