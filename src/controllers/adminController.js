const User     = require("../models/User");
const Medicine = require("../models/Medicine");
const Order    = require("../models/Order");
const Category = require("../models/Category");
const Brand    = require("../models/Brand");
const escapeRegex = require("../utils/escapeRegex");

// ─── GET /api/admin/dashboard ─────────────────────────────────
exports.getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalOrders,
      todayOrders,
      pendingOrders,
      totalMedicines,
      totalCategories,
      totalBrands,
      lowStockMedicines,
      revenueData,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments({ role: "user", isActive: true }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ status: "pending" }),
      Medicine.countDocuments({ isActive: true }),
      Category.countDocuments({ isActive: true }),
      Brand.countDocuments({ isActive: true }),
      Medicine.find({ stock: { $lte: 10 }, isActive: true }).select("name stock sku").limit(10),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$pricing.total" }, count: { $sum: 1 } } },
      ]),
      Order.find().populate("user", "name email").sort("-createdAt").limit(5),
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalOrders,
          todayOrders,
          pendingOrders,
          totalMedicines,
          totalCategories,
          totalBrands,
          totalRevenue:  revenueData[0]?.total  || 0,
          paidOrders:    revenueData[0]?.count  || 0,
        },
        lowStockMedicines,
        recentOrders,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/admin/users ─────────────────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role, isActive } = req.query;
    const filter = {};
    if (role)     filter.role     = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: re }, { email: re }, { phone: re }];
    }

    const users = await User.find(filter)
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true, count: users.length,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      data: { users },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/admin/users/:id ─────────────────────────────────
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    // Attach order summary
    const orders = await Order.find({ user: user._id }).select("orderNumber status pricing.total createdAt").sort("-createdAt").limit(10);
    const totalSpent = await Order.aggregate([
      { $match: { user: user._id, paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$pricing.total" } } },
    ]);

    res.status(200).json({
      success: true,
      data: { user, recentOrders: orders, totalSpent: totalSpent[0]?.total || 0 },
    });
  } catch (err) { next(err); }
};

// ─── PUT /api/admin/users/:id ─────────────────────────────────
exports.updateUser = async (req, res, next) => {
  try {
    // Admins can update role, isActive, isVerified — but NOT password directly
    const { name, phone, role, isActive, isVerified } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone, role, isActive, isVerified },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.status(200).json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

// ─── DELETE /api/admin/users/:id  (soft delete) ───────────────
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.status(200).json({ success: true, message: "User deactivated." });
  } catch (err) { next(err); }
};

// ─── GET /api/admin/stats/revenue ────────────────────────────
exports.getRevenueStats = async (req, res, next) => {
  try {
    // Monthly revenue for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthly = await Order.aggregate([
      { $match: { paymentStatus: "paid", createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id:     { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          revenue: { $sum: "$pricing.total" },
          orders:  { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Top selling medicines
    const topMedicines = await Order.aggregate([
      { $unwind: "$items" },
      { $group: { _id: "$items.medicine", name: { $first: "$items.name" }, totalSold: { $sum: "$items.quantity" }, revenue: { $sum: "$items.subtotal" } } },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({ success: true, data: { monthly, topMedicines } });
  } catch (err) { next(err); }
};
