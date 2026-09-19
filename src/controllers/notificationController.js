const Notification = require("../models/Notification");

const recipientId = (req) => req.user?._id || req.doctor?._id;

// ─── GET /api/notifications ───────────────────────────────────
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const ownerId = recipientId(req);
    if (!ownerId)
      return res.status(401).json({ success: false, message: "Not authorized." });

    const notifications = await Notification.find({ user: ownerId })
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total   = await Notification.countDocuments({ user: ownerId });
    const unread  = await Notification.countDocuments({ user: ownerId, isRead: false });

    res.status(200).json({
      success: true,
      unreadCount: unread,
      count: notifications.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { notifications },
    });
  } catch (err) { next(err); }
};

// ─── PUT /api/notifications/:id/read ─────────────────────────
exports.markAsRead = async (req, res, next) => {
  try {
    const ownerId = recipientId(req);
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: ownerId },
      { isRead: true },
      { new: true }
    );
    if (!notification)
      return res.status(404).json({ success: false, message: "Notification not found." });
    res.status(200).json({ success: true, data: { notification } });
  } catch (err) { next(err); }
};

// ─── PUT /api/notifications/read-all ─────────────────────────
exports.markAllAsRead = async (req, res, next) => {
  try {
    const ownerId = recipientId(req);
    await Notification.updateMany({ user: ownerId, isRead: false }, { isRead: true });
    res.status(200).json({ success: true, message: "All notifications marked as read." });
  } catch (err) { next(err); }
};

// ─── DELETE /api/notifications/:id ───────────────────────────
exports.deleteNotification = async (req, res, next) => {
  try {
    const ownerId = recipientId(req);
    await Notification.findOneAndDelete({ _id: req.params.id, user: ownerId });
    res.status(200).json({ success: true, message: "Notification deleted." });
  } catch (err) { next(err); }
};

// ─── PUT /api/notifications/fcm-token ────────────────────────
exports.saveFcmToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken || typeof fcmToken !== "string")
      return res.status(400).json({ success: false, message: "fcmToken is required." });

    const token = fcmToken.trim();
    if (!token)
      return res.status(400).json({ success: false, message: "fcmToken is required." });

    const role = req.doctor ? "doctor" : req.user ? "user" : null;
    if (req.doctor) {
      req.doctor.fcmToken = token;
      await req.doctor.save({ validateBeforeSave: false });
    } else if (req.user) {
      req.user.fcmToken = token;
      await req.user.save({ validateBeforeSave: false });
    } else {
      return res.status(401).json({ success: false, message: "Not authorized." });
    }

    const ownerId = req.doctor?._id || req.user?._id;
    console.log(`🔔 FCM token saved for ${role} ${ownerId} (${token.slice(0, 12)}...)`);
    res.status(200).json({ success: true, message: "FCM token saved." });
  } catch (err) { next(err); }
};

// ─── DELETE /api/notifications ───────────────────────────────
exports.clearAllNotifications = async (req, res, next) => {
  try {
    const ownerId = recipientId(req);
    await Notification.deleteMany({ user: ownerId });
    res.status(200).json({ success: true, message: "All notifications cleared." });
  } catch (err) { next(err); }
};

// ─── ADMIN: POST /api/admin/notifications/broadcast ──────────
exports.broadcastNotification = async (req, res, next) => {
  try {
    const { title, message, type = "promo" } = req.body;
    const User = require("../models/User");

    const users = await User.find({ role: "user", isActive: true }).select("_id");
    const docs  = users.map((u) => ({ user: u._id, title, message, type }));

    await Notification.insertMany(docs);

    res.status(201).json({
      success: true,
      message: `Broadcast sent to ${docs.length} users.`,
    });
  } catch (err) { next(err); }
};
