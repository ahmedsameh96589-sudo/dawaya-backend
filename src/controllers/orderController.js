const Order        = require("../models/Order");
const Cart         = require("../models/Cart");
const Medicine     = require("../models/Medicine");
const Prescription = require("../models/Prescription"); // BUG FIX #3
const Notification = require("../models/Notification");
const { sendEmail } = require("../utils/email");
const { sendPushToUser } = require("../utils/pushNotification");

const STATUS_LABELS = {
  confirmed:        "Your order is confirmed",
  preparing:        "Your order is being prepared",
  out_for_delivery: "Your order is on its way",
  delivered:        "Your order was delivered",
  cancelled:        "Your order was cancelled",
};

const DELIVERY_FEE = 20; // EGP — make dynamic per city if needed

// ─── POST /api/orders ─────────────────────────────────────────
// Checkout: creates order from cart
exports.placeOrder = async (req, res, next) => {
  try {
    const { deliveryAddress, paymentMethod, notes, prescriptionId } = req.body;

    if (!deliveryAddress?.street || !deliveryAddress?.city)
      return res.status(400).json({ success: false, message: "Delivery address (street & city) is required." });

    // Load user's cart
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.medicine");
    if (!cart || cart.items.length === 0)
      return res.status(400).json({ success: false, message: "Your cart is empty." });

    // ─────────────────────────────────────────────────────────
    // BUG FIX #3: Check prescription BEFORE building the order.
    //
    // If ANY item in the cart requiresPrescription, the user
    // must provide a valid approved prescription. Previously this
    // check was completely missing — users could buy
    // prescription-only medicines with no verification at all.
    // ─────────────────────────────────────────────────────────
    const needsPrescription = cart.items.some(
      (item) => item.medicine?.requiresPrescription
    );

    let approvedPrescription = null;

    if (needsPrescription) {
      if (!prescriptionId) {
        return res.status(400).json({
          success: false,
          message:
            "Your cart contains prescription-only medicines. Please upload and get a prescription approved before checkout.",
          requiresPrescription: true,
        });
      }

      approvedPrescription = await Prescription.findOne({
        _id:    prescriptionId,
        user:   req.user._id,
        status: "approved",
      });

      if (!approvedPrescription) {
        return res.status(403).json({
          success: false,
          message:
            "The provided prescription was not found or has not been approved yet. Please wait for pharmacist approval.",
          requiresPrescription: true,
        });
      }
    }

    // Validate stock & build order items
    const orderItems = [];
    let   subtotal   = 0;

    for (const item of cart.items) {
      const medicine = await Medicine.findById(item.medicine._id);

      if (!medicine || !medicine.isActive)
        return res.status(400).json({ success: false, message: `Medicine "${item.medicine.name}" is no longer available.` });

      if (medicine.stock < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${medicine.name}". Available: ${medicine.stock}.`,
        });

      const finalPrice = medicine.finalPrice;
      const lineTotal  = parseFloat((finalPrice * item.quantity).toFixed(2));
      subtotal        += lineTotal;

      orderItems.push({
        medicine:   medicine._id,
        name:       medicine.name,
        image:      medicine.images?.[0] || "default-medicine.png",
        price:      medicine.price,
        finalPrice,
        quantity:   item.quantity,
        subtotal:   lineTotal,
      });
    }

    const couponDiscount = cart.couponDiscount || 0;
    const total          = parseFloat(Math.max(0, subtotal + DELIVERY_FEE - couponDiscount).toFixed(2));

    // Deduct stock
    for (const item of cart.items) {
      await Medicine.findByIdAndUpdate(item.medicine._id, { $inc: { stock: -item.quantity } });
    }

    // Estimate delivery: +2 hours
    const estimatedDelivery = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const order = await Order.create({
      user:             req.user._id,
      items:            orderItems,
      deliveryAddress,
      pricing:          { subtotal, deliveryFee: DELIVERY_FEE, couponDiscount, total },
      couponCode:       cart.couponCode,
      paymentMethod,
      notes,
      estimatedDelivery,
      // BUG FIX #4: Store the prescription reference on the order
      prescription:     approvedPrescription?._id || null,
      statusHistory:    [{ status: "pending", note: "Order placed successfully.", updatedBy: req.user._id }],
    });

    // BUG FIX #4 (cont.): Link the order back to the prescription
    // so the prescription record knows it has been used.
    if (approvedPrescription) {
      await Prescription.findByIdAndUpdate(approvedPrescription._id, {
        order: order._id,
      });
    }

    try {
      await Notification.create({
        user:     req.user._id,
        title:    "Order Placed Successfully",
        message:  `Your order ${order.orderNumber} has been placed and is pending confirmation.`,
        type:     "order_update",
        refModel: "Order",
        refId:    order._id,
      });
    } catch (notificationErr) {
      console.error("🔔 Order notification failed:", notificationErr.message);
    }

    // Clear cart after successful order
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [], couponCode: undefined, couponDiscount: 0 }
    );

    // ─── Send Order Confirmation Email ────────────────────────
    try {
      const itemsRows = order.items.map((item) => `
        <tr>
          <td style="padding:10px;border:1px solid #e0e0e0;">${item.name}</td>
          <td style="padding:10px;border:1px solid #e0e0e0;text-align:center;">${item.quantity}</td>
          <td style="padding:10px;border:1px solid #e0e0e0;text-align:right;">${item.finalPrice} EGP</td>
          <td style="padding:10px;border:1px solid #e0e0e0;text-align:right;font-weight:bold;">${item.subtotal} EGP</td>
        </tr>
      `).join("");

      const addressLine = [
        order.deliveryAddress.street,
        order.deliveryAddress.building ? `Building ${order.deliveryAddress.building}` : "",
        order.deliveryAddress.floor    ? `Floor ${order.deliveryAddress.floor}`       : "",
        order.deliveryAddress.apartment? `Apt ${order.deliveryAddress.apartment}`     : "",
        order.deliveryAddress.city,
        order.deliveryAddress.district ? `- ${order.deliveryAddress.district}`        : "",
      ].filter(Boolean).join(", ");

      await sendEmail({
        to:      req.user.email,
        subject: `✅ Order Confirmed — ${order.orderNumber}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:0;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
            
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:30px;text-align:center;">
              <h1 style="color:white;margin:0;font-size:24px;">💊 DAWAYA Pharmacy</h1>
              <p style="color:#e8f0fe;margin:8px 0 0;font-size:14px;">Order Confirmation</p>
            </div>

            <div style="padding:30px;">

              <!-- Greeting -->
              <p style="color:#333;font-size:16px;margin:0 0 20px;">
                Hi <strong>${req.user.name}</strong>, your order has been placed successfully! 🎉
              </p>

              <!-- Order Info Box -->
              <div style="background:#f8f9ff;border-left:4px solid #1a73e8;border-radius:4px;padding:16px;margin-bottom:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#666;font-size:13px;padding:4px 0;">📦 Order Number</td>
                    <td style="color:#1a73e8;font-weight:bold;text-align:right;font-size:14px;">${order.orderNumber}</td>
                  </tr>
                  <tr>
                    <td style="color:#666;font-size:13px;padding:4px 0;">📅 Order Date</td>
                    <td style="color:#333;text-align:right;font-size:13px;">${new Date(order.createdAt).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })}</td>
                  </tr>
                  <tr>
                    <td style="color:#666;font-size:13px;padding:4px 0;">💳 Payment</td>
                    <td style="color:#333;text-align:right;font-size:13px;">${order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery 💵" : "Credit Card 💳"}</td>
                  </tr>
                  <tr>
                    <td style="color:#666;font-size:13px;padding:4px 0;">🕐 Estimated Delivery</td>
                    <td style="color:#333;text-align:right;font-size:13px;">${new Date(order.estimatedDelivery).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" })} today</td>
                  </tr>
                  <tr>
                    <td style="color:#666;font-size:13px;padding:4px 0;">📍 Delivery Address</td>
                    <td style="color:#333;text-align:right;font-size:13px;">${addressLine}</td>
                  </tr>
                </table>
              </div>

              <!-- Items Table -->
              <h3 style="color:#333;font-size:15px;margin:0 0 12px;">🛒 Order Items</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
                <thead>
                  <tr style="background:#1a73e8;color:white;">
                    <th style="padding:10px;text-align:left;font-size:13px;">Medicine</th>
                    <th style="padding:10px;text-align:center;font-size:13px;">Qty</th>
                    <th style="padding:10px;text-align:right;font-size:13px;">Unit Price</th>
                    <th style="padding:10px;text-align:right;font-size:13px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>${itemsRows}</tbody>
              </table>

              <!-- Pricing Summary -->
              <div style="background:#f8f9ff;border-radius:8px;padding:16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#666;font-size:13px;padding:4px 0;">Subtotal</td>
                    <td style="text-align:right;color:#333;font-size:13px;">${order.pricing.subtotal} EGP</td>
                  </tr>
                  <tr>
                    <td style="color:#666;font-size:13px;padding:4px 0;">Delivery Fee</td>
                    <td style="text-align:right;color:#333;font-size:13px;">${order.pricing.deliveryFee} EGP</td>
                  </tr>
                  ${order.pricing.couponDiscount > 0 ? `
                  <tr>
                    <td style="color:#4caf50;font-size:13px;padding:4px 0;">🎟 Coupon Discount</td>
                    <td style="text-align:right;color:#4caf50;font-size:13px;">- ${order.pricing.couponDiscount} EGP</td>
                  </tr>` : ""}
                  <tr>
                    <td colspan="2"><hr style="border:none;border-top:1px solid #e0e0e0;margin:8px 0;"/></td>
                  </tr>
                  <tr>
                    <td style="font-weight:bold;font-size:16px;color:#333;">Total</td>
                    <td style="text-align:right;font-weight:bold;font-size:18px;color:#1a73e8;">${order.pricing.total} EGP</td>
                  </tr>
                </table>
              </div>

              <!-- Status tracker -->
              <div style="margin-top:24px;text-align:center;">
                <p style="color:#666;font-size:13px;margin:0 0 12px;">Order Status</p>
                <div style="display:inline-flex;gap:0;align-items:center;">
                  <span style="background:#1a73e8;color:white;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:bold;">✅ Placed</span>
                  <span style="color:#ccc;margin:0 4px;">──</span>
                  <span style="background:#e0e0e0;color:#999;padding:6px 14px;border-radius:20px;font-size:12px;">Confirmed</span>
                  <span style="color:#ccc;margin:0 4px;">──</span>
                  <span style="background:#e0e0e0;color:#999;padding:6px 14px;border-radius:20px;font-size:12px;">On the Way</span>
                  <span style="color:#ccc;margin:0 4px;">──</span>
                  <span style="background:#e0e0e0;color:#999;padding:6px 14px;border-radius:20px;font-size:12px;">Delivered</span>
                </div>
              </div>

              <p style="color:#999;font-size:12px;margin-top:24px;text-align:center;">
                Questions? Contact our support team.<br/>
                We'll send you updates as your order progresses.
              </p>
            </div>

            <!-- Footer -->
            <div style="background:#f5f5f5;padding:16px;text-align:center;border-top:1px solid #e0e0e0;">
              <p style="color:#aaa;font-size:12px;margin:0;">© ${new Date().getFullYear()} DAWAYA Pharmacy. All rights reserved.</p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("📧 Order email failed:", emailErr.message);
      // Email failure does NOT cancel the order
    }

    res.status(201).json({ success: true, message: "Order placed successfully!", data: { order } });
  } catch (err) { next(err); }
};

// ─── GET /api/orders ──────────────────────────────────────────
exports.getMyOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate("prescription", "imageUrl status")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true, count: orders.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { orders },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/orders/:id ──────────────────────────────────────
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("prescription", "imageUrl status reviewNote");

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found." });

    if (req.user.role !== "admin" && order.user._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Not authorized to view this order." });

    res.status(200).json({ success: true, data: { order } });
  } catch (err) { next(err); }
};

// ─── PUT /api/orders/:id/cancel ───────────────────────────────
exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found." });

    if (order.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Not authorized." });

    if (["out_for_delivery", "delivered", "cancelled"].includes(order.status))
      return res.status(400).json({ success: false, message: `Cannot cancel an order that is "${order.status}".` });

    // Restore stock
    for (const item of order.items)
      await Medicine.findByIdAndUpdate(item.medicine, { $inc: { stock: item.quantity } });

    order.status       = "cancelled";
    order.cancelReason = reason || "Cancelled by user";
    order.statusHistory.push({ status: "cancelled", note: reason || "Cancelled by user", updatedBy: req.user._id });
    await order.save();

    try {
      await Notification.create({
        user:     order.user,
        title:    "Order Cancelled",
        message:  `Your order ${order.orderNumber} has been cancelled.`,
        type:     "order_update",
        refModel: "Order",
        refId:    order._id,
      });
    } catch (notificationErr) {
      console.error("🔔 Order cancellation notification failed:", notificationErr.message);
    }

    res.status(200).json({ success: true, message: "Order cancelled.", data: { order } });
  } catch (err) { next(err); }
};

// ─── ADMIN: GET /api/orders/admin/all ─────────────────────────
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, userId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (userId) filter.user   = userId;

    const orders = await Order.find(filter)
      .populate("user", "name email phone")
      .populate("prescription", "imageUrl status")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true, count: orders.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { orders },
    });
  } catch (err) { next(err); }
};

// ─── ADMIN: PUT /api/orders/:id/status ───────────────────────
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    const VALID_TRANSITIONS = {
      pending:          ["confirmed", "cancelled"],
      confirmed:        ["preparing", "cancelled"],
      preparing:        ["out_for_delivery"],
      out_for_delivery: ["delivered"],
      delivered:        [],
      cancelled:        [],
      returned:         [],
    };

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(status))
      return res.status(400).json({
        success: false,
        message: `Cannot transition order from "${order.status}" to "${status}".`,
        allowedNext: allowed,
      });

    order.status = status;
    order.statusHistory.push({ status, note: note || "", updatedBy: req.user._id });

    if (status === "delivered") {
      order.deliveredAt = new Date();
      if (order.paymentMethod === "cash_on_delivery") order.paymentStatus = "paid";
    }

    if (status === "cancelled") {
      for (const item of order.items)
        await Medicine.findByIdAndUpdate(item.medicine, { $inc: { stock: item.quantity } });
      order.cancelReason = note || "Cancelled by admin";
    }

    await order.save();

    try {
      await Notification.create({
        user:     order.user,
        title:    "Order Status Updated",
        message:  `Your order ${order.orderNumber} is now ${status.replace(/_/g, " ")}.`,
        type:     "order_update",
        refModel: "Order",
        refId:    order._id,
      });
    } catch (notificationErr) {
      console.error("🔔 Order status notification failed:", notificationErr.message);
    }

    // Push so the customer sees the change without opening the app.
    sendPushToUser(order.user, {
      title: STATUS_LABELS[status] || "Order update",
      body:  `Order ${order.orderNumber}${note ? `: ${note}` : ""}`,
      data:  { type: "order_update", orderId: order._id },
    }).catch((err) => console.error("🔔 Order push failed:", err.message));

    res.status(200).json({ success: true, data: { order } });
  } catch (err) { next(err); }
};