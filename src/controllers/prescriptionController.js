const Prescription = require("../models/Prescription");
const Medicine     = require("../models/Medicine");
const Notification = require("../models/Notification");

// ─── POST /api/prescriptions ─────────────────────────────────
// Upload prescription image + optional OCR text
exports.uploadPrescription = async (req, res, next) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "Please upload a prescription image." });

    const { ocrText, doctorName, expiryDate, notes } = req.body;
    const imageUrl = `/uploads/${req.file.filename}`;

    // Parse OCR text if provided (comma/newline separated medicine names)
    const extractedItems = [];
    if (ocrText) {
      const words = ocrText.split(/[\n,;]+/).map((w) => w.trim()).filter((w) => w.length > 2);
      for (const word of words) {
        const matched = await Medicine.findOne({
          $or: [
            { name: { $regex: word, $options: "i" } },
            { nameAr: { $regex: word, $options: "i" } },
            { activeIngredient: { $regex: word, $options: "i" } },
          ],
          isActive: true,
        }).select("name price stock");

        extractedItems.push({
          rawText:         word,
          matchedMedicine: matched?._id || undefined,
          confidence:      matched ? 0.85 : 0.1,
        });
      }
    }

    const prescription = await Prescription.create({
      user: req.user._id,
      imageUrl,
      extractedItems,
      doctorName,
      expiryDate,
      notes,
    });

    await prescription.populate("extractedItems.matchedMedicine", "name price stock images");

    res.status(201).json({
      success: true,
      message: "Prescription uploaded. Awaiting pharmacist review.",
      data: { prescription },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/prescriptions ───────────────────────────────────
exports.getMyPrescriptions = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const prescriptions = await Prescription.find(filter)
      .populate("extractedItems.matchedMedicine", "name price images")
      .populate("order", "orderNumber status")
      .sort("-createdAt");

    res.status(200).json({ success: true, count: prescriptions.length, data: { prescriptions } });
  } catch (err) { next(err); }
};

// ─── GET /api/prescriptions/:id ──────────────────────────────
exports.getPrescription = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate("extractedItems.matchedMedicine", "name price images stock")
      .populate("reviewedBy", "name")
      .populate("order", "orderNumber status");

    if (!prescription)
      return res.status(404).json({ success: false, message: "Prescription not found." });

    if (
      prescription.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) return res.status(403).json({ success: false, message: "Not authorized." });

    res.status(200).json({ success: true, data: { prescription } });
  } catch (err) { next(err); }
};

// ─── ADMIN: GET /api/admin/prescriptions ─────────────────────
exports.getAllPrescriptions = async (req, res, next) => {
  try {
    const { status = "pending_review", page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const prescriptions = await Prescription.find(filter)
      .populate("user", "name email phone")
      .populate("extractedItems.matchedMedicine", "name price")
      .sort("createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Prescription.countDocuments(filter);

    res.status(200).json({
      success: true, count: prescriptions.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { prescriptions },
    });
  } catch (err) { next(err); }
};

// ─── ADMIN: PUT /api/admin/prescriptions/:id/review ──────────
exports.reviewPrescription = async (req, res, next) => {
  try {
    const { status, reviewNote } = req.body;

    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ success: false, message: "Status must be 'approved' or 'rejected'." });

    const prescription = await Prescription.findByIdAndUpdate(
      req.params.id,
      { status, reviewNote, reviewedBy: req.user._id, reviewedAt: new Date() },
      { new: true }
    ).populate("user", "name");

    if (!prescription)
      return res.status(404).json({ success: false, message: "Prescription not found." });

    // Notify user
    await Notification.create({
      user:     prescription.user._id,
      title:    status === "approved" ? "Prescription Approved ✅" : "Prescription Rejected ❌",
      message:  status === "approved"
        ? "Your prescription has been approved. You can now proceed to checkout."
        : `Your prescription was rejected. Reason: ${reviewNote || "Please contact support."}`,
      type:     "prescription_update",
      refModel: "Prescription",
      refId:    prescription._id,
    });

    res.status(200).json({ success: true, data: { prescription } });
  } catch (err) { next(err); }
};
