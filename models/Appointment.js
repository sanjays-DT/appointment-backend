const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },

  start: { type: Date, required: true },
  end: { type: Date, required: true },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "cancelled","missed"],
    default: "pending"
  },

  reason: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Appointment", AppointmentSchema);
