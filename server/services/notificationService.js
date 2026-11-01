const mongoose = require("mongoose");
const Notification = require("../models/Notification");

async function createNotification({ recipient, type, title, message, relatedJob, relatedApplication }) {
  if (!mongoose.isValidObjectId(recipient)) throw new Error("A valid notification recipient is required.");
  if (!type || !title?.trim() || !message?.trim()) {
    throw new Error("Notification type, title, and message are required.");
  }

  return Notification.create({ recipient, type, title, message, relatedJob, relatedApplication });
}

module.exports = { createNotification };
