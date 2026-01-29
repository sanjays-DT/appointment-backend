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
  rescheduleAppointment,
  unlockSlot,
  getSlotsByDate,
  bookSlot
} = require("../controllers/appointmentController");

router.post("/", protect, createAppointment);
router.get("/",protect, adminOnly, getAllAppointments);
router.get("/me",protect, getUserAppointments);
router.put("/:id/approve", protect, adminOnly, approveAppointment);
router.put("/:id/reject", protect, adminOnly, rejectAppointment);
router.put("/:id/cancel", protect, cancelAppointment);
router.put("/:id/reschedule", protect, rescheduleAppointment);
router.put("/:id/unlock-slot", protect, adminOnly,unlockSlot);
router.get("/:id/slots",protect,getSlotsByDate);
router.post("/book-slot",protect,bookSlot);

module.exports = router;
