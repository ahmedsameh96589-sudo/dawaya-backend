const mongoose = require("mongoose");

// Stores each time a user looked up substitutes for a medicine
const substituteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The medicine the user searched for
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
    },

    // The substitutes returned for that search
    substitutes: [
      {
        medicine: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Medicine",
        },
        matchReason: {
          type: String,
          enum: ["same_active_ingredient", "same_subcategory", "same_category"],
        },
        priceDifference: Number,   // substitute price - original price (negative = cheaper)
      },
    ],
  },
  { timestamps: true }
);

// Index for fast user history lookup
substituteSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Substitute", substituteSchema);
