const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Property = require('../models/Property');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.post('/', authMiddleware, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'panoramaImage', maxCount: 1 }]), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.role === 'Seller' && !user.isVerified) {
      return res.status(403).json({ error: 'Your seller email has not been verified by an Administrator yet. Please contact an Admin to verify your seller email.' });
    }

    const propertyData = {
      ...req.body,
      user_id: req.user.id,
      isApproved: user.role === 'Admin'
    };
    
    if (req.files) {
      if (req.files.image) {
        propertyData.image = '/uploads/' + req.files.image[0].filename;
      }
      if (req.files.panoramaImage) {
        propertyData.panoramaImage = '/uploads/' + req.files.panoramaImage[0].filename;
      }
    }
    
    const newProperty = new Property(propertyData);
    const savedProperty = await newProperty.save();
    res.status(201).json(savedProperty);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const properties = await Property.find({ isApproved: true }).populate('user_id', 'name email role').sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate('user_id', 'name email role');
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    if (property.user_id.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Unauthorized to delete this property' });
    }
    await property.deleteOne();
    res.json({ message: 'Property removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
