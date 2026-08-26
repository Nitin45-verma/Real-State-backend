const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: { type: String, default: 'Website Lead' },
  phone: { type: String, required: true },
  propertyType: { type: String, default: 'General Inquiry' },
  budget: { type: String, default: 'Not specified' },
  preferredLocation: { type: String, default: 'Not specified' },
  message: { type: String, default: '' },
  status: { type: String, default: 'New', enum: ['New', 'Contacted', 'Closed'] },
  source: { type: String, default: 'Aura AI Chatbot' }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
