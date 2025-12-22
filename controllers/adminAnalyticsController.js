const Appointment = require("../models/Appointment");
const Provider = require("../models/Provider");
const Category = require("../models/Category");

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
