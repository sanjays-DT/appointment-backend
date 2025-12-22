const router = require("express").Router();

// Auth Routes
router.use("/auth", require("./authRoutes"));

// Category Routes
router.use("/categories", require("./categoryRoutes"));

// Provider Routes 
router.use("/providers", require("./providerRoutes"));

// Appointment Routes
router.use("/appointment", require("./appointmentRoutes.js"));

// Notification Routes
router.use("/notifications", require("./notificationRoutes.js"));

// Admin Analytics Routes
router.use("/analytics", require("./adminAnalyticsRoutes.js"));

module.exports = router;
