const express    = require("express");
const cors       = require("cors");
const morgan     = require("morgan");
const path       = require("path");
const rateLimit  = require("express-rate-limit");
const helmet     = require("helmet");
const jwt        = require("jsonwebtoken");
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
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Browsers only get access from the origins listed in CORS_ORIGINS
// (comma-separated). The mobile app is not a browser, so CORS never blocks it.
const corsOrigins = (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

// Serve uploaded files. Prescriptions and chat attachments are medical data,
// so they require a valid user or doctor token; product images stay public.
const PRIVATE_UPLOAD = /^\/(prescription|attachment)-/;
const requireTokenForPrivateUploads = (req, res, next) => {
  if (!PRIVATE_UPLOAD.test(req.path)) return next();
  const header = req.headers.authorization || "";
  try {
    jwt.verify(header.startsWith("Bearer ") ? header.slice(7) : "", process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Not authorized." });
  }
};
app.use("/uploads", requireTokenForPrivateUploads, express.static(path.join(__dirname, "../uploads")));

// Rate limiter (500 req / 15 min per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      500,
  message:  { success: false, message: "Too many requests. Please try again later." },
});
app.use("/api", limiter);

// Stricter limiter for auth endpoints (50 req / 15 min per IP)
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
