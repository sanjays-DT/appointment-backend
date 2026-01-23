const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middlewares/authMiddleware.js");
const { updateProfile, getUsersForReset,getPreferences, updatePreferences,} = require("../controllers/userController.js");
const { adminApproveRequest } = require("../controllers/authController.js");
const User = require("../models/User");

/* ================= MULTER SETUP ================= */
const upload = multer({ storage: multer.memoryStorage() });

/* ================= GET AVATAR ================= */
router.get("/:id/avatar", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.avatar) return res.sendStatus(404);

    res.set("Content-Type", user.avatar.contentType);
    res.send(user.avatar.data);
  } catch (err) {
    console.error("Avatar fetch error →", err);
    res.status(500).json({ message: err.message });
  }
});

/* ================= EDIT PROFILE ================= */
router.put(
  "/profile",
  protect,                
  upload.single("avatar"), 
  updateProfile           
);


// Admin reset password
router.post("/admin/reset-password", protect, async (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  next();
}, adminApproveRequest);

//  Users who requested password reset
router.get("/reset-requests", protect, async (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  next();
}, getUsersForReset);

/* ================= PREFERENCES ROUTES ================= */

// GET /api/preferences
router.get("/preferences", protect, getPreferences);

// PUT /api/preferences
router.put("/preferences", protect, updatePreferences);

module.exports = router;
