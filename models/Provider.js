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
    startTime: String,
    endTime: String,
    slots: [
      {
        time: String,
        isBooked: { type: Boolean, default: false },
        _id: false
      }
    ],
    _id: false
  }
]
,
    unavailableDates: {
        type: [String],
        default: [],
        _id: false
    }
});

module.exports = mongoose.model("Provider", providerSchema);
