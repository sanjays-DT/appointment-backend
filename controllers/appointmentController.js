const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const Provider = require("../models/Provider");
const User = require("../models/User");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const { formatForUser, formatForProvider } = require("../utils/notificationHelper");

/* =========================================================
   HELPER: Validate Time
========================================================= */
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

function getRole(req) {
  if (req.user) return req.user.role;
  if (req.provider) return "provider";
  return req.auth?.role;
}

function getAuthId(req) {
  if (req.user) return req.user._id?.toString();
  if (req.provider) return req.provider._id?.toString();
  return req.auth?.id;
}

/* =========================================================
   CREATE APPOINTMENT (USER ONLY) - FIXED
========================================================= */
exports.createAppointment = async (req, res) => {
  try {
    const role = getRole(req);
    if (role !== "user") {
      return res.status(403).json({ message: "Only users can book appointments" });
    }

    const { providerId, start, end, timezone } = req.body; // Add timezone
    const userId = getAuthId(req);

    if (!providerId || !start || !end) {
      return res.status(400).json({ message: "providerId, start and end required" });
    }

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({ message: "Invalid providerId" });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    const { startDate, endDate } = validateTime(start, end);

    const conflict = await Appointment.findOne({
      providerId,
      status: { $in: ["pending", "approved"] },
      start: { $lt: endDate },
      end: { $gt: startDate }
    });

    if (conflict) {
      return res.status(409).json({ message: "Time slot already booked" });
    }

    const appointment = await Appointment.create({
      providerId,
      userId,
      start: startDate,
      end: endDate,
      status: "pending"
    });

    // FIX: Get user's timezone
    const userTimezone = timezone || req.headers['x-timezone'] || 'Asia/Kolkata';

    // FIX: Format time for user notification
    const userLocalTime = await formatForUser(startDate, userId, userTimezone);

    await Notification.create({
      userId,
      message: `Your appointment with ${provider.name} is pending approval for ${userLocalTime}.`,
      read: false
    });

    //FIX: Format time for provider notification
    const providerTimezone = provider.timezone || userTimezone;
    const providerLocalTime = await formatForProvider(startDate, providerId, providerTimezone);

    await Notification.create({
      providerId: providerId,
      message: `New appointment request from ${req.user?.name || "a user"} for ${providerLocalTime} is pending approval.`,
      read: false
    });

    // Admin notifications (use UTC for admins)
    const adminIds = await getAdminUserIds();
    await Promise.all(
      adminIds.map(adminId =>
        Notification.create({
          userId: adminId,
          message: `New appointment requires approval for ${new Date(startDate).toLocaleString()}.`,
          read: false
        })
      )
    );

    res.status(201).json({
      message: "Appointment created",
      appointment: {
        ...appointment.toObject(),
        userLocalTime,
        providerLocalTime
      }
    });

  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

/* =========================================================
   GET APPOINTMENTS (ADMIN (ALL) | PROVIDER (OWN))
========================================================= */
exports.getAllAppointments = async (req, res) => {
  try {
    const role = getRole(req);
    const authId = getAuthId(req);

    let filter = {};

    if (role === "provider") {
      filter.providerId = authId;
    }

    const appointments = await Appointment.find(filter)
      .populate("userId", "name email")
      .populate("providerId", "name speciality")
      .sort({ start: -1 });

    res.json({ appointments });

  } catch (err) {
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
};

/* =========================================================
   GET USER APPOINTMENTS (USER ONLY)
========================================================= */
exports.getUserAppointments = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(403).json({ message: "User only access" });
    }

    const appointments = await Appointment.find({ userId: req.user._id })
      .populate("providerId", "name speciality")
      .sort({ start: -1 });

    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
};

/* =========================================================
   GET PROVIDER APPOINTMENTS (PROVIDER OWN | ADMIN)
========================================================= */
exports.getProviderAppointments = async (req, res) => {
  try {
    let providerId;

    if (req.provider) {
      providerId = req.provider._id;
    } else if (req.user?.role === "admin") {
      providerId = req.params.id;
    } else {
      return res.status(403).json({ message: "Provider or admin only access" });
    }

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({ message: "Invalid provider id" });
    }

    const appointments = await Appointment.find({ providerId })
      .populate("userId", "name email")
      .sort({ start: -1 });

    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
};

/* =========================================================
   APPROVE APPOINTMENT (ADMIN + PROVIDER OWN) - FIXED
========================================================= */
exports.approveAppointment = async (req, res) => {
  try {
    const role = getRole(req);
    const authId = getAuthId(req);

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    const provider = await Provider.findById(appt.providerId);

    if (role === "provider" && appt.providerId.toString() !== authId) {
      return res.status(403).json({ message: "Not your appointment" });
    }

    appt.status = "approved";
    await appt.save();

    // FIX: Format time for user notification
    const userLocalTime = await formatForUser(appt.start, appt.userId);

    await Notification.create({
      userId: appt.userId,
      message: `Your appointment with ${provider.name} for ${userLocalTime} has been approved.`,
      read: false
    });

    res.json({
      message: "Appointment approved",
      appt: {
        ...appt.toObject(),
        approvedTime: userLocalTime
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   REJECT APPOINTMENT (ADMIN + PROVIDER OWN) - FIXED
========================================================= */
exports.rejectAppointment = async (req, res) => {
  try {
    const role = getRole(req);
    const authId = getAuthId(req);

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    const provider = await Provider.findById(appt.providerId);

    if (role === "provider" && appt.providerId.toString() !== authId) {
      return res.status(403).json({ message: "Not your appointment" });
    }

    appt.status = "rejected";
    await appt.save();

    // FIX: Format time for user notification
    const userLocalTime = await formatForUser(appt.start, appt.userId);

    await Notification.create({
      userId: appt.userId,
      message: `Your appointment with ${provider.name} has been rejected.`,
      read: false
    });

    res.json({
      message: "Appointment rejected",
      appt: {
        ...appt.toObject(),
        rejectedTime: userLocalTime
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   CANCEL APPOINTMENT (ADMIN OR USER OWN) - FIXED
========================================================= */
exports.cancelAppointment = async (req, res) => {
  try {
    const role = getRole(req);
    const authId = getAuthId(req);

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    if (role === "user" && appt.userId.toString() !== authId) {
      return res.status(403).json({ message: "Not your appointment" });
    }

    appt.status = "cancelled";
    await appt.save();

    // FIX: Format time for provider notification
    const providerLocalTime = await formatForProvider(appt.start, appt.providerId);

    await Notification.create({
      providerId: appt.providerId,
      message: `Appointment with ${req.user?.name || "a user"} for ${providerLocalTime} was cancelled.`,
      read: false
    });

    res.json({ message: "Appointment cancelled" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   RESCHEDULE (ADMIN + PROVIDER OWN + USER OWN)
========================================================= */
exports.rescheduleAppointment = async (req, res) => {
  try {
    const role = getRole(req);
    const authId = getAuthId(req);
    const { start, end, timezone } = req.body; // Make sure to get timezone from request

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    if (
      role === "user" &&
      appointment.userId.toString() !== authId
    ) {
      return res.status(403).json({ message: "Not your appointment" });
    }

    if (
      role === "provider" &&
      appointment.providerId.toString() !== authId
    ) {
      return res.status(403).json({ message: "Not your appointment" });
    }

    const { startDate, endDate } = validateTime(start, end);

    const conflict = await Appointment.findOne({
      providerId: appointment.providerId,
      _id: { $ne: appointment._id },
      start: { $lt: endDate },
      end: { $gt: startDate },
      status: { $in: ["pending", "approved", "rescheduled"] }
    });

    if (conflict) {
      return res.status(409).json({ message: "Time conflict detected" });
    }

    appointment.start = startDate;
    appointment.end = endDate;
    appointment.status = role === "admin" || role === "provider" ? "approved" : "pending";

    await appointment.save();

    // Get provider and user details
    const provider = await Provider.findById(appointment.providerId);
    const user = await User.findById(appointment.userId);

    // FIX 1: Get user's timezone (from request, or from database)
    const userTimezone = timezone || req.headers['x-timezone'] || 'Asia/Kolkata'; // Default to IST

    // FIX 2: Format time for user in THEIR timezone
    const userLocalTime = new Date(startDate).toLocaleString('en-IN', {
      timeZone: userTimezone,
      dateStyle: 'full',
      timeStyle: 'short'
    });

    // FIX 3: For provider, try to get their timezone or use same as user
    const providerTimezone = provider.timezone || userTimezone;
    const providerLocalTime = new Date(startDate).toLocaleString('en-IN', {
      timeZone: providerTimezone,
      dateStyle: 'full',
      timeStyle: 'short'
    });

    // FIX 4: Create notifications with LOCAL times, not UTC
    await Notification.create({
      userId: appointment.userId,
      message: `Your appointment with ${provider.name} has been rescheduled to ${userLocalTime}.`,
      read: false
    });

    await Notification.create({
      providerId: appointment.providerId,
      message: `Appointment with ${user.name} has been rescheduled to ${providerLocalTime}.`,
      read: false
    });

    // FIX 5: Return response with local time for frontend
    res.json({
      message: "Appointment rescheduled",
      appointment: {
        ...appointment.toObject(),
        userLocalTime,
        providerLocalTime
      }
    });

  } catch (err) {
    console.error("Reschedule error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   MARK MISSED APPOINTMENTS (SYSTEM JOB) - FIXED
========================================================= */
exports.markMissedAppointments = async () => {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  const missedAppointments = await Appointment.find({
    status: "pending",
    start: { $lt: fifteenMinutesAgo }
  })
    .populate("userId", "name")
    .populate("providerId", "name");

  for (const appt of missedAppointments) {
    appt.status = "missed";
    await appt.save();

    // FIX: Format times for each recipient
    const userLocalTime = await formatForUser(appt.start, appt.userId._id);
    const providerLocalTime = await formatForProvider(appt.start, appt.providerId._id);

    // USER notification with formatted time
    await Notification.create({
      userId: appt.userId._id,
      message: `Your appointment with ${appt.providerId.name} for ${userLocalTime} was missed. Please reschedule.`,
      read: false
    });

    // PROVIDER notification with formatted time
    await Notification.create({
      providerId: appt.providerId._id,
      message: `Your appointment with ${appt.userId.name} for ${providerLocalTime} was missed. Please reschedule.`,
      read: false
    });

    // ADMIN notification
    const adminIds = await getAdminUserIds();
    for (const adminId of adminIds) {
      await Notification.create({
        userId: adminId,
        message: `You did not approve the appointment for ${appt.userId.name} with ${appt.providerId.name} for ${new Date(appt.start).toLocaleString()} within 15 minutes.`,
        read: false
      });
    }
  }
};

/* =========================================================
   Book a slot with strict date/slot validation - FIXED
========================================================= */
exports.bookSlot = async (req, res) => {
  try {
    const { providerId, slotTime, date, timezone } = req.body;

    if (!timezone) {
      return res.status(400).json({
        message: "Timezone is required. Please refresh and try again."
      });
    }

    // console.log("=== BOOK SLOT DEBUG ===");
    // console.log("1. Received:", { date, slotTime, timezone });

    if (!providerId || !date || !slotTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    // Parse times
    const [startTime, endTime] = slotTime.split(" - ");

    // CREATE DATES FIRST
    const userMoment = moment.tz(`${date} ${startTime}`, "YYYY-MM-DD HH:mm", timezone);
    const slotStart = userMoment.utc().toDate();
    
    const userMomentEnd = moment.tz(`${date} ${endTime}`, "YYYY-MM-DD HH:mm", timezone);
    const slotEnd = userMomentEnd.utc().toDate();

    // console.log("2. Time conversion:", {
    //   userLocal: `${date} ${startTime} (${timezone})`,
    //   utcStored: slotStart.toISOString(),
    //   utcEndStored: slotEnd.toISOString()
    // });

    // Check if already booked
    const existingAppointment = await Appointment.findOne({
      providerId,
      status: { $in: ["pending", "approved"] },
      start: { $lt: slotEnd },
      end: { $gt: slotStart }
    });

    if (existingAppointment) {
      return res.status(400).json({ msg: "Slot already booked" });
    }

    // Create appointment
    const appointment = await Appointment.create({
      providerId,
      userId: req.user._id,
      start: slotStart,
      end: slotEnd,
      status: "pending"
    });

    // console.log("3. Appointment created:", {
    //   startUTC: appointment.start.toISOString(),
    //   endUTC: appointment.end.toISOString()
    // });

    // Format for user
    const userLocalTime = await formatForUser(slotStart, req.user._id, timezone);
    // console.log("4. Formatted for user:", userLocalTime);

    // Create notifications
    await Notification.create({
      userId: req.user._id,
      message: `Your appointment with ${provider.name} for ${userLocalTime} is pending approval.`,
      read: false
    });

    const providerTimezone = provider.timezone || timezone;
    const providerLocalTime = await formatForProvider(slotStart, providerId, providerTimezone);

    await Notification.create({
      providerId,
      message: `${req.user.name} booked an appointment for ${providerLocalTime}. Approval required.`,
      read: false
    });

    // Admin notifications
    const admins = await User.find({ role: "admin" });
    await Promise.all(
      admins.map(admin =>
        Notification.create({
          userId: admin._id,
          message: `${req.user.name} booked an appointment with ${provider.name} for ${new Date(slotStart).toLocaleString()}.`,
          read: false
        })
      )
    );

    res.json({
      msg: "Slot booked successfully",
      appointment: {
        ...appointment.toObject(),
        userLocalTime,
        providerLocalTime
      }
    });

  } catch (error) {
    console.error("BOOK SLOT ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};


/* =========================================================
   UNLOCK SLOT (USED ON APPOINTMENT REJECT)
   ========================================================= */
exports.unlockSlot = async (req, res) => {
  try {
    const { id } = req.params; // providerId
    const { date, slotTime } = req.body;

    if (!date || !slotTime) {
      return res.status(400).json({ msg: "date and slotTime are required" });
    }

    const provider = await Provider.findById(id);
    if (!provider) {
      return res.status(404).json({ msg: "Provider not found" });
    }

    const dayName = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
    });

    const dayAvailability = provider.weeklyAvailability.find(
      (d) => d.day === dayName
    );

    if (!dayAvailability) {
      return res.status(400).json({ msg: "No availability for this day" });
    }

    const slot = dayAvailability.slots.find(
      (s) => s.time === slotTime
    );

    if (!slot) {
      return res.status(404).json({ msg: "Slot not found" });
    }

    slot.isBooked = false; // âœ… UNLOCK
    await provider.save();

    res.json({ msg: "Slot unlocked successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// TEST TIME CONVERSION
// exports.testTimeConversion = async (req, res) => {
//   const { utcDate, timezone } = req.body;

//   const testDate = utcDate ? new Date(utcDate) : new Date('2026-03-03T15:30:00.000Z');
//   const testTimezone = timezone || 'Asia/Kolkata';

//   try {
//     // Test with your current helper
//     const formatted = await formatForUser(testDate, 'test-user', testTimezone);

//     // Manual conversion for comparison
//     const manualFormat = moment.utc(testDate)
//       .tz(testTimezone)
//       .format('dddd, MMMM Do YYYY [at] h:mm A');

//     res.json({
//       input: {
//         utcDate: testDate.toISOString(),
//         timezone: testTimezone
//       },
//       helper_output: formatted,
//       manual_output: manualFormat,
//       match: formatted === manualFormat
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };