const Consultation = require("../models/Consultation");
const Doctor       = require("../models/Doctor");
const Notification = require("../models/Notification");
const { sendEmail } = require("../utils/email");
const { sendPushToDoctor, sendPushToUser } = require("../utils/pushNotification");
const { validateRating, applyDoctorRating } = require("../utils/doctorRating");

// ─── Helper: email templates ──────────────────────────────────
const emailWrapper = (content) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:0;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:24px;text-align:center;">
      <h2 style="color:white;margin:0;font-size:20px;">💊 DAWAYA Pharmacy</h2>
    </div>
    <div style="padding:28px;">${content}</div>
    <div style="background:#f5f5f5;padding:14px;text-align:center;border-top:1px solid #e0e0e0;">
      <p style="color:#aaa;font-size:12px;margin:0;">© ${new Date().getFullYear()} DAWAYA Pharmacy. All rights reserved.</p>
    </div>
  </div>
`;

// ═══════════════════════════════════════════════════════════════
//  USER ACTIONS
// ═══════════════════════════════════════════════════════════════

// ─── POST /api/consultations ─────────────────────────────────
// User starts a new consultation with a doctor
exports.startConsultation = async (req, res, next) => {
  try {
    const { doctorId, topic, topicAr, medicineId } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.isActive)
      return res.status(404).json({ success: false, message: "Doctor not found." });

    if (!doctor.isAvailable)
      return res.status(400).json({ success: false, message: "This doctor is currently unavailable. Please try another doctor." });

    // Check if user already has an active consultation with this doctor
    const existing = await Consultation.findOne({
      user:   req.user._id,
      doctor: doctorId,
      status: { $in: ["pending", "active"] },
    });

    if (existing)
      return res.status(400).json({
        success: false,
        message: "You already have an active consultation with this doctor.",
        data: { consultationId: existing._id },
      });

    const consultation = await Consultation.create({
      user:     req.user._id,
      doctor:   doctorId,
      topic:    topic    || "General Consultation",
      topicAr:  topicAr  || "استشارة عامة",
      medicine: medicineId || undefined,
      doctorUnreadCount: 1,
    });

    await consultation.populate([
      { path: "doctor", select: "name nameAr avatar specialty isAvailable rating" },
      { path: "medicine", select: "name nameAr" },
    ]);

    // ── Notify doctor: In-app + Email ─────────────────────────
    await Notification.create({
      user:     doctor._id,
      title:    "New Consultation Request 💬",
      message:  `${req.user.name} is requesting a consultation: "${topic || "General Consultation"}"`,
      type:     "system",
    });

    try {
      await sendEmail({
        to:      doctor.email,
        subject: `💬 New Consultation Request — ${req.user.name}`,
        html: emailWrapper(`
          <p style="color:#333;font-size:15px;">Hi Dr. <strong>${doctor.name}</strong>,</p>
          <p style="color:#555;font-size:14px;">You have a new consultation request from a patient.</p>

          <div style="background:#f8f9ff;border-left:4px solid #1a73e8;border-radius:4px;padding:16px;margin:16px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">👤 Patient</td>
                <td style="color:#333;font-weight:bold;text-align:right;">${req.user.name}</td>
              </tr>
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">📋 Topic</td>
                <td style="color:#333;text-align:right;">${topic || "General Consultation"}</td>
              </tr>
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">🕐 Time</td>
                <td style="color:#333;text-align:right;">${new Date().toLocaleString("en-GB")}</td>
              </tr>
            </table>
          </div>

          <p style="color:#555;font-size:14px;">Please login to DAWAYA to respond to this consultation as soon as possible.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${process.env.FRONTEND_URL}/doctor/consultations" 
               style="background:#1a73e8;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
              View Consultation
            </a>
          </div>
        `),
      });
    } catch (emailErr) {
      console.error("📧 Doctor new consultation email failed:", emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Consultation started. Waiting for doctor to respond.",
      data: { consultation },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/consultations ───────────────────────────────────
// User: get my consultations
exports.getMyConsultations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const consultations = await Consultation.find(filter)
      .populate("doctor",   "name nameAr avatar specialty isAvailable rating")
      .populate("medicine", "name nameAr images")
      .select("-messages")     // don't load all messages in list view
      .sort("-lastMessageAt -createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Consultation.countDocuments(filter);

    res.status(200).json({
      success: true, count: consultations.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { consultations },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/consultations/:id ───────────────────────────────
// Get full chat history
exports.getConsultation = async (req, res, next) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .populate("doctor",   "name nameAr avatar specialty isAvailable rating")
      .populate("user",     "name avatar")
      .populate("medicine", "name nameAr price images");

    if (!consultation)
      return res.status(404).json({ success: false, message: "Consultation not found." });

    // Only user or doctor of this consultation can view it
    const isUser   = consultation.user._id.toString()   === req.user?._id.toString();
    const isDoctor = consultation.doctor._id.toString() === req.doctor?._id.toString();
    if (!isUser && !isDoctor && req.user?.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized." });

    // Mark messages as read
    if (isUser) {
      consultation.messages.forEach((m) => {
        if (m.senderType === "doctor" && !m.isRead) { m.isRead = true; m.readAt = new Date(); }
      });
      consultation.userUnreadCount = 0;
      await consultation.save();
    } else if (isDoctor) {
      consultation.messages.forEach((m) => {
        if (m.senderType === "user" && !m.isRead) { m.isRead = true; m.readAt = new Date(); }
      });
      consultation.doctorUnreadCount = 0;
      await consultation.save();
    }

    res.status(200).json({ success: true, data: { consultation } });
  } catch (err) { next(err); }
};

// ─── POST /api/consultations/:id/messages ────────────────────
// Send a message (works for both user and doctor)
exports.sendMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    const attachment = req.file ? `/uploads/${req.file.filename}` : undefined;

    if (!text && !attachment)
      return res.status(400).json({ success: false, message: "Message text or attachment is required." });

    const consultation = await Consultation.findById(req.params.id);
    if (!consultation)
      return res.status(404).json({ success: false, message: "Consultation not found." });

    if (consultation.status === "closed" || consultation.status === "cancelled")
      return res.status(400).json({ success: false, message: "This consultation is closed." });

    // Determine sender
    let senderType, senderId;
    if (req.user && consultation.user.toString() === req.user._id.toString()) {
      senderType = "user";
      senderId   = req.user._id;
    } else if (req.doctor && consultation.doctor.toString() === req.doctor._id.toString()) {
      senderType = "doctor";
      senderId   = req.doctor._id;
    } else {
      return res.status(403).json({ success: false, message: "Not authorized." });
    }

    // Add message
    const message = {
      senderType,
      senderId,
      text:       text || undefined,
      attachment: attachment || undefined,
      attachmentType: req.file ? (req.file.mimetype.startsWith("image") ? "image" : "file") : undefined,
    };

    consultation.messages.push(message);
    consultation.lastMessageAt  = new Date();
    consultation.lastMessageText = text || "📎 Attachment";

    // Activate if pending
    if (consultation.status === "pending" && senderType === "doctor")
      consultation.status = "active";

    // Increment unread count for the OTHER party
    if (senderType === "user")    consultation.doctorUnreadCount += 1;
    if (senderType === "doctor")  consultation.userUnreadCount   += 1;

    await consultation.save();

    const newMessage = consultation.messages[consultation.messages.length - 1];

    // ── In-app notification to the OTHER party ─────────────────
    try {
      const preview = text
        ? (text.length > 80 ? `${text.slice(0, 80)}...` : text)
        : "📎 Attachment";

      const pushData = {
        type:             "consultation_update",
        refModel:         "Consultation",
        refId:            consultation._id.toString(),
        consultationId:   consultation._id.toString(),
      };

      if (senderType === "user") {
        const title = `New Message from ${req.user.name} 💬`;
        await Notification.create({
          user:     consultation.doctor,
          title,
          message:  preview,
          type:     "consultation_update",
          refModel: "Consultation",
          refId:    consultation._id,
        });
        await sendPushToDoctor(consultation.doctor, { title, body: preview, data: pushData });
      } else {
        const title = `Dr. ${req.doctor.name} replied 💬`;
        await Notification.create({
          user:     consultation.user,
          title,
          message:  preview,
          type:     "consultation_update",
          refModel: "Consultation",
          refId:    consultation._id,
        });
        await sendPushToUser(consultation.user, { title, body: preview, data: pushData });
      }
    } catch (notificationErr) {
      console.error("🔔 Chat notification failed:", notificationErr.message);
    }

    // ── Email notification to the OTHER party ─────────────────
    try {
      if (senderType === "user") {
        // المستخدم بعت رسالة → ابعت email للدكتور
        const doctor = await Doctor.findById(consultation.doctor).select("name email");
        const user   = req.user;

        await sendEmail({
          to:      doctor.email,
          subject: `💬 New Message from ${user.name}`,
          html: emailWrapper(`
            <p style="color:#333;font-size:15px;">Hi Dr. <strong>${doctor.name}</strong>,</p>
            <p style="color:#555;font-size:14px;">You have a new message from your patient.</p>

            <div style="background:#f8f9ff;border-left:4px solid #1a73e8;border-radius:4px;padding:16px;margin:16px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#666;font-size:13px;padding:4px 0;">👤 Patient</td>
                  <td style="color:#333;font-weight:bold;text-align:right;">${user.name}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;padding:4px 0;">📋 Topic</td>
                  <td style="color:#333;text-align:right;">${consultation.topic}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;padding:4px 0;">🕐 Time</td>
                  <td style="color:#333;text-align:right;">${new Date().toLocaleString("en-GB")}</td>
                </tr>
              </table>
            </div>

            ${text ? `
            <div style="background:#f0f4ff;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="color:#333;font-size:14px;margin:0;font-style:italic;">"${text}"</p>
            </div>` : `<p style="color:#555;font-size:14px;">📎 Patient sent an attachment.</p>`}

            <div style="text-align:center;margin:24px 0;">
              <a href="${process.env.FRONTEND_URL}/doctor/consultations/${consultation._id}"
                 style="background:#1a73e8;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
                Reply Now
              </a>
            </div>
            <p style="color:#999;font-size:12px;text-align:center;">Your patient is waiting for your response.</p>
          `),
        });

      } else {
        // الدكتور رد → ابعت email للمستخدم
        const User   = require("../models/User");
        const user   = await User.findById(consultation.user).select("name email");
        const doctor = req.doctor;

        await sendEmail({
          to:      user.email,
          subject: `✅ Dr. ${doctor.name} replied to your consultation`,
          html: emailWrapper(`
            <p style="color:#333;font-size:15px;">Hi <strong>${user.name}</strong>,</p>
            <p style="color:#555;font-size:14px;">Your doctor has replied to your consultation.</p>

            <div style="background:#f8f9ff;border-left:4px solid #1a73e8;border-radius:4px;padding:16px;margin:16px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#666;font-size:13px;padding:4px 0;">👨‍⚕️ Doctor</td>
                  <td style="color:#333;font-weight:bold;text-align:right;">Dr. ${doctor.name}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;padding:4px 0;">🏥 Specialty</td>
                  <td style="color:#333;text-align:right;">${doctor.specialty}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;padding:4px 0;">📋 Topic</td>
                  <td style="color:#333;text-align:right;">${consultation.topic}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;padding:4px 0;">🕐 Time</td>
                  <td style="color:#333;text-align:right;">${new Date().toLocaleString("en-GB")}</td>
                </tr>
              </table>
            </div>

            ${text ? `
            <div style="background:#f0fff4;border-left:4px solid #4caf50;border-radius:4px;padding:16px;margin:16px 0;">
              <p style="color:#333;font-size:14px;margin:0 0 6px;font-weight:bold;">Doctor's Reply:</p>
              <p style="color:#555;font-size:14px;margin:0;font-style:italic;">"${text}"</p>
            </div>` : `<p style="color:#555;font-size:14px;">📎 Doctor sent an attachment.</p>`}

            <div style="text-align:center;margin:24px 0;">
              <a href="${process.env.FRONTEND_URL}/consultations/${consultation._id}"
                 style="background:#1a73e8;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
                View Full Conversation
              </a>
            </div>
          `),
        });
      }
    } catch (emailErr) {
      console.error("📧 Chat notification email failed:", emailErr.message);
    }

    res.status(201).json({
      success: true,
      data: { message: newMessage },
    });
  } catch (err) { next(err); }
};

// ─── PUT /api/consultations/:id/close ────────────────────────
// User closes consultation + optionally rates the doctor
exports.closeConsultation = async (req, res, next) => {
  try {
    const { reason, rating, comment } = req.body;

    const consultation = await Consultation.findById(req.params.id);
    if (!consultation)
      return res.status(404).json({ success: false, message: "Consultation not found." });

    const isUser   = req.user   && consultation.user.toString()   === req.user._id.toString();
    const isDoctor = req.doctor && consultation.doctor.toString() === req.doctor._id.toString();
    if (!isUser && !isDoctor)
      return res.status(403).json({ success: false, message: "Not authorized." });

    consultation.status    = "closed";
    consultation.closedAt  = new Date();
    consultation.closedBy  = isUser ? "user" : "doctor";
    consultation.closeReason = reason || "Consultation ended";

    // Save user rating
    if (isUser && rating) {
      if (!validateRating(rating))
        return res.status(400).json({ success: false, message: "Rating must be an integer between 1 and 5." });

      consultation.userRating = { rating, comment, ratedAt: new Date() };

      const doctor = await Doctor.findById(consultation.doctor);
      applyDoctorRating(doctor, Number(rating));
      await doctor.save();
    }

    // Increment doctor's consultation count
    await Doctor.findByIdAndUpdate(consultation.doctor, { $inc: { totalConsultations: 1 } });

    await consultation.save();

    await consultation.populate([
      { path: "doctor", select: "name nameAr avatar specialty isAvailable rating" },
      { path: "user", select: "name avatar" },
    ]);

    // ── Email both parties on close ───────────────────────────
    try {
      const User   = require("../models/User");
      const user   = await User.findById(consultation.user).select("name email");
      const doctor = await Doctor.findById(consultation.doctor).select("name email specialty");

      // Email to user
      await sendEmail({
        to:      user.email,
        subject: `✅ Consultation Closed — Dr. ${doctor.name}`,
        html: emailWrapper(`
          <p style="color:#333;font-size:15px;">Hi <strong>${user.name}</strong>,</p>
          <p style="color:#555;font-size:14px;">Your consultation with Dr. <strong>${doctor.name}</strong> has been closed.</p>

          <div style="background:#f8f9ff;border-left:4px solid #1a73e8;border-radius:4px;padding:16px;margin:16px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">👨‍⚕️ Doctor</td>
                <td style="color:#333;font-weight:bold;text-align:right;">Dr. ${doctor.name}</td>
              </tr>
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">📋 Topic</td>
                <td style="color:#333;text-align:right;">${consultation.topic}</td>
              </tr>
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">💬 Messages</td>
                <td style="color:#333;text-align:right;">${consultation.messages.length} messages</td>
              </tr>
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">🕐 Closed At</td>
                <td style="color:#333;text-align:right;">${new Date().toLocaleString("en-GB")}</td>
              </tr>
            </table>
          </div>

          <p style="color:#555;font-size:14px;">We hope your consultation was helpful. You can start a new consultation anytime!</p>
        `),
      });

      // Email to doctor
      await sendEmail({
        to:      doctor.email,
        subject: `Consultation Closed — ${user.name}`,
        html: emailWrapper(`
          <p style="color:#333;font-size:15px;">Hi Dr. <strong>${doctor.name}</strong>,</p>
          <p style="color:#555;font-size:14px;">Your consultation with <strong>${user.name}</strong> has been closed.</p>

          <div style="background:#f8f9ff;border-left:4px solid #1a73e8;border-radius:4px;padding:16px;margin:16px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">👤 Patient</td>
                <td style="color:#333;font-weight:bold;text-align:right;">${user.name}</td>
              </tr>
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">📋 Topic</td>
                <td style="color:#333;text-align:right;">${consultation.topic}</td>
              </tr>
              ${consultation.userRating?.rating ? `
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">⭐ Rating</td>
                <td style="color:#f59e0b;font-weight:bold;text-align:right;">${"★".repeat(consultation.userRating.rating)}${"☆".repeat(5 - consultation.userRating.rating)} (${consultation.userRating.rating}/5)</td>
              </tr>
              ${consultation.userRating.comment ? `
              <tr>
                <td style="color:#666;font-size:13px;padding:4px 0;">💬 Comment</td>
                <td style="color:#333;text-align:right;font-style:italic;">"${consultation.userRating.comment}"</td>
              </tr>` : ""}` : ""}
            </table>
          </div>
          <p style="color:#555;font-size:14px;">Thank you for helping our patients. Your total consultations: <strong>${(await Doctor.findById(doctor._id)).totalConsultations}</strong></p>
        `),
      });
    } catch (emailErr) {
      console.error("📧 Consultation close email failed:", emailErr.message);
    }

    res.status(200).json({ success: true, message: "Consultation closed.", data: { consultation } });
  } catch (err) { next(err); }
};

// ─── PUT /api/consultations/:id/rate ─────────────────────────
// Patient rates doctor after consultation is closed
exports.rateConsultation = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    if (!validateRating(rating))
      return res.status(400).json({ success: false, message: "Rating must be an integer between 1 and 5." });

    const consultation = await Consultation.findById(req.params.id);
    if (!consultation)
      return res.status(404).json({ success: false, message: "Consultation not found." });

    if (!req.user || consultation.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Only the patient can rate this consultation." });

    if (consultation.status !== "closed")
      return res.status(400).json({ success: false, message: "You can only rate closed consultations." });

    if (consultation.userRating?.rating)
      return res.status(400).json({ success: false, message: "This consultation has already been rated." });

    consultation.userRating = { rating, comment, ratedAt: new Date() };
    await consultation.save();

    const doctor = await Doctor.findById(consultation.doctor);
    applyDoctorRating(doctor, Number(rating));
    await doctor.save();

    await consultation.populate([
      { path: "doctor", select: "name nameAr avatar specialty isAvailable rating" },
      { path: "user", select: "name avatar" },
    ]);

    res.status(200).json({ success: true, message: "Thank you for your rating.", data: { consultation } });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  DOCTOR ACTIONS
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/doctors/consultations ──────────────────────────
exports.getDoctorConsultations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { doctor: req.doctor._id };
    if (status) filter.status = status;

    const consultations = await Consultation.find(filter)
      .populate("user",     "name avatar phone")
      .populate("medicine", "name nameAr")
      .select("-messages")
      .sort("-lastMessageAt -createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Consultation.countDocuments(filter);

    res.status(200).json({
      success: true, count: consultations.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { consultations },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  ADMIN ACTIONS
// ═══════════════════════════════════════════════════════════════

exports.getAllConsultations = async (req, res, next) => {
  try {
    const { status, doctorId, userId, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)   filter.status = status;
    if (doctorId) filter.doctor = doctorId;
    if (userId)   filter.user   = userId;

    const consultations = await Consultation.find(filter)
      .populate("user",   "name email")
      .populate("doctor", "name specialty")
      .select("-messages")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Consultation.countDocuments(filter);

    res.status(200).json({
      success: true, count: consultations.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { consultations },
    });
  } catch (err) { next(err); }
};
