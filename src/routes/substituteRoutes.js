const express = require("express");
const router  = express.Router();
const c       = require("../controllers/substituteController");
const { protect } = require("../middlewares/auth");

// ── Public (no login needed) ──────────────────────────────────

// Search medicines by name (for the "Add Medicine" search box)
router.get("/search", c.searchMedicine);

// Quick substitutes by medicine ID
router.get("/medicine/:id", c.getSubstitutesByMedicineId);

// ── Main: get substitutes + save to history if logged in ──────
// Works for both guests and logged-in users
// Uses optional auth: save history only if token present
router.post("/", optionalAuth, c.getSubstitutes);

// ── Private (login required) ──────────────────────────────────
router.get("/history",    protect, c.getHistory);
router.delete("/history", protect, c.clearHistory);

// ─── Optional auth middleware (doesn't block guests) ──────────
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer")) return next();

  const jwt  = require("jsonwebtoken");
  const User = require("../models/User");
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (!err && decoded) {
      const user = await User.findById(decoded.id);
      if (user && user.isActive) req.user = user;
    }
    next();
  });
}

module.exports = router;
