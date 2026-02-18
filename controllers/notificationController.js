const Notification = require("../models/Notification");
function getRecipientQuery(req) {
  if (req.user) return { userId: req.user.id };
  if (req.provider) return { providerId: req.provider.id };
  return null;
}

// Get all notifications for logged-in user (owner only)
exports.getMyNotifications = async (req, res) => {
  try {
    const recipientQuery = getRecipientQuery(req);
    if (!recipientQuery) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const notifications = await Notification.find(recipientQuery)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message
    });
  }
};

// Mark one notification as read
exports.markAsRead = async (req, res) => {
  try {
    const recipientQuery = getRecipientQuery(req);
    if (!recipientQuery) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...recipientQuery },  // owner only
      { read: true },
      { new: true }
    );

    if (!notif) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification: notif
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating notification",
      error: error.message
    });
  }
};

// Mark ALL notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const recipientQuery = getRecipientQuery(req);
    if (!recipientQuery) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    await Notification.updateMany(
      recipientQuery,
      { read: true }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating notifications",
      error: error.message
    });
  }
};

// Delete one notification
exports.deleteNotification = async (req, res) => {
  try {
    const recipientQuery = getRecipientQuery(req);
    if (!recipientQuery) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      ...recipientQuery // owner only
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: error.message
    });
  }
};

// Delete ALL notifications
exports.clearAllNotifications = async (req, res) => {
  try {
    const recipientQuery = getRecipientQuery(req);
    if (!recipientQuery) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    await Notification.deleteMany(recipientQuery);

    res.status(200).json({
      success: true,
      message: "All notifications deleted"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error clearing notifications",
      error: error.message
    });
  }
};

