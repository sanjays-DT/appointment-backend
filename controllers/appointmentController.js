const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const Provider = require("../models/Provider");
const User = require("../models/User");
const mongoose = require("mongoose");

/* 
   HELPER: Validate Time Range
 */
function validateTime(start, end) {
  const s = new Date(start);
  const e = new Date(end);

  if (isNaN(s) || isNaN(e)) {
    const error = new Error("Invalid date format.");
    error.status = 400;
    throw error;
  }

  if (e <= s) {
    const error = new Error("End time must be greater than start time.");
    error.status = 400;
    throw error;
  }

  return { startDate: s, endDate: e };
}

async function getAdminUserIds() {
  const admins = await User.find({ role: "admin" }).select("_id");
  return admins.map(a => a._id);
}

/* 
   HELPER: Check Time Conflict
 */
async function hasConflict(providerId, start, end, excludeId = null) {
  const query = {
    providerId: new mongoose.Types.ObjectId(providerId),
    status: { $in: ["pending", "approved"] },
    $expr: {
      $and: [
        { $lt: ["$start", end] },
        { $gt: ["$end", start] }
      ]
    }
  };

  if (excludeId) query._id = { $ne: excludeId };

  return await Appointment.findOne(query);
}



// CREATE APPOINTMENT (Only logged-in user)

exports.createAppointment = async (req, res) => {
  try {
    const { providerId, start, end } = req.body;
    const userId = req.user._id;

    if (!providerId || !start || !end) {
      return res.status(400).json({
        success: false,
        message: "providerId, start and end are required."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid providerId format."
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found."
      });
    }

    const { startDate, endDate } = validateTime(start, end);

    const conflict = await hasConflict(providerId, startDate, endDate);
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "Time slot already booked."
      });
    }

    const appointment = await Appointment.create({
      providerId,
      userId,
      start: startDate,
      end: endDate,
      status: "pending"
    });

    const populated = await Appointment.findById(appointment._id)
      .populate("userId", "name email phone")
      .populate("providerId", "name speciality hourlyPrice location");

    // USER notification
    await Notification.create({
      userId,
      message: `Your appointment has been created with ${populated.providerId.name} and is pending approval.`
    });

    // PROVIDER notification 
    const adminIds = await getAdminUserIds();
    for (const adminId of adminIds) {
      await Notification.create({
        userId: adminId,
        message: `${populated.userId.name} booked an appointment with ${populated.providerId.name}.`
      });
    }

    return res.status(201).json({
      success: true,
      message: "Appointment created successfully.",
      data: populated
    });

  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};


exports.getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("userId", "name email")
      .populate({
        path: "providerId",
        populate: {
          path: "categoryId",
          select: "name",
        },
      })
      .sort({ start: -1 });

    res.json({
      success: true,
      appointments,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
};

// Get appointments for logged-in user
exports.getUserAppointments = async (req, res) => {
  try {
    const userId = req.user._id;

    const appointments = await Appointment.find({ userId })
      .populate("providerId", "name speciality hourlyPrice location")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      appointments
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user appointments",
      error: error.message
    });
  }
};


// APPROVE APPOINTMENT (Admin Only)

exports.approveAppointment = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can approve appointments."
      });
    }

    const { id } = req.params;

    const appt = await Appointment.findByIdAndUpdate(
      id,
      { status: "approved" },
      { new: true }
    ).populate("userId", "name email")
      .populate("providerId", "name speciality");

    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found."
      });
    }

    await Notification.create({
      userId: appt.userId,
      message: `Your appointment with ${appt.providerId.name} has been approved.`
    });

    return res.json({
      success: true,
      message: "Appointment approved.",
      data: appt
    });

  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};



// REJECT APPOINTMENT (Admin Only)

exports.rejectAppointment = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can reject appointments."
      });
    }

    const { id } = req.params;

    const appt = await Appointment.findByIdAndUpdate(
      id,
      { status: "rejected" },
      { new: true }
    ).populate("userId", "name email")
      .populate("providerId", "name speciality");

    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found."
      });
    }

    await Notification.create({
      userId: appt.userId,
      message: `Your appointment with ${appt.providerId.name} has been rejected.`
    });

    return res.json({
      success: true,
      message: "Appointment rejected.",
      data: appt
    });

  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};



// CANCEL APPOINTMENT

exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const appt = await Appointment.findById(id)
      .populate("userId", "name email")
      .populate("providerId", "name speciality userId");

    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found."
      });
    }

    // User cannot cancel someone else's appointment
    if (req.user.role !== "admin" && appt.userId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You cannot cancel someone else's appointment."
      });
    }

    appt.status = "cancelled";
    await appt.save();

    // USER notification
    await Notification.create({
      userId: appt.userId,
      message: `Your appointment with ${appt.providerId.name} has been cancelled.`
    });

    // PROVIDER notification  → only when USER cancels
    const adminIds = await getAdminUserIds();
    for (const adminId of adminIds) {
      await Notification.create({
        userId: adminId,
        message: `${appt.userId.name} cancelled their appointment with ${appt.providerId.name}.`
      });
    }


    return res.json({
      success: true,
      message: "Appointment cancelled.",
      data: appt
    });

  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};



// RESCHEDULE APPOINTMENT

exports.rescheduleAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { start, end } = req.body;

    if (!start || !end) {
      return res.status(400).json({ message: "Start and End time are required." });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (endDate <= startDate) {
      return res.status(400).json({ message: "End time must be greater than start time." });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate("providerId", "name speciality userId")
      .populate("userId", "name");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    // USER restriction 
    if (req.user.role !== "admin") {

      if (appointment.userId._id.toString() !== req.user.id) {
        return res.status(403).json({ message: "You cannot reschedule this appointment." });
      }

      if (appointment.status === "cancelled") {
        return res.status(400).json({ message: "Cancelled appointments cannot be rescheduled." });
      }

      if (appointment.status === "rejected") {
        return res.status(400).json({ message: "Rejected appointments cannot be rescheduled." });
      }
    }

    const conflict = await hasConflict(
      appointment.providerId._id,
      startDate,
      endDate,
      appointment._id
    );

    if (conflict) {
      return res.status(409).json({
        message: "The selected time slot is not available.",
      });
    }

    appointment.start = startDate;
    appointment.end = endDate;

    if (req.user.role === "admin") {
      appointment.status = "approved";
    } else {
      appointment.status = "pending";
    }

    await appointment.save();

    const notifyMessage =
      req.user.role === "admin"
        ? "Your appointment has been rescheduled by admin and approved."
        : "Your appointment has been rescheduled and is pending approval.";

    // USER notification
    await Notification.create({
      userId: appointment.userId,
      message: notifyMessage,
    });

    // PROVIDER notification  → only when USER reschedules
    const adminIds = await getAdminUserIds();
    for (const adminId of adminIds) {
      await Notification.create({
        userId: adminId,
        message: `${appointment.userId.name} rescheduled their appointment with ${appointment.providerId.name}.`
      });
    }

    return res.status(200).json({
      message: "Appointment rescheduled successfully.",
      appointment,
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
