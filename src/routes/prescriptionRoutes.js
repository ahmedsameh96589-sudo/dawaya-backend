const express = require("express");
const router  = express.Router();
const c       = require("../controllers/prescriptionController");
const { protect, restrictTo } = require("../middlewares/auth");
const upload  = require("../middlewares/upload");

// ─────────────────────────────────────────────────────────────
// BUG FIX #1: Admin routes MUST come before /:id route.
// Previously, GET /:id was first, so Express matched
// "/admin/all" as /:id with id="admin" → wrong handler called.
// ─────────────────────────────────────────────────────────────

// ── Admin routes (FIRST — before /:id) ───────────────────────
router.get("/admin/all",           protect, restrictTo("admin"), c.getAllPrescriptions);
router.put("/admin/:id/review",    protect, restrictTo("admin"), c.reviewPrescription);

// ── User routes ───────────────────────────────────────────────
router.post("/",    protect, upload.single("prescription"), c.uploadPrescription);
router.get("/",     protect, c.getMyPrescriptions);
router.get("/:id",  protect, c.getPrescription);  // ← now safely last

module.exports = router;