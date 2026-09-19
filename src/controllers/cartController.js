const Cart     = require("../models/Cart");
const Medicine = require("../models/Medicine");

// helper — populate cart items fully
const populateCart = (query) =>
  query.populate("items.medicine", "name nameAr images price discountPercent stock isActive finalPrice inStock");

// ─── GET /api/cart ────────────────────────────────────────────
exports.getCart = async (req, res, next) => {
  try {
    let cart = await populateCart(Cart.findOne({ user: req.user._id }));
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });
    res.status(200).json({ success: true, data: { cart } });
  } catch (err) { next(err); }
};

// ─── POST /api/cart/add ───────────────────────────────────────
// Body: { medicineId, quantity }
exports.addToCart = async (req, res, next) => {
  try {
    const { medicineId, quantity = 1 } = req.body;

    const medicine = await Medicine.findById(medicineId);
    if (!medicine || !medicine.isActive)
      return res.status(404).json({ success: false, message: "Medicine not found." });

    if (medicine.stock < quantity)
      return res.status(400).json({ success: false, message: `Only ${medicine.stock} units available.` });

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const existingIndex = cart.items.findIndex(
      (i) => i.medicine.toString() === medicineId
    );

    if (existingIndex > -1) {
      // Update quantity
      const newQty = cart.items[existingIndex].quantity + quantity;
      if (newQty > medicine.stock)
        return res.status(400).json({ success: false, message: `Only ${medicine.stock} units available in stock.` });
      cart.items[existingIndex].quantity = newQty;
    } else {
      // Add new item
      cart.items.push({
        medicine:   medicine._id,
        quantity,
        price:      medicine.price,
        finalPrice: medicine.finalPrice,
      });
    }

    await cart.save();
    cart = await populateCart(Cart.findById(cart._id));
    res.status(200).json({ success: true, message: "Item added to cart.", data: { cart } });
  } catch (err) { next(err); }
};

// ─── PUT /api/cart/update ─────────────────────────────────────
// Body: { medicineId, quantity }  — set absolute quantity (0 = remove)
exports.updateCartItem = async (req, res, next) => {
  try {
    const { medicineId, quantity } = req.body;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found." });

    const itemIndex = cart.items.findIndex((i) => i.medicine.toString() === medicineId);
    if (itemIndex === -1)
      return res.status(404).json({ success: false, message: "Item not found in cart." });

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const medicine = await Medicine.findById(medicineId);
      if (quantity > medicine.stock)
        return res.status(400).json({ success: false, message: `Only ${medicine.stock} units available.` });

      cart.items[itemIndex].quantity   = quantity;
      cart.items[itemIndex].finalPrice = medicine.finalPrice; // refresh price
    }

    await cart.save();
    const updated = await populateCart(Cart.findById(cart._id));
    res.status(200).json({ success: true, message: "Cart updated.", data: { cart: updated } });
  } catch (err) { next(err); }
};

// ─── DELETE /api/cart/remove/:medicineId ─────────────────────
exports.removeFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found." });

    cart.items = cart.items.filter((i) => i.medicine.toString() !== req.params.medicineId);
    await cart.save();

    const updated = await populateCart(Cart.findById(cart._id));
    res.status(200).json({ success: true, message: "Item removed.", data: { cart: updated } });
  } catch (err) { next(err); }
};

// ─── DELETE /api/cart/clear ───────────────────────────────────
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [], couponCode: undefined, couponDiscount: 0 },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Cart cleared.", data: { cart } });
  } catch (err) { next(err); }
};

// ─── POST /api/cart/coupon ────────────────────────────────────
// Body: { couponCode }
// Simple demo coupon — extend with a Coupon model for production
exports.applyCoupon = async (req, res, next) => {
  try {
    const { couponCode } = req.body;
    const DEMO_COUPONS   = { DAWAYA10: 10, PHARMA20: 20, SAVE50: 50 }; // flat EGP discounts
    const discount       = DEMO_COUPONS[couponCode?.toUpperCase()];

    if (!discount)
      return res.status(400).json({ success: false, message: "Invalid or expired coupon code." });

    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { couponCode: couponCode.toUpperCase(), couponDiscount: discount },
      { new: true }
    );

    if (!cart) return res.status(404).json({ success: false, message: "Cart not found." });

    const updated = await populateCart(Cart.findById(cart._id));
    res.status(200).json({ success: true, message: `Coupon applied. You save ${discount} EGP!`, data: { cart: updated } });
  } catch (err) { next(err); }
};

// ─── DELETE /api/cart/coupon ──────────────────────────────────
exports.removeCoupon = async (req, res, next) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { couponCode: undefined, couponDiscount: 0 },
      { new: true }
    );
    const updated = await populateCart(Cart.findById(cart._id));
    res.status(200).json({ success: true, message: "Coupon removed.", data: { cart: updated } });
  } catch (err) { next(err); }
};
