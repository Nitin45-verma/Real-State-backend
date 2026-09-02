const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    buyerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true
    },
    propertyTitle: { type: String, default: '' },
    date: { type: String, required: true }, // ISO date string "YYYY-MM-DD"
    slot: { type: String, enum: ['Morning', 'Evening'], required: true },
    status: {
      type: String,
      enum: ['Pending Verification', 'Confirmed', 'Cancelled'],
      default: 'Pending Verification'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
