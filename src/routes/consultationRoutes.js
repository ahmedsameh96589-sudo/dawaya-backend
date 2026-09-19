const express = require("express");
const router  = express.Router();
const c       = require("../controllers/consultationController");
const { protect, restrictTo }     = require("../middlewares/auth");
const { protectUserOrDoctor }     = require("../middlewares/doctorAuth");
const upload  = require("../middlewares/upload");

// ── User: start & list consultations ─────────────────────────
router.post("/",     protect, c.startConsultation);
router.get("/",      protect, c.getMyConsultations);

// ── Shared (User or Doctor): view chat + send message + close ─
router.get( "/:id",              protectUserOrDoctor, c.getConsultation);
router.post("/:id/messages",     protectUserOrDoctor, upload.single("attachment"), c.sendMessage);
router.put( "/:id/close",        protectUserOrDoctor, c.closeConsultation);
router.put( "/:id/rate",         protect,             c.rateConsultation);

// ── Admin ─────────────────────────────────────────────────────
router.get("/admin/all",  protect, restrictTo("admin"), c.getAllConsultations);

module.exports = router;
