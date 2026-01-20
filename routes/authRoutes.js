const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  register,
  login,
  forgotPassword,
  checkForgotApproval,
  resetPassword,
  adminApproveRequest,
} = require("../controllers/authController.js");

const { protect, adminOnly } = require("../middlewares/authMiddleware.js"); // protect routes
const upload = multer({ storage: multer.memoryStorage() });

// ================= AUTH ROUTES =================
router.post("/register", upload.single("avatar"), register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.get("/forgot-password/check", checkForgotApproval);
router.post("/forgot-password/reset", resetPassword);

// admin
router.post("/admin/approve-request", protect, adminOnly, adminApproveRequest);

module.exports = router;
