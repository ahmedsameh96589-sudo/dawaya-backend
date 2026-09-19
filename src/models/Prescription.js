const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    imageUrl: { type: String, required: true },

    // OCR extracted medicine names (raw text from scanner)
    extractedItems: [
      {
        rawText:         { type: String },
        matchedMedicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" },
        confidence:      { type: Number, min: 0, max: 1, default: 0 },
      },
    ],

    // Linked order (after checkout)
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },

    status: {
      type: String,
      enum: ["pending_review", "approved", "rejected"],
      default: "pending_review",
    },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNote: { type: String },
    reviewedAt: { type: Date },

    expiryDate: { type: Date },
    doctorName: { type: String },
    notes:      { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prescription", prescriptionSchema);
