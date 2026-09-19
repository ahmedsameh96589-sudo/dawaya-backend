const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  medicine:   { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
  quantity:   { type: Number, required: true, min: 1, default: 1 },
  price:      { type: Number, required: true },   // original price snapshot
  finalPrice: { type: Number, required: true },   // after discount snapshot
});

const cartSchema = new mongoose.Schema(
  {
    user:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items:          [cartItemSchema],
    couponCode:     { type: String },
    couponDiscount: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

cartSchema.virtual("subtotal").get(function () {
  return parseFloat(this.items.reduce((s, i) => s + i.finalPrice * i.quantity, 0).toFixed(2));
});

cartSchema.virtual("total").get(function () {
  const sub = this.items.reduce((s, i) => s + i.finalPrice * i.quantity, 0);
  return parseFloat(Math.max(0, sub - (this.couponDiscount || 0)).toFixed(2));
});

cartSchema.virtual("itemCount").get(function () {
  return this.items.reduce((s, i) => s + i.quantity, 0);
});

module.exports = mongoose.model("Cart", cartSchema);
