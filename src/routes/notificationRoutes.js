const express = require("express");
const router  = express.Router();
const c       = require("../controllers/notificationController");
const { protectUserOrDoctor } = require("../middlewares/doctorAuth");

router.use(protectUserOrDoctor);

router.get("/",              c.getNotifications);
router.put("/fcm-token",     c.saveFcmToken);
router.put("/read-all",      c.markAllAsRead);
router.delete("/",           c.clearAllNotifications);
router.put("/:id/read",      c.markAsRead);
router.delete("/:id",        c.deleteNotification);

module.exports = router;
