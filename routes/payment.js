const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/authMiddleware');
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_TR8Mdnq5rde0vO';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'Je6rMqjfMLzINdnEAIIt8QR2';
  return new Razorpay({ key_id, key_secret });
};
// GET Razorpay Public Key ID
router.get('/key', (req, res) => {
  res.json({ key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TR8Mdnq5rde0vO' });
});

// Create Razorpay Order
const handleCreateOrder = async (req, res) => {
  try {
    const { property_id, amount = 50000 } = req.body;
    if (!property_id) {
      return res.status(400).json({ error: 'property_id is required' });
    }

    const instance = getRazorpayInstance();
    const amountInPaise = Math.round(Number(amount) * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `token_rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    };

    const order = await instance.orders.create(options);

    const tx = new Transaction({
      user_id: req.user.id,
      property_id,
      amount: Number(amount),
      razorpay_order_id: order.id,
      status: 'Pending'
    });
    await tx.save();

    res.json({
      success: true,
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TR8Mdnq5rde0vO',
      order,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      transactionId: tx._id,
      clientSecret: order.id
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({ error: err.message || 'Failed to create Razorpay order' });
  }
};

router.post('/create-order', authMiddleware, handleCreateOrder);
router.post('/create-intent', authMiddleware, handleCreateOrder);

// Verify Razorpay Payment Signature
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionId, status } = req.body;
    
    let tx;
    if (transactionId) {
      tx = await Transaction.findById(transactionId);
    } else if (razorpay_order_id) {
      tx = await Transaction.findOne({ razorpay_order_id });
    }

    if (!tx) {
      return res.status(404).json({ error: 'Transaction record not found' });
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'Je6rMqjfMLzINdnEAIIt8QR2';

    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const generated_signature = crypto
        .createHmac('sha256', key_secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generated_signature === razorpay_signature) {
        tx.status = 'Success';
        tx.razorpay_payment_id = razorpay_payment_id;
        tx.razorpay_signature = razorpay_signature;
        if (razorpay_order_id) tx.razorpay_order_id = razorpay_order_id;
        await tx.save()
        return res.json({ success: true, message: 'Payment verified successfully', transaction: tx });
      } else {
        tx.status = 'Failed'; 
        await tx.save();
        return res.status(400).json({ success: false, error: 'Invalid payment signature' });
      }
    } else if (status) {
      // Fallback status update
      tx.status = status === 'Success' ? 'Success' : 'Failed';
      await tx.save();
      return res.json({ success: true, message: 'Transaction status updated', transaction: tx });
    } else {
      return res.status(400).json({ error: 'Missing payment details for verification' });
    }
  } catch (err) {
    console.error('Error verifying Razorpay payment:', err);
    res.status(500).json({ error: err.message || 'Payment verification failed' });
  }
});

module.exports = router;
