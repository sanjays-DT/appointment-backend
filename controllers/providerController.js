const Provider = require("../models/Provider");
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const bcrypt = require("bcrypt");
const moment = require('moment-timezone');
const { validateName, validateEmail, validatePassword } = require("../utils/validators");
const Notification = require("../models/Notification");
const { formatForUser, formatForProvider } = require("../utils/notificationHelper");
const User = require("../models/User");

/* ======================
   SLOT GENERATOR
   ====================== */
const generateSlots = (startTime, endTime, slotMinutes) => {
  const slots = [];
  let start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);

  while (start < end) {
    const next = new Date(start.getTime() + slotMinutes * 60000);
    slots.push({
      time: `${start.toTimeString().slice(0, 5)} - ${next.toTimeString().slice(0, 5)}`,
      isBooked: false,
    });
    start = next;
  }
  return slots;
};

/* ======================
   CREATE PROVIDER
   ====================== */
exports.createProvider = async (req, res) => {
  try {
    const provider = new Provider(req.body);

    if (req.file) {
      provider.avatar = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await provider.save();
    res.status(201).json(provider);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   GET PROVIDERS / BY ID
   ====================== */
exports.getProviders = async (req, res) => {
  try {
    const providers = await Provider.find().populate("categoryId");
    res.json(providers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProviderById = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id).populate("categoryId");
    if (!provider) return res.status(404).json({ message: "Provider not found" });
    res.json(provider);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   UPDATE PROVIDER
   ====================== */
exports.updateProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) return res.sendStatus(404);

    Object.assign(provider, req.body || {});
    if (req.file) {
      provider.avatar = { data: req.file.buffer, contentType: req.file.mimetype };
    }

    await provider.save();

    res.json({
      message: "Provider updated successfully",
      provider: {
        _id: provider._id,
        name: provider.name,
        speciality: provider.speciality,
        hourlyPrice: provider.hourlyPrice,
        city: provider.city,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   AVATAR
   ====================== */
exports.getProviderAvatar = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider || !provider.avatar) return res.sendStatus(404);

    res.set("Content-Type", provider.avatar.contentType);
    res.send(provider.avatar.data);
  } catch (err) {
    console.error("Avatar fetch error â†’", err);
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   DELETE PROVIDER
   ====================== */
exports.deleteProvider = async (req, res) => {
  try {
    const provider = await Provider.findByIdAndDelete(req.params.id);
    if (!provider) return res.status(404).json({ message: "Provider not found" });
    res.json({ message: "Provider deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setAvailability = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    const { weeklyAvailability, dateOverrides } = req.body;

    /* ==============================
       Block Removing Days With Future Bookings
    =============================== */

    if (Array.isArray(weeklyAvailability)) {

      // OLD days from DB
      const oldDays = provider.weeklyAvailability.map((d) => d.day);

      // NEW days from request
      const newDays = weeklyAvailability.map((d) => d.day);

      // Detect removed days
      const removedDays = oldDays.filter((day) => !newDays.includes(day));

      if (removedDays.length > 0) {
        const now = new Date();

        // Generate ALL new valid slots
        const newSlots = [];

        weeklyAvailability.forEach((item) => {
          const slots = generateSlots(
            item.startTime,
            item.endTime,
            item.slotMinutes
          );

          slots.forEach((slot) => {
            newSlots.push({
              day: item.day,
              time: slot.time,
            });
          });
        });

        // Get all future active appointments
        const futureAppointments = await Appointment.find({
          providerId: provider._id,
          status: { $in: ["pending", "approved"] },
        });

        for (const appointment of futureAppointments) {
          if (appointment.start < now) continue;

          const appointmentDay = appointment.start.toLocaleDateString(
            "en-US",
            { weekday: "long" }
          );

          const startTime = appointment.start
            .toISOString()
            .substring(11, 16);
          const endTime = appointment.end
            .toISOString()
            .substring(11, 16);

          const slotTime = `${startTime} - ${endTime}`;

          const isStillValid = newSlots.some(
            (s) => s.day === appointmentDay && s.time === slotTime
          );

          if (!isStillValid) {
            return res.status(400).json({
              message: `Cannot modify availability. Appointment exists on ${appointmentDay} at ${slotTime}`,
            });
          }
        }

        // Safe to update weekly availability
        provider.weeklyAvailability = weeklyAvailability.map((item) => ({
          day: item.day,
          slots: generateSlots(
            item.startTime,
            item.endTime,
            item.slotMinutes
          ),
        }));
      }
    }

    /* ==============================
       Date Overrides
    =============================== */

    if (Array.isArray(dateOverrides)) {
      provider.dateOverrides = dateOverrides.map((d) => ({
        date: d.date,
        slots: d.slots.map((s) => ({
          time: s.time,
          isAvailable: s.isAvailable,
        })),
      }));
    }

    await provider.save();

    res.json({
      message: "Availability updated successfully",
      weeklyAvailability: provider.weeklyAvailability,
      dateOverrides: provider.dateOverrides,
    });

  } catch (err) {
    console.error("Set availability error:", err);
    res.status(500).json({ message: err.message });
  }
};


exports.getAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const provider = await Provider.findById(id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    //  Check full-day unavailability
    if (provider.unavailableDates?.includes(date)) {
      return res.json({
        slots: [],
        message: "Provider unavailable on this date"
      });
    }

    const selectedDate = new Date(date);
    const dayName = selectedDate.toLocaleDateString("en-US", {
      weekday: "long",
    });

    const weekly = provider.weeklyAvailability.find(
      d => d.day === dayName
    );

    if (!weekly) {
      return res.json({
        date,
        slots: [],
      });
    }

    // 1ï¸âƒ£ Start with weekly slots
    let finalSlots = weekly.slots.map(s => ({
      time: s.time,
      available: !s.isBooked,
    }));

    // 2ï¸âƒ£ Check if date override exists
    const override = provider.dateOverrides.find(
      d => d.date === date
    );

    if (override) {
      finalSlots = finalSlots.map(slot => {
        const overrideSlot = override.slots.find(
          o => o.time === slot.time
        );

        if (overrideSlot) {
          return {
            time: slot.time,
            available: overrideSlot.isAvailable,
          };
        }

        return slot;
      });
    }

    res.json({
      date,
      slots: finalSlots,
    });

  } catch (err) {
    console.error("Availability error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ======================
   PROVIDER AUTH: REGISTER & LOGIN
   ====================== */
exports.registerProvider = async (req, res) => {
  try {
    const { name, email, password, categoryId, speciality, city, hourlyPrice, address } = req.body;
    const err = validateName(name) || validateEmail(email) || validatePassword(password);
    if (err) return res.status(400).json({ message: err });

    if (await Provider.findOne({ email })) return res.status(400).json({ message: "Email already registered" });

    const provider = new Provider({
      name, email, password: await bcrypt.hash(password, 10),
      categoryId, speciality, city, hourlyPrice, address, isApproved: false, role: "provider",
    });

    if (req.file) provider.avatar = { data: req.file.buffer, contentType: req.file.mimetype };

    await provider.save();
    res.status(201).json({ message: "Registered successfully. Wait for admin approval.", provider: { id: provider._id, name: provider.name, email: provider.email, isApproved: provider.isApproved } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   PROVIDER DASHBOARD
   ====================== */
exports.getProviderDashboard = async (req, res) => {
  try {
    const provider = await Provider.findById(req.provider._id).populate("categoryId");
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    res.json({ message: "Provider dashboard", provider: { _id: provider._id, name: provider.name, speciality: provider.speciality, city: provider.city, weeklyAvailability: provider.weeklyAvailability, unavailableDates: provider.unavailableDates } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.approveProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    provider.isApproved = true;
    await provider.save();

    res.json({ message: "Provider approved", provider: { id: provider._id, isApproved: provider.isApproved } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getProviderDashboardStats = async (req, res) => {
  try {
    const providerId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }

    const providerObjectId = new mongoose.Types.ObjectId(providerId);

    // ---- ISO WEEK RANGE (Safe) ----
    const now = new Date();
    const day = now.getUTCDay() || 7; // Sunday fix
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - day + 1);
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
    endOfWeek.setUTCHours(23, 59, 59, 999);

    // ---- Parallel Queries ----
    const [
      totalAppointments,
      cancelled,
      thisWeek,
      bookingsPerWeek
    ] = await Promise.all([

      // Total non-cancelled
      Appointment.countDocuments({
        providerId: providerObjectId,
        status: { $ne: "cancelled" }
      }),

      // Cancelled
      Appointment.countDocuments({
        providerId: providerObjectId,
        status: "cancelled"
      }),

      // This Week Bookings
      Appointment.countDocuments({
        providerId: providerObjectId,
        start: { $gte: startOfWeek, $lte: endOfWeek },
        status: { $ne: "cancelled" }
      }),

      // Weekly Aggregation
      Appointment.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            start: { $exists: true },
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: {
              year: { $isoWeekYear: "$start" },
              week: { $isoWeek: "$start" }
            },
            total: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.week": 1 } },
        {
          $project: {
            _id: 0,
            label: {
              $concat: [
                { $toString: "$_id.year" },
                "-W",
                { $toString: "$_id.week" }
              ]
            },
            value: "$total"
          }
        }
      ])
    ]);

    return res.json({
      providerId,
      totalAppointments,
      cancelled,
      thisWeek,
      weeklyBookings: bookingsPerWeek
    });

  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


// Get provider's available slots for a specific date
exports.getProviderSlots = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, timezone } = req.query; // Get timezone from frontend

    if (!id || !date) {
      return res.status(400).json({ message: "Missing providerId or date" });
    }

    if (!timezone) {
      return res.status(400).json({ message: "Timezone is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid provider id" });
    }

    const provider = await Provider.findById(id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    if (provider.unavailableDates?.includes(date)) {
      return res.json({
        slots: [],
        isUnavailable: true
      });
    }

    // Get weekday name from the date in the user's timezone
    const day = moment.tz(date, "YYYY-MM-DD", timezone).format('dddd');
    console.log("Day in user's timezone:", day);

    const dayAvailability = provider.weeklyAvailability.find(
      (d) => d.day === day
    );

    if (!dayAvailability) {
      return res.json({ slots: [] });
    }

    // Get date overrides (manual changes)
    const override = provider.dateOverrides?.find(
      (d) => d.date === date
    );

    // Calculate start and end of day in UTC for the user's timezone
    const startOfDay = moment.tz(date, "YYYY-MM-DD", timezone).startOf('day').utc().toDate();
    const endOfDay = moment.tz(date, "YYYY-MM-DD", timezone).endOf('day').utc().toDate();

    console.log("Date range for query:", {
      date,
      timezone,
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString()
    });

    // Get booked appointments using UTC times
    const bookedAppointments = await Appointment.find({
      providerId: id,
      start: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $in: ["pending", "approved"] }
    });

    console.log("Booked appointments found:", bookedAppointments.length);

    const slots = dayAvailability.slots.map(slot => {
      const [startTime, endTime] = slot.time.split(" - ");

      // Convert slot time to UTC for comparison with booked appointments
      const slotStartUTC = moment.tz(`${date} ${startTime}`, "YYYY-MM-DD HH:mm", timezone).utc().toDate();
      const slotEndUTC = moment.tz(`${date} ${endTime}`, "YYYY-MM-DD HH:mm", timezone).utc().toDate();

      // Check if this slot is booked by comparing UTC times
      const isBooked = bookedAppointments.some(appt => {
        // Allow 1 minute tolerance for time matching
        const timeDiff = Math.abs(appt.start.getTime() - slotStartUTC.getTime());
        return timeDiff < 60000; // Within 1 minute
      });

      // Check override
      const overrideSlot = override?.slots?.find(
        (s) => s.time === slot.time
      );

      let isAvailable = true; // GREEN by default

      if (overrideSlot) {
        isAvailable = overrideSlot.isAvailable;
      }

      // Booking always overrides everything
      if (isBooked) {
        isAvailable = false;
      }

      return {
        time: slot.time,
        isBooked,
        isAvailable,
        // Optional: include UTC times for debugging
        debug: {
          slotStartUTC: slotStartUTC.toISOString(),
          slotEndUTC: slotEndUTC.toISOString()
        }
      };
    });

    console.log("Slots with status:", slots.map(s => ({
      time: s.time,
      isBooked: s.isBooked,
      isAvailable: s.isAvailable
    })));

    res.json({ slots });

  } catch (error) {
    console.error("GET SLOTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add unavailable dates 
/* ======================
   SET UNAVAILABLE DATES
   ====================== */
exports.setUnavailableDates = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { dates, forceCancel, cancelReason } = req.body;

    if (!Array.isArray(dates)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Dates must be an array" });
    }

    const provider = await Provider.findById(id).session(session);
    if (!provider) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Provider not found" });
    }

    const reasonText =
      cancelReason || "Cancelled due to provider emergency";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    /* ================= CONFLICT CHECK ================= */

    const dateConditions = dates.map((date) => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return {
        start: { $gte: startOfDay, $lte: endOfDay },
      };
    });

    const approvedAppointments = await Appointment.find({
      providerId: provider._id,
      status: "approved",
      start: { $gte: today },
      $or: dateConditions,
    }).session(session);

    if (approvedAppointments.length > 0 && !forceCancel) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        message: "Approved appointments exist on selected dates.",
        hasConflicts: true,
        appointmentsCount: approvedAppointments.length,
      });
    }

    /* ================= FORCE CANCEL ================= */

    if (approvedAppointments.length > 0 && forceCancel) {
      await Appointment.updateMany(
        { _id: { $in: approvedAppointments.map((a) => a._id) } },
        {
          $set: {
            status: "cancelled",
            reason: reasonText,
          },
        },
        { session }
      );

      for (const appointment of approvedAppointments) {
        const user = await User.findById(appointment.userId).session(session);
        const userTimezone = user?.timezone || "Asia/Kolkata";

        const userLocalTime = await formatForUser(
          appointment.start,
          appointment.userId,
          userTimezone
        );

        await Notification.create(
          [
            {
              userId: appointment.userId,
              title: "Appointment Cancelled",
              message: `Your appointment with ${provider.name} scheduled for ${userLocalTime} has been cancelled. Reason: ${reasonText}.`,
              type: "appointment_cancelled",
              read: false,
            },
          ],
          { session }
        );
      }
    }

    /* ================= SAVE UNAVAILABLE DATES ================= */

    provider.unavailableDates = dates;
    await provider.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: forceCancel
        ? "Unavailable dates updated and conflicting appointments cancelled"
        : "Unavailable dates updated successfully",
      unavailableDates: provider.unavailableDates,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Set unavailable dates error:", err);
    return res.status(500).json({ message: err.message });
  }
};

exports.getUnavailableDates = async (req, res) => {
  try {
    const { id } = req.params;

    const provider = await Provider.findById(id).select("unavailableDates");

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    res.json({
      unavailableDates: provider.unavailableDates || [],
    });

  } catch (err) {
    console.error("Get unavailable dates error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.removeUnavailableDate = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body; // single date string "YYYY-MM-DD"

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const provider = await Provider.findById(id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    provider.unavailableDates = provider.unavailableDates.filter(
      (d) => d !== date
    );

    await provider.save();

    res.json({
      message: "Date removed from unavailable list",
      unavailableDates: provider.unavailableDates,
    });

  } catch (err) {
    console.error("Remove unavailable date error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= GET USER PREFERENCES =================
exports.getPreferences = async (req, res) => {
  try {
    // Make sure to fetch the full document including preferences
    const provider = await Provider.findById(req.provider._id).select("preferences");

    if (!provider) {
      return res.status(404).json({ ok: false, error: "Provider not found" });
    }

    // Always return theme, default to 'light' if missing
    return res.json({ theme: provider.preferences?.theme || "light" });
  } catch (err) {
    console.error("Get Preferences Error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { theme } = req.body;

    // Validate theme
    if (!["light", "dark"].includes(theme)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid theme value",
      });
    }

    // Find provider
    const provider = await Provider.findById(req.provider._id).select("preferences");

    if (!provider) {
      return res.status(404).json({
        ok: false,
        error: "Provider not found",
      });
    }

    // Initialize preferences object if missing
    provider.preferences = provider.preferences || {};
    provider.preferences.theme = theme;

    await provider.save();

    return res.json({
      ok: true,
      theme: provider.preferences.theme,
    });
  } catch (err) {
    console.error("Update Preferences Error:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
};

