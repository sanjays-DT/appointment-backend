const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middlewares/authMiddleware.js"); 
const { updateProfile } = require("../controllers/userController.js");
const User = require("../models/User.js");

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

module.exports = router;
