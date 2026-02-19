const mongoose = require("mongoose");

const providerSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },

  name: { type: String, required: true },
  speciality: { type: String, required: true },
  bio: { type: String },
  avatar: {
    data: Buffer,
    contentType: String,
  },
  hourlyPrice: { type: Number, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },

  weeklyAvailability: [
  {
    day: String,
    slots: [
      {
        time: String,
        isBooked: { type: Boolean, default: false }
      }
    ]
  }
],

dateOverrides: [
  {
    date: String, // 2026-02-06
    slots: [
      {
        time: String,
        isAvailable: { type: Boolean, default: true }
      }
    ]
  }
],
unavailableDates: [
  {
    type: String, 
  }
],
  // preferences
  preferences: {
      theme: {
        type: String,
        enum: ["light", "dark"],
        default: "light",
      },
    },

   /* ============ AUTH FIELDS ============ */
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String
    },

    isApproved: {
      type: Boolean,
      default: false
    },
    forgotPassword: {
      status: {
        type: String,
        enum: ["NONE", "PENDING", "APPROVED"],
        default: "NONE",
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
    role: { type: String , default: "provider" },
});

module.exports = mongoose.model("Provider", providerSchema);
