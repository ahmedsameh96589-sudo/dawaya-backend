const Medicine    = require("../models/Medicine");
const ApiFeatures = require("../utils/apiFeatures");

// ─── GET /api/medicines ───────────────────────────────────────
exports.getMedicines = async (req, res, next) => {
  try {
    const base = Medicine.find({ isActive: true })
      .populate("category",    "name nameAr slug")
      .populate("subcategory", "name nameAr slug")
      .populate("brand",       "name nameAr logo");

    const features  = new ApiFeatures(base, req.query)
      .search(["name", "nameAr", "activeIngredient", "subtitle"])
      .filter().sort().limitFields().paginate(12);

    const medicines = await features.query;
    const total     = await Medicine.countDocuments({ isActive: true });

    res.status(200).json({
      success: true, count: medicines.length,
      pagination: { total, page: features.page, limit: features.limit, pages: Math.ceil(total / features.limit) },
      data: { medicines },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/medicines/featured ─────────────────────────────
exports.getFeaturedMedicines = async (req, res, next) => {
  try {
    const medicines = await Medicine.find({ isActive: true, isFeatured: true })
      .populate("brand", "name logo").limit(12);
    res.status(200).json({ success: true, count: medicines.length, data: { medicines } });
  } catch (err) { next(err); }
};

// ─── GET /api/medicines/:id ───────────────────────────────────
exports.getMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id)
      .populate("category",    "name nameAr slug")
      .populate("subcategory", "name nameAr slug")
      .populate("brand",       "name nameAr logo country")
      .populate("manualAlternatives.medicine", "name nameAr subtitle subtitleAr price discountPercent images stock brand ratings");

    if (!medicine || !medicine.isActive)
      return res.status(404).json({ success: false, message: "Medicine not found." });

    res.status(200).json({ success: true, data: { medicine } });
  } catch (err) { next(err); }
};

// ─── GET /api/medicines/:id/alternatives ─────────────────────
// Returns: manualAlternatives first (admin-pinned),
//          then auto-detected by: activeIngredient, subcategory,
//          category, similar price range — scored & sorted
exports.getAlternatives = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id)
      .populate("manualAlternatives.medicine", "name nameAr subtitle subtitleAr price discountPercent images stock brand isActive");

    if (!medicine || !medicine.isActive)
      return res.status(404).json({ success: false, message: "Medicine not found." });

    // ── 1. Manual alternatives (admin-pinned) ─────────────────
    const manualIds = medicine.manualAlternatives
      .filter((a) => a.medicine?.isActive !== false)
      .map((a) => ({ ...a.medicine.toObject(), _matchReason: "manual", _note: a.note, _noteAr: a.noteAr, _score: 100 }));

    const excludeIds = [medicine._id, ...medicine.manualAlternatives.map((a) => a.medicine?._id).filter(Boolean)];

    // ── 2. Auto-detected alternatives ────────────────────────
    // Build OR conditions with scoring weights
    const orConditions = [];

    if (medicine.activeIngredient)
      orConditions.push({ activeIngredient: { $regex: `^${medicine.activeIngredient}$`, $options: "i" } });

    if (medicine.subcategory)
      orConditions.push({ subcategory: medicine.subcategory });

    if (medicine.category)
      orConditions.push({ category: medicine.category });

    // Similar price: within ±50%
    const priceMin = medicine.price * 0.5;
    const priceMax = medicine.price * 1.5;
    orConditions.push({ price: { $gte: priceMin, $lte: priceMax } });

    if (medicine.brand)
      orConditions.push({ brand: medicine.brand });

    let autoAlternatives = [];
    if (orConditions.length > 0) {
      autoAlternatives = await Medicine.find({
        _id:      { $nin: excludeIds },
        isActive: true,
        $or:      orConditions,
      })
        .populate("brand", "name logo")
        .populate("category", "name nameAr")
        .populate("subcategory", "name nameAr")
        .limit(20);
    }

    // ── 3. Score each auto alternative ───────────────────────
    const scored = autoAlternatives.map((alt) => {
      let score = 0;
      const reasons = [];

      if (
        medicine.activeIngredient &&
        alt.activeIngredient?.toLowerCase() === medicine.activeIngredient.toLowerCase()
      ) { score += 50; reasons.push("same_ingredient"); }

      if (medicine.subcategory && alt.subcategory?._id?.toString() === medicine.subcategory?.toString())
        { score += 25; reasons.push("same_subcategory"); }

      if (medicine.category && alt.category?._id?.toString() === medicine.category?.toString())
        { score += 15; reasons.push("same_category"); }

      if (medicine.brand && alt.brand?._id?.toString() === medicine.brand?.toString())
        { score += 10; reasons.push("same_brand"); }

      const priceDiff = Math.abs(alt.price - medicine.price) / medicine.price;
      if (priceDiff <= 0.2)       { score += 10; reasons.push("similar_price"); }
      else if (priceDiff <= 0.5)  { score += 5;  reasons.push("close_price");   }

      // Bonus: in stock
      if (alt.stock > 0) score += 5;

      return { ...alt.toObject(), _score: score, _matchReasons: reasons };
    });

    // Sort by score desc, then price asc
    scored.sort((a, b) => b._score - a._score || a.price - b.price);

    // ── 4. Combine manual + auto ──────────────────────────────
    const allAlternatives = [...manualIds, ...scored.slice(0, 10)];

    res.status(200).json({
      success: true,
      count:   allAlternatives.length,
      meta: {
        requestedMedicine: medicine.name,
        inStock:           medicine.stock > 0,
        totalManual:       manualIds.length,
        totalAuto:         scored.length,
      },
      data: { alternatives: allAlternatives },
    });
  } catch (err) { next(err); }
};

// ─── ADMIN: POST /api/medicines/:id/alternatives ─────────────
// Body: { medicineId, note, noteAr }  — add a manual alternative
exports.addManualAlternative = async (req, res, next) => {
  try {
    const { medicineId, note, noteAr } = req.body;

    if (medicineId === req.params.id)
      return res.status(400).json({ success: false, message: "A medicine cannot be its own alternative." });

    const [medicine, altMedicine] = await Promise.all([
      Medicine.findById(req.params.id),
      Medicine.findById(medicineId),
    ]);

    if (!medicine)    return res.status(404).json({ success: false, message: "Medicine not found." });
    if (!altMedicine) return res.status(404).json({ success: false, message: "Alternative medicine not found." });

    // Prevent duplicates
    const alreadyLinked = medicine.manualAlternatives.some(
      (a) => a.medicine.toString() === medicineId
    );
    if (alreadyLinked)
      return res.status(400).json({ success: false, message: "This alternative is already linked." });

    medicine.manualAlternatives.push({ medicine: medicineId, note, noteAr });
    await medicine.save();

    await medicine.populate("manualAlternatives.medicine", "name nameAr subtitle price images stock");

    res.status(200).json({
      success: true,
      message: `${altMedicine.name} added as alternative for ${medicine.name}.`,
      data:    { manualAlternatives: medicine.manualAlternatives },
    });
  } catch (err) { next(err); }
};

// ─── ADMIN: DELETE /api/medicines/:id/alternatives/:altId ────
exports.removeManualAlternative = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found." });

    const before = medicine.manualAlternatives.length;
    medicine.manualAlternatives = medicine.manualAlternatives.filter(
      (a) => a.medicine.toString() !== req.params.altId
    );

    if (medicine.manualAlternatives.length === before)
      return res.status(404).json({ success: false, message: "Alternative not found." });

    await medicine.save();
    res.status(200).json({
      success: true,
      message: "Alternative removed.",
      data:    { manualAlternatives: medicine.manualAlternatives },
    });
  } catch (err) { next(err); }
};

// ─── ADMIN: GET /api/medicines/:id/alternatives/manual ───────
exports.getManualAlternatives = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id)
      .populate("manualAlternatives.medicine", "name nameAr subtitle subtitleAr price discountPercent images stock isActive brand");
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found." });
    res.status(200).json({
      success: true,
      count:   medicine.manualAlternatives.length,
      data:    { manualAlternatives: medicine.manualAlternatives },
    });
  } catch (err) { next(err); }
};

// ─── CREATE ───────────────────────────────────────────────────
exports.createMedicine = async (req, res, next) => {
  try {
    if (req.files?.length) req.body.images = req.files.map((f) => f.filename);
    const medicine = await Medicine.create(req.body);
    res.status(201).json({ success: true, data: { medicine } });
  } catch (err) { next(err); }
};

// ─── UPDATE ───────────────────────────────────────────────────
exports.updateMedicine = async (req, res, next) => {
  try {
    if (req.files?.length) req.body.images = req.files.map((f) => f.filename);
    const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found." });
    res.status(200).json({ success: true, data: { medicine } });
  } catch (err) { next(err); }
};

// ─── SOFT DELETE ──────────────────────────────────────────────
exports.deleteMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found." });
    res.status(200).json({ success: true, message: "Medicine deactivated." });
  } catch (err) { next(err); }
};

// ─── UPDATE STOCK ─────────────────────────────────────────────
exports.updateStock = async (req, res, next) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(req.params.id, { stock: req.body.stock }, { new: true });
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found." });
    res.status(200).json({ success: true, data: { medicine } });
  } catch (err) { next(err); }
};
