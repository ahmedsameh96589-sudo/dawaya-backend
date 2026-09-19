const mongoose = require("mongoose");

// ─── Single message inside a consultation ─────────────────────
const messageSchema = new mongoose.Schema(
  {
    senderType: { type: String, enum: ["user", "doctor"], required: true },
    senderId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    text:       { type: String, trim: true },
    attachment: { type: String },           // image / file url
    attachmentType: { type: String, enum: ["image", "file", "prescription"] },
    isRead:     { type: Boolean, default: false },
    readAt:     { type: Date },
  },
  { timestamps: true }
);

// ─── Consultation (Chat room between one user and one doctor) ──
const consultationSchema = new mongoose.Schema(
  {
    user:   { type: mongoose.Schema.Types.ObjectId, ref: "User",   required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },

    status: {
      type: String,
      enum: ["pending", "active", "closed", "cancelled"],
      default: "pending",
    },

    topic:   { type: String, trim: true },    // e.g. "Ask about Panadol dosage"
    topicAr: { type: String, trim: true },

    // Linked medicine (optional — user asking about a specific med)
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" },

    messages: [messageSchema],

    // Summary stats
    userUnreadCount:   { type: Number, default: 0 },
    doctorUnreadCount: { type: Number, default: 0 },
    lastMessageAt:     { type: Date },
    lastMessageText:   { type: String },

    closedAt:    { type: Date },
    closedBy:    { type: String, enum: ["user", "doctor", "admin", "system"] },
    closeReason: { type: String },

    // Rating left by user after closing
    userRating: {
      rating:  { type: Number, min: 1, max: 5 },
      comment: { type: String },
      ratedAt: { type: Date },
    },
  },
  { timestamps: true }
);

consultationSchema.index({ user: 1, status: 1 });
consultationSchema.index({ doctor: 1, status: 1 });

module.exports = mongoose.model("Consultation", consultationSchema);
