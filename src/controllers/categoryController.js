const Category    = require("../models/Category");
const Subcategory = require("../models/Subcategory");

exports.getCategories = async (req, res, next) => {
  try {
    const withSubs = req.query.withSubcategories === "true";
    let query = Category.find({ isActive: true }).sort("sortOrder name");
    if (withSubs) query = query.populate({ path: "subcategories", match: { isActive: true }, select: "name nameAr slug image sortOrder" });
    const categories = await query;
    res.status(200).json({ success: true, count: categories.length, data: { categories } });
  } catch (err) { next(err); }
};

exports.getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate({ path: "subcategories", match: { isActive: true }, select: "name nameAr slug image" });
    if (!category) return res.status(404).json({ success: false, message: "Category not found." });
    res.status(200).json({ success: true, data: { category } });
  } catch (err) { next(err); }
};

exports.createCategory = async (req, res, next) => {
  try {
    if (req.file) req.body.image = req.file.filename;
    const category = await Category.create(req.body);
    res.status(201).json({ success: true, data: { category } });
  } catch (err) { next(err); }
};

exports.updateCategory = async (req, res, next) => {
  try {
    if (req.file) req.body.image = req.file.filename;
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ success: false, message: "Category not found." });
    res.status(200).json({ success: true, data: { category } });
  } catch (err) { next(err); }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!category) return res.status(404).json({ success: false, message: "Category not found." });
    await Subcategory.updateMany({ category: req.params.id }, { isActive: false });
    res.status(200).json({ success: true, message: "Category and its subcategories deactivated." });
  } catch (err) { next(err); }
};

// ── Subcategories ─────────────────────────────────────────────

exports.getSubcategories = async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.params.categoryId) filter.category = req.params.categoryId;
    const subcategories = await Subcategory.find(filter)
      .populate("category", "name nameAr slug").sort("sortOrder name");
    res.status(200).json({ success: true, count: subcategories.length, data: { subcategories } });
  } catch (err) { next(err); }
};

exports.getSubcategory = async (req, res, next) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id).populate("category", "name nameAr slug");
    if (!subcategory) return res.status(404).json({ success: false, message: "Subcategory not found." });
    res.status(200).json({ success: true, data: { subcategory } });
  } catch (err) { next(err); }
};

exports.createSubcategory = async (req, res, next) => {
  try {
    if (req.file) req.body.image = req.file.filename;
    const subcategory = await Subcategory.create(req.body);
    res.status(201).json({ success: true, data: { subcategory } });
  } catch (err) { next(err); }
};

exports.updateSubcategory = async (req, res, next) => {
  try {
    if (req.file) req.body.image = req.file.filename;
    const subcategory = await Subcategory.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!subcategory) return res.status(404).json({ success: false, message: "Subcategory not found." });
    res.status(200).json({ success: true, data: { subcategory } });
  } catch (err) { next(err); }
};

exports.deleteSubcategory = async (req, res, next) => {
  try {
    const subcategory = await Subcategory.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!subcategory) return res.status(404).json({ success: false, message: "Subcategory not found." });
    res.status(200).json({ success: true, message: "Subcategory deactivated." });
  } catch (err) { next(err); }
};
