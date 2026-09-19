const mongoose  = require("mongoose");
const Medicine  = require("./Medicine");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: 1,
      max: 5,
    },
    title:   { type: String, trim: true, maxlength: 100 },
    comment: { type: String, trim: true, maxlength: 1000 },
    isVerifiedPurchase: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One review per user per medicine
reviewSchema.index({ user: 1, medicine: 1 }, { unique: true });

// Recalculate medicine ratings after save / delete
reviewSchema.statics.calcAverageRatings = async function (medicineId) {
  const stats = await this.aggregate([
    { $match: { medicine: medicineId } },
    { $group: { _id: "$medicine", avgRating: { $avg: "$rating" }, nRating: { $sum: 1 } } },
  ]);

  if (stats.length > 0) {
    await Medicine.findByIdAndUpdate(medicineId, {
      "ratings.average": Math.round(stats[0].avgRating * 10) / 10,
      "ratings.count":   stats[0].nRating,
    });
  } else {
    await Medicine.findByIdAndUpdate(medicineId, { "ratings.average": 0, "ratings.count": 0 });
  }
};

reviewSchema.post("save", function () {
  this.constructor.calcAverageRatings(this.medicine);
});

reviewSchema.post("deleteOne", { document: true }, function () {
  this.constructor.calcAverageRatings(this.medicine);
});

module.exports = mongoose.model("Review", reviewSchema);
