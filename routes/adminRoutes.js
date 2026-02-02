const express = require("express");
const router = express.Router();
const { getAdminAnalytics } = require("../controllers/adminController.js");
const { adminOnly,protect } = require("../middlewares/authMiddleware.js");
const { unlockSlot, approveAppointment, rejectAppointment, getAllAppointments,getSingleCategory,createCategory,deleteCategory,updateCategory} = require("../controllers/adminController.js");
const upload = require("../middlewares/upload.js");

// Analytics Dashboard
router.get("/", protect, adminOnly ,getAdminAnalytics);

// Appointment Management
router.put("/:id/unlock-slot", protect, adminOnly,unlockSlot);
router.put("/appointments/:id/approve", protect, adminOnly, approveAppointment);
router.put("/appointments/:id/reject", protect, adminOnly, rejectAppointment);
router.get("/appointments",protect, adminOnly, getAllAppointments);

// Category Management
router.get("/categories/:id", protect, adminOnly, getSingleCategory);
router.delete("/categories/:id", protect, adminOnly, deleteCategory);
router.post("/categories", upload.single("image"), createCategory);
router.put("/categories/:id", upload.single("image"), updateCategory);

module.exports = router;
