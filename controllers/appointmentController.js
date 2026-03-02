const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const Provider = require("../models/Provider");
const User = require("../models/User");
const mongoose = require("mongoose");

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
   CREATE APPOINTMENT (USER ONLY)
========================================================= */
exports.createAppointment = async (req, res) => {
  try {
    const role = getRole(req);
    if (role !== "user") {
      return res.status(403).json({ message: "Only users can book appointments" });
    }

    const { providerId, start, end } = req.body;
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

    await Notification.create({
      userId,
      message: `Your appointment is pending approval.`
    });

    await Notification.create({
      providerId: providerId,
      message: `New appointment request from ${req.user?.name || "a user"} is pending approval.`
    });

    const adminIds = await getAdminUserIds();
    await Promise.all(
      adminIds.map(adminId =>
        Notification.create({
          userId: adminId,
          message: `New appointment requires approval.`
        })
      )
    );

    res.status(201).json({ message: "Appointment created", appointment });

  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

/* =========================================================
   GET APPOINTMENTS (ADMIN â†’ ALL | PROVIDER â†’ OWN)
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
   APPROVE APPOINTMENT (ADMIN + PROVIDER OWN)
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

    await Notification.create({
      userId: appt.userId,
      message: `Your appointment has been approved with ${provider.name}.`
    });

    res.json({ message: "Appointment approved", appt });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   REJECT APPOINTMENT (ADMIN + PROVIDER OWN)
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

    await Notification.create({
      userId: appt.userId,
      message: `Your appointment has been rejected with ${provider.name}.`
    });

    res.json({ message: "Appointment rejected", appt });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   CANCEL APPOINTMENT (ADMIN OR USER OWN)
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

    await Notification.create({
      providerId: appt.providerId,
      message: `Appointment with ${req.user?.name || "a user"} was cancelled.`
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
    const { start, end } = req.body;

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

   const formattedTime = startDate.toISOString();

    await appointment.save();
    const provider = await Provider.findById(appointment.providerId);
    await Notification.create({
      userId: appointment.userId,
      message: `Your appointment with ${provider.name} has been rescheduled to ${formattedTime}.`
    });

    const user = await User.findById(appointment.userId);
    await Notification.create({
      providerId: appointment.providerId,
      message: `Appointment with ${user.name} has been rescheduled to ${formattedTime}.`
    });
    res.json({ message: "Appointment rescheduled", appointment });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// MARK MISSED APPOINTMENTS (SYSTEM JOB)
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

    // USER notification
    await Notification.create({
      userId: appt.userId._id,
      message: `Your appointment with ${appt.providerId.name} was missed. Please reschedule.`
    });

    await Notification.create({
      providerId: appt.providerId._id,
      message: `Your appointment with ${appt.userId.name} was missed. Please reschedule.`
    });

    // ADMIN notification
    const adminIds = await getAdminUserIds();
    for (const adminId of adminIds) {
      await Notification.create({
        userId: adminId,
        message: `You did not approve the appointment for ${appt.userId.name} with ${appt.providerId.name} within 15 minutes.`
      });
    }
  }
};

/* =========================================================
   UPDATED: Book a slot with strict date/slot validation
   ========================================================= */
exports.bookSlot = async (req, res) => {
  try {
    const { providerId, slotTime, date } = req.body;

    if (!providerId || !date || !slotTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const day = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
    });

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    //Check unavailable dates
    if (provider.unavailableDates?.includes(date)) {
      return res.status(400).json({ msg: "Provider not available on this date" });
    }

    //Check weekly template
    const dayAvailability = provider.weeklyAvailability.find(
      (d) => d.day === day
    );

    if (!dayAvailability) {
      return res.status(400).json({ msg: "No availability for this day" });
    }

    const slotExists = dayAvailability.slots.find(
      (s) => s.time === slotTime
    );

    if (!slotExists) {
      return res.status(400).json({ msg: "Slot does not exist" });
    }

    //  Time validation
    const today = new Date();
    const [startTime, endTime] = slotTime.split(" - ");

    const slotStart = new Date(`${date}T${startTime}:00`);
    const slotEnd = new Date(`${date}T${endTime}:00`);

    if (slotEnd <= today) {
      return res.status(400).json({ msg: "Cannot select ended slot" });
    }

    //Check if already booked (IMPORTANT FIX)
    const existingAppointment = await Appointment.findOne({
      providerId,
      status: { $in: ["pending", "approved"] },
      start: { $lt: slotEnd },
      end: { $gt: slotStart }
    });
    if (existingAppointment) {
      return res.status(400).json({ msg: "Slot already booked" });
    }

    //Create appointment (DO NOT modify weeklyAvailability)
    const appointment = await Appointment.create({
      providerId,
      userId: req.user._id,
      start: slotStart,
      end: slotEnd,
      status: "pending"
    });

    //Notifications
    await Notification.create({
      userId: req.user._id,
      message: `Your appointment with ${provider.name} is pending approval.`
    });

    await Notification.create({
      providerId,
      message: `${req.user.name} booked an appointment. Approval required.`
    });

    const admins = await User.find({ role: "admin" });

    await Promise.all(
      admins.map(admin =>
        Notification.create({
          userId: admin._id,
          message: `${req.user.name} booked an appointment with ${provider.name}.`
        })
      )
    );

    res.json({ msg: "Slot booked successfully", appointment });

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

