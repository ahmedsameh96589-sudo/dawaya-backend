const express    = require("express");
const cors       = require("cors");
const morgan     = require("morgan");
const path       = require("path");
const rateLimit  = require("express-rate-limit");
require("dotenv").config();

const connectDB      = require("./config/db");
const errorHandler   = require("./middlewares/errorHandler");

// ── Route imports ─────────────────────────────────────────────
const authRoutes          = require("./routes/authRoutes");
const categoryRoutes      = require("./routes/categoryRoutes");
const subcategoryRoutes   = require("./routes/subcategoryRoutes");
const brandRoutes         = require("./routes/brandRoutes");
const medicineRoutes      = require("./routes/medicineRoutes");
const cartRoutes          = require("./routes/cartRoutes");
const orderRoutes         = require("./routes/orderRoutes");
const adminRoutes         = require("./routes/adminRoutes");
const wishlistRoutes      = require("./routes/wishlistRoutes");
const reviewRoutes        = require("./routes/reviewRoutes");
const prescriptionRoutes  = require("./routes/prescriptionRoutes");
const notificationRoutes  = require("./routes/notificationRoutes");
const substituteRoutes    = require("./routes/substituteRoutes");
const newsRoutes          = require("./routes/newsRoutes");
const doctorRoutes        = require("./routes/doctorRoutes");
const consultationRoutes  = require("./routes/consultationRoutes");
const userRoutes          = require("./routes/userRoutes");

// ── Connect DB ────────────────────────────────────────────────
connectDB();

// ── Firebase push (logs readiness on startup) ─────────────────
const { initFirebase } = require("./utils/pushNotification");
initFirebase();

const app = express();

// ── Global Middleware ─────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Rate limiter (100 req / 15 min per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      500,
  message:  { success: false, message: "Too many requests. Please try again later." },
});
app.use("/api", limiter);

// Strict limiter for auth endpoints (10 req / 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      50,
  message:  { success: false, message: "Too many auth attempts. Please try again later." },
});
app.use("/api/auth/login",           authLimiter);
app.use("/api/auth/register",        authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/verify-otp",      authLimiter);

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth",           authRoutes);
app.use("/api/categories",     categoryRoutes);
app.use("/api/subcategories",  subcategoryRoutes);
app.use("/api/brands",         brandRoutes);
app.use("/api/medicines",      medicineRoutes);
app.use("/api/cart",           cartRoutes);
app.use("/api/orders",         orderRoutes);
app.use("/api/wishlist",       wishlistRoutes);
app.use("/api/reviews",        reviewRoutes);
app.use("/api/prescriptions",  prescriptionRoutes);
app.use("/api/notifications",  notificationRoutes);
app.use("/api/substitutes",    substituteRoutes);
app.use("/api/news",           newsRoutes);
app.use("/api/doctors",        doctorRoutes);
app.use("/api/consultations",  consultationRoutes);
app.use("/api/users",          userRoutes);
app.use("/api/admin",          adminRoutes);

// ── Health check ──────────────────────────────────────────────
app.get("/api/health", (req, res) =>
  res.status(200).json({ success: true, message: "💊 DAWAYA API is running!", timestamp: new Date().toISOString() })
);

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found.` })
);

// ── Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 DAWAYA Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`)
);

module.exports = app;
