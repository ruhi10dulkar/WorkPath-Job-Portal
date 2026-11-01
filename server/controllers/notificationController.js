const mongoose = require("mongoose");
const Notification = require("../models/Notification");

async function getNotifications(req, res) {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .select("type title message relatedJob relatedApplication isRead createdAt")
      .sort({ createdAt: -1 })
      .limit(50);
    return res.json({ success: true, notifications });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load notifications." });
  }
}

async function getUnreadCount(req, res) {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    return res.json({ success: true, count });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load unread notification count." });
  }
}

async function markAsRead(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Notification ID is invalid." });
  }
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    ).select("type title message relatedJob relatedApplication isRead createdAt");
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found." });
    return res.json({ success: true, notification });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to update notification." });
  }
}

async function markAllAsRead(req, res) {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    return res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to update notifications." });
  }
}

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
