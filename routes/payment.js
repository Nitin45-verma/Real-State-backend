const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create-intent', authMiddleware, async (req, res) => {
  try {
    const { property_id, amount } = req.body;
    
    const clientSecret = crypto.randomBytes(16).toString('hex');
    
    const tx = new Transaction({
      user_id: req.user.id,
      property_id,
      amount,
      clientSecret,
      status: 'Pending'
    });
    await tx.save();
    
    res.json({ clientSecret, transactionId: tx._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { transactionId, status } = req.body;
    const tx = await Transaction.findById(transactionId);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    
    tx.status = status === 'Success' ? 'Success' : 'Failed';
    await tx.save();

    res.json({ message: 'Transaction updated successfully', transaction: tx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
