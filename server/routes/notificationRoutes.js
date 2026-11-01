const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notificationController");

const router = express.Router();
router.use(authenticateUser);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllAsRead);
router.get("/", getNotifications);
router.patch("/:id/read", markAsRead);

module.exports = router;
