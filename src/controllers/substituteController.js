const Medicine   = require("../models/Medicine");
const Substitute = require("../models/Substitute");

// ═══════════════════════════════════════════════════════════════
//  POST /api/substitutes
//  User selects a medicine → get its substitutes
//  Body: { medicineId }
// ═══════════════════════════════════════════════════════════════
exports.getSubstitutes = async (req, res, next) => {
  try {
    const { medicineId } = req.body;

    if (!medicineId)
      return res.status(400).json({ success: false, message: "medicineId is required." });

    // Load the original medicine
    const original = await Medicine.findById(medicineId)
      .populate("category",    "name nameAr")
      .populate("subcategory", "name nameAr")
      .populate("brand",       "name nameAr logo");

    if (!original || !original.isActive)
      return res.status(404).json({ success: false, message: "Medicine not found." });

    // ── Build substitute candidates ───────────────────────────
    const substitutesMap = new Map(); // medicineId → { medicine, matchReason }

    // Priority 1: Same active ingredient (strongest match)
    if (original.activeIngredient) {
      const byIngredient = await Medicine.find({
        _id:             { $ne: original._id },
        isActive:        true,
        stock:           { $gt: 0 },
        activeIngredient: { $regex: original.activeIngredient, $options: "i" },
      })
        .populate("brand",       "name logo")
        .populate("category",    "name nameAr")
        .populate("subcategory", "name nameAr")
        .sort({ price: 1 })
        .limit(10);

      byIngredient.forEach((med) => {
        if (!substitutesMap.has(med._id.toString())) {
          substitutesMap.set(med._id.toString(), {
            medicine:    med,
            matchReason: "same_active_ingredient",
            priceDifference: parseFloat((med.finalPrice - original.finalPrice).toFixed(2)),
          });
        }
      });
    }

    // Priority 2: Same subcategory
    if (original.subcategory && substitutesMap.size < 8) {
      const bySubcategory = await Medicine.find({
        _id:         { $ne: original._id },
        isActive:    true,
        stock:       { $gt: 0 },
        subcategory: original.subcategory._id || original.subcategory,
      })
        .populate("brand",       "name logo")
        .populate("category",    "name nameAr")
        .populate("subcategory", "name nameAr")
        .sort({ price: 1 })
        .limit(10);

      bySubcategory.forEach((med) => {
        if (!substitutesMap.has(med._id.toString())) {
          substitutesMap.set(med._id.toString(), {
            medicine:    med,
            matchReason: "same_subcategory",
            priceDifference: parseFloat((med.finalPrice - original.finalPrice).toFixed(2)),
          });
        }
      });
    }

    // Priority 3: Same category (widest fallback)
    if (original.category && substitutesMap.size < 5) {
      const byCategory = await Medicine.find({
        _id:      { $ne: original._id },
        isActive: true,
        stock:    { $gt: 0 },
        category: original.category._id || original.category,
      })
        .populate("brand",       "name logo")
        .populate("category",    "name nameAr")
        .populate("subcategory", "name nameAr")
        .sort({ price: 1 })
        .limit(10);

      byCategory.forEach((med) => {
        if (!substitutesMap.has(med._id.toString())) {
          substitutesMap.set(med._id.toString(), {
            medicine:    med,
            matchReason: "same_category",
            priceDifference: parseFloat((med.finalPrice - original.finalPrice).toFixed(2)),
          });
        }
      });
    }

    // Sort: cheaper alternatives first, then same price, then more expensive
    const substitutes = Array.from(substitutesMap.values())
      .sort((a, b) => a.priceDifference - b.priceDifference)
      .slice(0, 10);

    // ── Save search to history (if user is logged in) ─────────
    if (req.user) {
      await Substitute.create({
        user:     req.user._id,
        medicine: original._id,
        substitutes: substitutes.map((s) => ({
          medicine:        s.medicine._id,
          matchReason:     s.matchReason,
          priceDifference: s.priceDifference,
        })),
      });
    }

    // ── Response ──────────────────────────────────────────────
    res.status(200).json({
      success: true,
      data: {
        original,
        substitutes,
        summary: {
          total:               substitutes.length,
          cheaperCount:        substitutes.filter((s) => s.priceDifference < 0).length,
          sameActiveIngredient: substitutes.filter((s) => s.matchReason === "same_active_ingredient").length,
        },
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/substitutes/history
//  Get user's substitute search history
// ═══════════════════════════════════════════════════════════════
exports.getHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const history = await Substitute.find({ user: req.user._id })
      .populate("medicine", "name nameAr images price finalPrice activeIngredient brand")
      .populate("medicine.brand", "name logo")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Substitute.countDocuments({ user: req.user._id });

    res.status(200).json({
      success: true,
      count: history.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { history },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  DELETE /api/substitutes/history
//  Clear user's history
// ═══════════════════════════════════════════════════════════════
exports.clearHistory = async (req, res, next) => {
  try {
    await Substitute.deleteMany({ user: req.user._id });
    res.status(200).json({ success: true, message: "Substitute history cleared." });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/substitutes/search?name=panadol
//  Search medicine by name first (before selecting it)
// ═══════════════════════════════════════════════════════════════
exports.searchMedicine = async (req, res, next) => {
  try {
    const { name } = req.query;

    if (!name || name.trim().length < 2)
      return res.status(400).json({ success: false, message: "Please enter at least 2 characters." });

    const medicines = await Medicine.find({
      isActive: true,
      $or: [
        { name:             { $regex: name, $options: "i" } },
        { nameAr:           { $regex: name, $options: "i" } },
        { activeIngredient: { $regex: name, $options: "i" } },
      ],
    })
      .populate("brand",    "name logo")
      .populate("category", "name nameAr")
      .select("name nameAr images price finalPrice discountPercent stock activeIngredient dosageForm strength brand category inStock")
      .limit(15);

    res.status(200).json({
      success: true,
      count: medicines.length,
      data: { medicines },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/substitutes/medicine/:id
//  Quick substitutes by medicine ID (no auth required, no history saved)
// ═══════════════════════════════════════════════════════════════
exports.getSubstitutesByMedicineId = async (req, res, next) => {
  try {
    const original = await Medicine.findById(req.params.id)
      .populate("category",    "name nameAr")
      .populate("subcategory", "name nameAr")
      .populate("brand",       "name nameAr logo");

    if (!original || !original.isActive)
      return res.status(404).json({ success: false, message: "Medicine not found." });

    const substitutes = await Medicine.find({
      _id:      { $ne: original._id },
      isActive: true,
      stock:    { $gt: 0 },
      $or: [
        { activeIngredient: { $regex: original.activeIngredient || "NONE", $options: "i" } },
        { subcategory:      original.subcategory?._id || original.subcategory },
        { category:         original.category?._id   || original.category },
      ],
    })
      .populate("brand",       "name logo")
      .populate("category",    "name nameAr")
      .populate("subcategory", "name nameAr")
      .sort({ price: 1 })
      .limit(10);

    res.status(200).json({
      success: true,
      count: substitutes.length,
      data: { original, substitutes },
    });
  } catch (err) { next(err); }
};
