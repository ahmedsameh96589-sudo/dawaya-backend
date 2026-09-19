const express = require("express");
const router  = express.Router();
const c       = require("../controllers/adminController");
const dc      = require("../controllers/doctorController");
const cc      = require("../controllers/consultationController");
const pc      = require("../controllers/prescriptionController"); // BUG FIX #2
const nc      = require("../controllers/notificationController");
const { protect, restrictTo } = require("../middlewares/auth");
const upload  = require("../middlewares/upload");

router.use(protect, restrictTo("admin")); // All admin routes protected

// ── Dashboard ─────────────────────────────────────────────────
router.get("/dashboard",       c.getDashboard);
router.get("/stats/revenue",   c.getRevenueStats);

// ── User management ───────────────────────────────────────────
router.get("/users",           c.getUsers);
router.get("/users/:id",       c.getUser);
router.put("/users/:id",       c.updateUser);
router.delete("/users/:id",    c.deleteUser);

// ── Doctor management ─────────────────────────────────────────
router.post("/doctors",        upload.single("avatar"), dc.createDoctor);
router.put("/doctors/:id",     upload.single("avatar"), dc.updateDoctor);
router.delete("/doctors/:id",  dc.deleteDoctor);

// ── Consultation management ───────────────────────────────────
router.get("/consultations",   cc.getAllConsultations);

// ─────────────────────────────────────────────────────────────
// BUG FIX #2: Prescription management routes were completely
// missing from adminRoutes. The controller functions existed
// but were never mounted under /api/admin, so the admin had
// no working endpoint to list or approve prescriptions.
// ─────────────────────────────────────────────────────────────

// ── Prescription management ───────────────────────────────────
// GET  /api/admin/prescriptions            → list all (filter by status)
// PUT  /api/admin/prescriptions/:id/review → approve or reject
router.get("/prescriptions",            pc.getAllPrescriptions);
router.put("/prescriptions/:id/review", pc.reviewPrescription);

// ── Notification broadcast ────────────────────────────────────
router.post("/notifications/broadcast", nc.broadcastNotification);

module.exports = router;