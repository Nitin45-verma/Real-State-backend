const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Success', 'Failed'], default: 'Pending' },
  razorpay_order_id: { type: String },
  razorpay_payment_id: { type: String },
  razorpay_signature: { type: String },
  clientSecret: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
