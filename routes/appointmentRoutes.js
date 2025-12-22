const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middlewares/authMiddleware");

const {
  createAppointment,
  getAllAppointments,
  getUserAppointments,
  approveAppointment,
  rejectAppointment,
  cancelAppointment,
  rescheduleAppointment
} = require("../controllers/appointmentController");

router.post("/", protect, createAppointment);
router.get("/",protect, adminOnly, getAllAppointments);
router.get("/me",protect, getUserAppointments);
router.put("/:id/approve", protect, adminOnly, approveAppointment);
router.put("/:id/reject", protect, adminOnly, rejectAppointment);
router.put("/:id/cancel", protect, cancelAppointment);
router.put("/:id/reschedule", protect, rescheduleAppointment);

module.exports = router;
