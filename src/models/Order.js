const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  medicine:   { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
  name:       { type: String, required: true },
  image:      { type: String },
  price:      { type: Number, required: true },
  finalPrice: { type: Number, required: true },
  quantity:   { type: Number, required: true, min: 1 },
  subtotal:   { type: Number, required: true },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items:       [orderItemSchema],

    // ───────────────────────────────────────────────────────────
    // BUG FIX #4: Added prescription reference.
    // When a cart contains a medicine that requiresPrescription,
    // the user must supply an approved prescriptionId at checkout.
    // That ID is stored here so the order is fully traceable.
    // ───────────────────────────────────────────────────────────
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Prescription",
      default: null,
    },

    deliveryAddress: {
      label: String, street: { type: String, required: true },
      building: String, floor: String, apartment: String,
      city: { type: String, required: true }, district: String, postalCode: String,
      coordinates: { lat: Number, lng: Number },
    },

    pricing: {
      subtotal:       { type: Number, required: true },
      deliveryFee:    { type: Number, default: 20 },
      couponDiscount: { type: Number, default: 0 },
      total:          { type: Number, required: true },
    },

    couponCode:    { type: String },
    paymentMethod: { type: String, enum: ["cash_on_delivery", "credit_card"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    paymentDetails:{ transactionId: String, paidAt: Date },

    status: {
      type: String,
      enum: ["pending","confirmed","preparing","out_for_delivery","delivered","cancelled","returned"],
      default: "pending",
    },

    statusHistory: [{
      status:    String,
      note:      String,
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      at:        { type: Date, default: Date.now },
    }],

    estimatedDelivery: Date,
    deliveredAt:       Date,
    cancelReason:      String,
    notes:             String,
  },
  { timestamps: true }
);

orderSchema.pre("save", function (next) {
  if (!this.orderNumber)
    this.orderNumber = "DWY-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  next();
});

module.exports = mongoose.model("Order", orderSchema);