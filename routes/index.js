const router = require("express").Router();

// Auth Routes
router.use("/auth", require("./authRoutes"));

// Category Routes
router.use("/categories", require("./categoryRoutes"));

// Provider Routes 
router.use("/admin/providers", require("./providerRoutes"));

module.exports = router;
