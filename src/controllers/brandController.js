const Brand = require("../models/Brand");

exports.getBrands = async (req, res, next) => {
  try {
    const brands = await Brand.find({ isActive: true }).sort("name");
    res.status(200).json({ success: true, count: brands.length, data: { brands } });
  } catch (err) { next(err); }
};

exports.getBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: "Brand not found." });
    res.status(200).json({ success: true, data: { brand } });
  } catch (err) { next(err); }
};

exports.createBrand = async (req, res, next) => {
  try {
    if (req.file) req.body.logo = req.file.filename;
    const brand = await Brand.create(req.body);
    res.status(201).json({ success: true, data: { brand } });
  } catch (err) { next(err); }
};

exports.updateBrand = async (req, res, next) => {
  try {
    if (req.file) req.body.logo = req.file.filename;
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!brand) return res.status(404).json({ success: false, message: "Brand not found." });
    res.status(200).json({ success: true, data: { brand } });
  } catch (err) { next(err); }
};

exports.deleteBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!brand) return res.status(404).json({ success: false, message: "Brand not found." });
    res.status(200).json({ success: true, message: "Brand deactivated." });
  } catch (err) { next(err); }
};
