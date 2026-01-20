const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  avatar: {data: Buffer, contentType: String},
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },

  // ============ FORGOT PASSWORD FLOW ============
  forgotPassword: {
    status: {
      type: String,
      enum: ['NONE', 'PENDING', 'APPROVED'],
      default: 'NONE',
    },
    requestedAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
