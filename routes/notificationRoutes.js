const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");

const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications
} = require("../controllers/notificationController");

// All routes protected → user only accesses own notifications
router.use(protect);

router.get("/", getMyNotifications);                // get all notifications of logged-in user
router.put("/:id/read", markAsRead);                // mark single read
router.put("/read-all", markAllAsRead);             // mark all read
router.delete("/:id", deleteNotification);          // delete one
router.delete("/", clearAllNotifications);          // delete all

module.exports = router;
