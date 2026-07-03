const express = require('express');
const router = express.Router();
const Inquiry = require('../models/Inquiry');
const Property = require('../models/Property');

router.post('/', async (req, res) => {
  try {
    const { buyer_id, property_id, name, phone, message } = req.body;
    const property = await Property.findById(property_id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const newInquiry = new Inquiry({
      buyer_id,
      seller_id: property.user_id,
      property_id,
      name,
      phone,
      message
    });
    
    const savedInquiry = await newInquiry.save();
    res.status(201).json(savedInquiry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
