const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      // User._id for patients, Doctor._id for doctors (shared inbox key)
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["order_update", "prescription_update", "consultation_update", "promo", "system"],
      default: "system",
    },
    refModel: { type: String, enum: ["Order", "Prescription", "Consultation", null] },
    refId:    { type: mongoose.Schema.Types.ObjectId },
    isRead:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
