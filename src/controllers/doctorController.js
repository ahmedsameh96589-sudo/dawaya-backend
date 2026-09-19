const Doctor        = require("../models/Doctor");
const Consultation  = require("../models/Consultation");
const { sendToken } = require("../utils/jwt");
const escapeRegex = require("../utils/escapeRegex");
const { emitToConsultation } = require("../realtime");

// ─── Public: GET /api/doctors ────────────────────────────────
exports.getDoctors = async (req, res, next) => {
  try {
    const { specialty, available, page = 1, limit = 12 } = req.query;
    const filter = { isActive: true };
    if (specialty)            filter.specialty   = new RegExp(escapeRegex(specialty), "i");
    if (available === "true") filter.isAvailable = true;

    const doctors = await Doctor.find(filter)
      .select("-__v")
      .sort("-rating.average -totalConsultations")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Doctor.countDocuments(filter);
    res.status(200).json({
      success: true, count: doctors.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { doctors },
    });
  } catch (err) { next(err); }
};

// ─── Public: GET /api/doctors/:id ────────────────────────────
exports.getDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select("-__v");
    if (!doctor || !doctor.isActive)
      return res.status(404).json({ success: false, message: "Doctor not found." });
    res.status(200).json({ success: true, data: { doctor } });
  } catch (err) { next(err); }
};

// ─── Admin: POST /api/admin/doctors ──────────────────────────
exports.createDoctor = async (req, res, next) => {
  try {
    if (req.file) req.body.avatar = req.file.filename;
    // Admin-created accounts are ready to log in immediately
    req.body.isVerified = true;
    const doctor = await Doctor.create(req.body);
    doctor.password = undefined;
    res.status(201).json({ success: true, data: { doctor } });
  } catch (err) { next(err); }
};

// ─── Admin: PUT /api/admin/doctors/:id ───────────────────────
exports.updateDoctor = async (req, res, next) => {
  try {
    if (req.file) req.body.avatar = req.file.filename;
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found." });
    res.status(200).json({ success: true, data: { doctor } });
  } catch (err) { next(err); }
};

// ─── Admin: DELETE /api/admin/doctors/:id ────────────────────
exports.deleteDoctor = async (req, res, next) => {
  try {
    await Doctor.findByIdAndUpdate(req.params.id, { isActive: false });
    res.status(200).json({ success: true, message: "Doctor deactivated." });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  DOCTOR AUTH
// ═══════════════════════════════════════════════════════════════

// ─── POST /api/doctors/login ──────────────────────────────────
exports.doctorLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password required." });

    const doctor = await Doctor.findOne({ email }).select("+password");
    if (!doctor || !(await doctor.comparePassword(password)))
      return res.status(401).json({ success: false, message: "Invalid email or password." });

    if (!doctor.isActive)
      return res.status(403).json({ success: false, message: "Account deactivated. Contact admin." });

    doctor.lastSeenAt = new Date();
    await doctor.save({ validateBeforeSave: false });

    const jwt   = require("jsonwebtoken");
    const token = jwt.sign(
      { id: doctor._id, role: "doctor" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    doctor.password = undefined;
    res.status(200).json({ success: true, token, data: { doctor } });
  } catch (err) { next(err); }
};

// ─── GET /api/doctors/me/profile ─────────────────────────────
exports.getDoctorMe = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.doctor._id);
    res.status(200).json({ success: true, data: { doctor } });
  } catch (err) { next(err); }
};

// ─── PUT /api/doctors/me/profile ─────────────────────────────
exports.updateDoctorMe = async (req, res, next) => {
  try {
    const allowed = ["name","email","phone","nameAr","bio","bioAr","specialty","specialtyAr","languages","workingHours","consultationFee"];
    const updates = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.file) updates.avatar = req.file.filename;

    const doctor = await Doctor.findByIdAndUpdate(req.doctor._id, updates, { new: true });
    res.status(200).json({ success: true, data: { doctor } });
  } catch (err) { next(err); }
};

// ─── PUT /api/doctors/me/availability ────────────────────────
exports.toggleAvailability = async (req, res, next) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(
      req.doctor._id,
      { isAvailable: !req.doctor.isAvailable, lastSeenAt: new Date() },
      { new: true }
    );
    res.status(200).json({
      success: true,
      message: `You are now ${doctor.isAvailable ? "🟢 Online" : "🔴 Offline"}`,
      data: { isAvailable: doctor.isAvailable },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  DOCTOR DASHBOARD
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/doctors/me/dashboard ───────────────────────────
exports.getDoctorDashboard = async (req, res, next) => {
  try {
    const doctorId = req.doctor._id;

    const [
      totalConsultations,
      pendingConsultations,
      activeConsultations,
      closedConsultations,
      unreadResult,
      recentConsultations,
    ] = await Promise.all([
      Consultation.countDocuments({ doctor: doctorId }),
      Consultation.countDocuments({ doctor: doctorId, status: "pending" }),
      Consultation.countDocuments({ doctor: doctorId, status: "active" }),
      Consultation.countDocuments({ doctor: doctorId, status: "closed" }),
      Consultation.aggregate([
        { $match: { doctor: doctorId, status: { $in: ["pending", "active"] } } },
        { $group: { _id: null, total: { $sum: "$doctorUnreadCount" } } },
      ]),
      Consultation.find({ doctor: doctorId })
        .populate("user", "name avatar")
        .populate("medicine", "name")
        .select("-messages")
        .sort("-lastMessageAt -createdAt")
        .limit(5),
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          total:         totalConsultations,
          pending:       pendingConsultations,
          active:        activeConsultations,
          closed:        closedConsultations,
          unreadMessages: unreadResult[0]?.total || 0,
          rating:        req.doctor.rating,
        },
        recentConsultations,
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  DOCTOR CHAT
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/doctors/me/consultations ───────────────────────
// قايمة بكل المحادثات مع عدد الرسائل غير المقروءة
exports.getDoctorConsultations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { doctor: req.doctor._id };
    if (status) filter.status = status;

    const consultations = await Consultation.find(filter)
      .populate("user",     "name avatar phone email")
      .populate("medicine", "name nameAr images price")
      .select("-messages")
      .sort("-lastMessageAt -createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Consultation.countDocuments(filter);

    const unreadResult = await Consultation.aggregate([
      { $match: { doctor: req.doctor._id, status: { $in: ["pending", "active"] } } },
      { $group: { _id: null, total: { $sum: "$doctorUnreadCount" } } },
    ]);

    res.status(200).json({
      success:     true,
      count:       consultations.length,
      totalUnread: unreadResult[0]?.total || 0,
      pagination:  { total, page: Number(page), pages: Math.ceil(total / limit) },
      data:        { consultations },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/doctors/me/consultations/:id ───────────────────
// الدكتور يفتح المحادثة ويشوف كل الرسائل — بيعلّمها مقروءة تلقائياً
exports.getDoctorConsultationById = async (req, res, next) => {
  try {
    const consultation = await Consultation.findOne({
      _id:    req.params.id,
      doctor: req.doctor._id,
    })
      .populate("user",     "name avatar phone email")
      .populate("medicine", "name nameAr images price activeIngredient");

    if (!consultation)
      return res.status(404).json({ success: false, message: "Consultation not found." });

    // علّم رسائل الـ user كـ مقروءة
    let updated = false;
    consultation.messages.forEach((m) => {
      if (m.senderType === "user" && !m.isRead) {
        m.isRead = true;
        m.readAt = new Date();
        updated  = true;
      }
    });

    if (updated) {
      consultation.doctorUnreadCount = 0;
      await consultation.save();
    }

    res.status(200).json({ success: true, data: { consultation } });
  } catch (err) { next(err); }
};

// ─── POST /api/doctors/me/consultations/:id/reply ────────────
// الدكتور يرد على المستخدم + بيبعت email تلقائي
exports.replyToConsultation = async (req, res, next) => {
  try {
    const { text } = req.body;
    const attachment = req.file ? `/uploads/${req.file.filename}` : undefined;

    if (!text && !attachment)
      return res.status(400).json({ success: false, message: "Message text or attachment is required." });

    const consultation = await Consultation.findOne({
      _id:    req.params.id,
      doctor: req.doctor._id,
    });

    if (!consultation)
      return res.status(404).json({ success: false, message: "Consultation not found." });

    if (["closed", "cancelled"].includes(consultation.status))
      return res.status(400).json({ success: false, message: "This consultation is already closed." });

    // أضف الرسالة
    consultation.messages.push({
      senderType:     "doctor",
      senderId:       req.doctor._id,
      text:           text       || undefined,
      attachment:     attachment || undefined,
      attachmentType: req.file
        ? (req.file.mimetype.startsWith("image") ? "image" : "file")
        : undefined,
    });

    consultation.lastMessageAt   = new Date();
    consultation.lastMessageText = text || "📎 Attachment";
    consultation.userUnreadCount += 1;

    // أول رد من الدكتور → consultation تبقى active
    if (consultation.status === "pending")
      consultation.status = "active";

    await consultation.save();

    const newMessage = consultation.messages[consultation.messages.length - 1];
    emitToConsultation(consultation, "consultation:message", { message: newMessage, status: consultation.status });

    // ── In-app notification to patient ─────────────────────────
    try {
      const Notification = require("../models/Notification");
      const preview = text
        ? (text.length > 80 ? `${text.slice(0, 80)}...` : text)
        : "📎 Attachment";

      const title = `Dr. ${req.doctor.name} replied 💬`;
      await Notification.create({
        user:     consultation.user,
        title,
        message:  preview,
        type:     "consultation_update",
        refModel: "Consultation",
        refId:    consultation._id,
      });

      const { sendPushToUser } = require("../utils/pushNotification");
      await sendPushToUser(consultation.user, {
        title,
        body: preview,
        data: {
          type:           "consultation_update",
          refModel:       "Consultation",
          refId:          consultation._id.toString(),
          consultationId: consultation._id.toString(),
        },
      });
    } catch (notificationErr) {
      console.error("🔔 Reply notification failed:", notificationErr.message);
    }

    // ── إبعت email للمستخدم ────────────────────────────────
    try {
      const { sendEmail } = require("../utils/email");
      const User          = require("../models/User");
      const user          = await User.findById(consultation.user).select("name email");

      if (user?.email) {
        await sendEmail({
          to:      user.email,
          subject: `✅ Dr. ${req.doctor.name} replied to your consultation`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:0;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:24px;text-align:center;">
                <h2 style="color:white;margin:0;font-size:20px;">💊 DAWAYA Pharmacy</h2>
              </div>
              <div style="padding:28px;">
                <p style="color:#333;font-size:15px;">Hi <strong>${user.name}</strong>,</p>
                <p style="color:#555;font-size:14px;">
                  Dr. <strong>${req.doctor.name}</strong>
                  <span style="color:#888;">(${req.doctor.specialty})</span>
                  has replied to your consultation.
                </p>

                <div style="background:#f0fff4;border-left:4px solid #4caf50;border-radius:4px;padding:16px;margin:16px 0;">
                  <p style="color:#333;font-size:13px;margin:0 0 8px;font-weight:bold;">👨‍⚕️ Doctor's Reply:</p>
                  <p style="color:#555;font-size:14px;margin:0;">
                    ${text || "📎 Doctor sent an attachment."}
                  </p>
                </div>

                <div style="background:#f8f9ff;border-radius:8px;padding:12px;margin:12px 0;">
                  <p style="color:#666;font-size:13px;margin:0;">
                    📋 Consultation: <strong>${consultation.topic}</strong>
                  </p>
                </div>

                <div style="text-align:center;margin:24px 0;">
                  <a href="${process.env.FRONTEND_URL}/consultations/${consultation._id}"
                     style="background:#1a73e8;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
                    View & Reply
                  </a>
                </div>
                <p style="color:#999;font-size:12px;text-align:center;">
                  Open DAWAYA app to continue the conversation.
                </p>
              </div>
              <div style="background:#f5f5f5;padding:14px;text-align:center;border-top:1px solid #e0e0e0;">
                <p style="color:#aaa;font-size:12px;margin:0;">© ${new Date().getFullYear()} DAWAYA Pharmacy</p>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("📧 Reply email failed:", emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Reply sent successfully.",
      data:    { message: newMessage, consultationStatus: consultation.status },
    });
  } catch (err) { next(err); }
};

// ─── PUT /api/doctors/me/consultations/:id/close ─────────────
// الدكتور يقفل المحادثة
exports.closeDoctorConsultation = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const consultation = await Consultation.findOne({
      _id:    req.params.id,
      doctor: req.doctor._id,
    });

    if (!consultation)
      return res.status(404).json({ success: false, message: "Consultation not found." });

    if (consultation.status === "closed")
      return res.status(400).json({ success: false, message: "Already closed." });

    consultation.status      = "closed";
    consultation.closedAt    = new Date();
    consultation.closedBy    = "doctor";
    consultation.closeReason = reason || "Closed by doctor";
    await consultation.save();
    emitToConsultation(consultation, "consultation:updated", { status: consultation.status });

    await Doctor.findByIdAndUpdate(req.doctor._id, { $inc: { totalConsultations: 1 } });

    // إبعت email للمستخدم
    try {
      const { sendEmail } = require("../utils/email");
      const User          = require("../models/User");
      const user          = await User.findById(consultation.user).select("name email");
      if (user?.email) {
        await sendEmail({
          to:      user.email,
          subject: `Consultation Closed — Dr. ${req.doctor.name}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:8px;">
              <h2 style="color:#1a73e8;text-align:center;">💊 DAWAYA Pharmacy</h2>
              <p>Hi <strong>${user.name}</strong>,</p>
              <p>Your consultation with Dr. <strong>${req.doctor.name}</strong> has been closed.</p>
              <p style="color:#666;font-size:13px;">📋 Topic: <strong>${consultation.topic}</strong></p>
              <p style="color:#666;font-size:13px;">💬 Total messages: ${consultation.messages.length}</p>
              <p>You can start a new consultation anytime from the DAWAYA app.</p>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("📧 Close email failed:", emailErr.message);
    }

    res.status(200).json({ success: true, message: "Consultation closed.", data: { consultation } });
  } catch (err) { next(err); }
};
