const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const Provider = require("../models/Provider");
const User = require("../models/User");
const Category = require("../models/Category");
const mongoose = require("mongoose");

// ADMIN ANALYTICS DASHBOARD
exports.getAdminAnalytics = async (req, res) => {
  try {
    /* BOOKINGS PER WEEK */
    const bookingsPerWeek = await Appointment.aggregate([
      { $match: { start: { $exists: true } } },
      {
        $group: {
          _id: {
            year: { $year: "$start" },
            week: { $isoWeek: "$start" }
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
      {
        $project: {
          _id: 0,
          label: { $concat: [{ $toString: "$_id.year" }, "-W", { $toString: "$_id.week" }] },
          value: "$total"
        }
      }
    ]);

    /* PROVIDER UTILIZATION */
    const providerUtilization = await Appointment.aggregate([
      {
        $group: {
          _id: "$providerId",
          total: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "providers",
          localField: "_id",
          foreignField: "_id",
          as: "provider"
        }
      },
      { $unwind: "$provider" },
      {
        $project: {
          _id: 0,
          label: "$provider.name",
          value: "$total"
        }
      }
    ]);

    /* CATEGORY USAGE via Provider's category */
    const categoryUsage = await Appointment.aggregate([
      {
        $lookup: {
          from: "providers",
          localField: "providerId",
          foreignField: "_id",
          as: "provider"
        }
      },
      { $unwind: "$provider" },
      {
        $lookup: {
          from: "categories",
          localField: "provider.categoryId",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },
      {
        $group: {
          _id: "$category._id",
          total: { $sum: 1 },
          name: { $first: "$category.name" }
        }
      },
      {
        $project: {
          _id: 0,
          label: "$name",
          value: "$total"
        }
      }
    ]);

    /*** RETURN ALL ANALYTICS ***/
    res.status(200).json({
      bookingsPerWeek,
      categoryUsage,
      providerUtilization
    });

  } catch (err) {
    console.error("Analytics failed:", err);
    res.status(500).json({ message: "Analytics failed" });
  }
};

// FETCH ALL APPOINTMENTS WITH USER & PROVIDER DETAILS (Admin Only)

// GET /appointments
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

// APPROVE APPOINTMENT (Admin Only)
exports.approveAppointment = async (req, res) => {
  try {
    // Role check
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can approve appointments."
      });
    }

    const { id } = req.params;

    // Fetch appointment FIRST (important for time check)
    const appt = await Appointment.findById(id)
      .populate("userId", "name email")
      .populate("providerId", "name speciality");

    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found."
      });
    }

    // 15-minute approval rule
    const startTime = new Date(appt.startTime); // appointment start time
    const approvalDeadline = new Date(startTime.getTime() + 15 * 60 * 1000);

    if (new Date() > approvalDeadline) {
      return res.status(400).json({
        success: false,
        message: "Approval time exceeded. Please reschedule or reject."
      });
    }

    // Approve appointment
    appt.status = "approved";
    await appt.save();

    //  Notify user
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

/*Reject appointment + auto-unlock slot */
exports.rejectAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ msg: "Appointment not found" });

    appt.status = "rejected";
    await appt.save();

    // Unlock slot
    const provider = await Provider.findById(appt.providerId);
    if (provider && provider.weeklyAvailability.length) {
      const dateStr = appt.start.toISOString().slice(0, 10);
      const dayName = new Date(appt.start).toLocaleDateString("en-US", { weekday: "long" });

      const dayAvailability = provider.weeklyAvailability.find(d => d.day === dayName);
      if (dayAvailability) {
        const slotTime = `${appt.start.toTimeString().slice(0,5)} - ${appt.end.toTimeString().slice(0,5)}`;
        const slot = dayAvailability.slots.find(s => s.time === slotTime);
        if (slot) slot.isBooked = false;
        await provider.save();
      }
    }

    res.json({ msg: "Appointment rejected & slot unlocked" });

  } catch (error) {
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

    slot.isBooked = false; // ✅ UNLOCK
    await provider.save();

    res.json({ msg: "Slot unlocked successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Category Controller

// CREATE
exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const category = new Category({
      name,
      description,
    });

    if (req.file) {
      category.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET SINGLE CATEGORY
exports.getSingleCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    return res.json({
      success: true,
      message: "Category fetched successfully",
      data: category
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


// UPDATE
exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.sendStatus(404);

    const { name, description } = req.body;
    if (name) category.name = name;
    if (description) category.description = description;

    if (req.file) {
      category.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await category.save();
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE
exports.deleteCategory = async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};