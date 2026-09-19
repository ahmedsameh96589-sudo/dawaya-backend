const User = require("../models/User");

// ─── GET /api/users/me ─────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name email phone avatar role gender dateOfBirth language"
    );
    if (!user)
      return res.status(404).json({ success: false, message: "User not found." });

    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/users/me ─────────────────────────────────────────
exports.updateMe = async (req, res, next) => {
  try {
    const allowed = ["name", "email", "phone", "gender", "dateOfBirth", "language"];
    const updates = {};

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("name email phone avatar role gender dateOfBirth language");

    if (!user)
      return res.status(404).json({ success: false, message: "User not found." });

    res.status(200).json({ success: true, message: "Profile updated.", data: { user } });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email or phone already in use.",
      });
    }
    next(err);
  }
};
