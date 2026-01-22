const express = require("express");
const router = express.Router();

const {
  getPreferences,
  updatePreferences,
} = require("../controllers/preferencesController");

const {protect} = require("../middlewares/authMiddleware");

/* ================= PREFERENCES ROUTES ================= */

// GET /api/preferences
router.get("/", protect, getPreferences);

// PUT /api/preferences
router.put("/", protect, updatePreferences);

module.exports = router;
