const express = require("express");
const router = express.Router();
const { getAdminAnalytics } = require("../controllers/adminAnalyticsController.js");
const { adminOnly,protect } = require("../middlewares/authMiddleware.js");

router.get("/", protect, adminOnly ,getAdminAnalytics);

module.exports = router;
