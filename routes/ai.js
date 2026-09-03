const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const aiController = require('../controllers/aiController');

// Multer setup for temporary image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // reusing existing uploads directory
  },
  filename: function (req, file, cb) {
    cb(null, 'temp-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// AI Endpoints
router.post('/search-parser', aiController.parseSearch);
router.post('/estimate-price', aiController.estimatePrice);
router.post('/analyze-image', upload.single('image'), aiController.analyzeImage);

module.exports = router;
