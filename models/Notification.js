const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider" },
  message: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: true });

NotificationSchema.path("userId").validate(function () {
  return Boolean(this.userId || this.providerId);
}, "Notification must belong to a user or provider");

module.exports = mongoose.model("Notification", NotificationSchema);
