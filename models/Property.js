const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  location: { type: String, required: true },
  type: { type: String, enum: ['Apartment', 'Villa', 'Plot', 'Plots'], required: true },
  contactInfo: { type: String, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isApproved: { type: Boolean, default: false },
  image: { type: String, required: false }
}, { timestamps: true });

module.exports = mongoose.model('Property', propertySchema);
