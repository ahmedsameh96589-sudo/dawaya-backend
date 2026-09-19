const express = require("express");
const router  = express.Router();
const dc      = require("../controllers/doctorController");
const { protect, restrictTo } = require("../middlewares/auth");
const { protectDoctor }       = require("../middlewares/doctorAuth");
const upload  = require("../middlewares/upload");

// ══════════════════════════════════════════════════════════════
//  PUBLIC
// ══════════════════════════════════════════════════════════════
router.get("/",         dc.getDoctors);
router.post("/login",   dc.doctorLogin);

// ══════════════════════════════════════════════════════════════
//  DOCTOR — Profile & Settings
// ══════════════════════════════════════════════════════════════
router.get("/me/profile",      protectDoctor, dc.getDoctorMe);
router.put("/me/profile",      protectDoctor, upload.single("avatar"), dc.updateDoctorMe);
router.put("/me/availability", protectDoctor, dc.toggleAvailability);

// ══════════════════════════════════════════════════════════════
//  DOCTOR — Dashboard
// ══════════════════════════════════════════════════════════════
router.get("/me/dashboard",    protectDoctor, dc.getDoctorDashboard);

// ══════════════════════════════════════════════════════════════
//  DOCTOR — Chat / Consultations
// ══════════════════════════════════════════════════════════════

// قايمة بكل المحادثات (مع فلتر بالـ status)
// GET /api/doctors/me/consultations
// GET /api/doctors/me/consultations?status=pending
// GET /api/doctors/me/consultations?status=active
router.get("/me/consultations",
  protectDoctor, dc.getDoctorConsultations);

// تفاصيل محادثة واحدة + كل الرسائل (بيعلّم الرسائل مقروءة تلقائي)
// GET /api/doctors/me/consultations/:id
router.get("/me/consultations/:id",
  protectDoctor, dc.getDoctorConsultationById);

// الدكتور يرد على المستخدم
// POST /api/doctors/me/consultations/:id/reply
router.post("/me/consultations/:id/reply",
  protectDoctor, upload.single("attachment"), dc.replyToConsultation);

// الدكتور يقفل المحادثة
// PUT /api/doctors/me/consultations/:id/close
router.put("/me/consultations/:id/close",
  protectDoctor, dc.closeDoctorConsultation);

// Public single-doctor profile — must stay after all /me/* routes
router.get("/:id", dc.getDoctor);

module.exports = router;
