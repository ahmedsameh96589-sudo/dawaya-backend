const Wishlist = require("../models/Wishlist");

// ─── GET /api/wishlist ────────────────────────────────────────
exports.getWishlist = async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id })
      .populate("medicines.medicine", "name nameAr price discountPercent images stock isActive finalPrice inStock brand")
      .populate("medicines.medicine.brand", "name logo");

    if (!wishlist) wishlist = await Wishlist.create({ user: req.user._id, medicines: [] });

    // Filter out deactivated medicines
    wishlist.medicines = wishlist.medicines.filter((m) => m.medicine?.isActive !== false);

    res.status(200).json({ success: true, count: wishlist.medicines.length, data: { wishlist } });
  } catch (err) { next(err); }
};

// ─── POST /api/wishlist/:medicineId ──────────────────────────
exports.addToWishlist = async (req, res, next) => {
  try {
    const { medicineId } = req.params;

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) wishlist = await Wishlist.create({ user: req.user._id, medicines: [] });

    const alreadyAdded = wishlist.medicines.some(
      (m) => m.medicine.toString() === medicineId
    );

    if (alreadyAdded)
      return res.status(400).json({ success: false, message: "Medicine already in wishlist." });

    wishlist.medicines.push({ medicine: medicineId });
    await wishlist.save();

    res.status(200).json({ success: true, message: "Added to wishlist.", data: { wishlist } });
  } catch (err) { next(err); }
};

// ─── DELETE /api/wishlist/:medicineId ────────────────────────
exports.removeFromWishlist = async (req, res, next) => {
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { medicines: { medicine: req.params.medicineId } } },
      { new: true }
    );

    if (!wishlist)
      return res.status(404).json({ success: false, message: "Wishlist not found." });

    res.status(200).json({ success: true, message: "Removed from wishlist.", data: { wishlist } });
  } catch (err) { next(err); }
};

// ─── DELETE /api/wishlist ─────────────────────────────────────
exports.clearWishlist = async (req, res, next) => {
  try {
    await Wishlist.findOneAndUpdate({ user: req.user._id }, { medicines: [] });
    res.status(200).json({ success: true, message: "Wishlist cleared." });
  } catch (err) { next(err); }
};

// ─── POST /api/wishlist/:medicineId/move-to-cart ─────────────
exports.moveToCart = async (req, res, next) => {
  try {
    const Cart     = require("../models/Cart");
    const Medicine = require("../models/Medicine");
    const { medicineId } = req.params;

    const medicine = await Medicine.findById(medicineId);
    if (!medicine || !medicine.isActive)
      return res.status(404).json({ success: false, message: "Medicine not found." });

    if (medicine.stock === 0)
      return res.status(400).json({ success: false, message: "Medicine is out of stock." });

    // Add to cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const existingIndex = cart.items.findIndex((i) => i.medicine.toString() === medicineId);
    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += 1;
    } else {
      cart.items.push({ medicine: medicine._id, quantity: 1, price: medicine.price, finalPrice: medicine.finalPrice });
    }
    await cart.save();

    // Remove from wishlist
    await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { medicines: { medicine: medicineId } } }
    );

    res.status(200).json({ success: true, message: "Moved to cart successfully." });
  } catch (err) { next(err); }
};
