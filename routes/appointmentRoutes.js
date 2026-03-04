const express = require("express");
const router = express.Router();
const { protect, adminOnly, authorizeRoles } = require("../middlewares/authMiddleware");

const {
  createAppointment,
  getAllAppointments,
  getUserAppointments,
  getProviderAppointments,
  approveAppointment,
  rejectAppointment,
  cancelAppointment,
  rescheduleAppointment,
  unlockSlot,
  getSlotsByDate,
  testTimeConversion,
  bookSlot
} = require("../controllers/appointmentController");

router.post("/", protect, authorizeRoles("user"), createAppointment);

router.get("/", protect, authorizeRoles("admin", "provider"), getAllAppointments);

router.put("/:id/approve", protect, authorizeRoles("admin", "provider"), approveAppointment);

router.put("/:id/reject", protect, authorizeRoles("admin", "provider"), rejectAppointment);

router.put("/:id/cancel", protect, authorizeRoles("admin", "user"), cancelAppointment);

router.put("/:id/reschedule", protect, authorizeRoles("admin", "provider", "user"), rescheduleAppointment);

router.get("/me",protect, getUserAppointments);
router.get("/:id", protect, getProviderAppointments); 
router.put("/:id/unlock-slot", protect, adminOnly,unlockSlot);
router.post("/book-slot",protect,bookSlot);
// router.post("/test-time-conversion", testTimeConversion);

module.exports = router;
