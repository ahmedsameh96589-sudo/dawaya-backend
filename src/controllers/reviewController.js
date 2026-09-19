const Review   = require("../models/Review");
const Order    = require("../models/Order");
const Medicine = require("../models/Medicine");

// ─── GET /api/medicines/:medicineId/reviews ───────────────────
exports.getMedicineReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sort = "-createdAt" } = req.query;

    const reviews = await Review.find({ medicine: req.params.medicineId })
      .populate("user", "name avatar")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Review.countDocuments({ medicine: req.params.medicineId });

    // Rating distribution
    const distribution = await Review.aggregate([
      { $match: { medicine: require("mongoose").Types.ObjectId.createFromHexString(req.params.medicineId) } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    res.status(200).json({
      success: true,
      count: reviews.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { reviews, distribution },
    });
  } catch (err) { next(err); }
};

// ─── POST /api/medicines/:medicineId/reviews ──────────────────
exports.createReview = async (req, res, next) => {
  try {
    const { medicineId } = req.params;
    const { rating, title, comment } = req.body;

    // Check medicine exists
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found." });

    // Check for existing review
    const existing = await Review.findOne({ user: req.user._id, medicine: medicineId });
    if (existing)
      return res.status(400).json({ success: false, message: "You have already reviewed this medicine." });

    // Check if user purchased this medicine (verified purchase)
    const purchased = await Order.findOne({
      user: req.user._id,
      "items.medicine": medicineId,
      status: "delivered",
    });

    const review = await Review.create({
      user: req.user._id,
      medicine: medicineId,
      rating,
      title,
      comment,
      isVerifiedPurchase: !!purchased,
    });

    await review.populate("user", "name avatar");

    res.status(201).json({ success: true, data: { review } });
  } catch (err) { next(err); }
};

// ─── PUT /api/reviews/:id ─────────────────────────────────────
exports.updateReview = async (req, res, next) => {
  try {
    const { rating, title, comment } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) return res.status(404).json({ success: false, message: "Review not found." });
    if (review.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Not authorized to edit this review." });

    review.rating  = rating  || review.rating;
    review.title   = title   || review.title;
    review.comment = comment || review.comment;
    await review.save();

    res.status(200).json({ success: true, data: { review } });
  } catch (err) { next(err); }
};

// ─── DELETE /api/reviews/:id ──────────────────────────────────
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: "Review not found." });

    const isOwner = review.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin)
      return res.status(403).json({ success: false, message: "Not authorized." });

    await review.deleteOne();
    res.status(200).json({ success: true, message: "Review deleted." });
  } catch (err) { next(err); }
};

// ─── GET /api/reviews/my ─────────────────────────────────────
exports.getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .populate("medicine", "name images")
      .sort("-createdAt");
    res.status(200).json({ success: true, count: reviews.length, data: { reviews } });
  } catch (err) { next(err); }
};
