const jwt    = require("jsonwebtoken");
const Doctor = require("../models/Doctor");

// ─── Protect Doctor routes ────────────────────────────────────
exports.protectDoctor = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer"))
      token = req.headers.authorization.split(" ")[1];

    if (!token)
      return res.status(401).json({ success: false, message: "Not authorized. Please login." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "doctor")
      return res.status(403).json({ success: false, message: "Access denied. Doctor token required." });

    const doctor = await Doctor.findById(decoded.id);
    if (!doctor || !doctor.isActive)
      return res.status(401).json({ success: false, message: "Doctor not found or deactivated." });

    req.doctor = doctor;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};

// ─── Allow both User and Doctor (for shared routes like sendMessage) ──
exports.protectUserOrDoctor = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer"))
      token = req.headers.authorization.split(" ")[1];

    if (!token)
      return res.status(401).json({ success: false, message: "Not authorized." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === "doctor") {
      const Doctor = require("../models/Doctor");
      const doctor = await Doctor.findById(decoded.id);
      if (doctor && doctor.isActive) { req.doctor = doctor; return next(); }
    } else {
      const User = require("../models/User");
      const user = await User.findById(decoded.id);
      if (user && user.isActive) { req.user = user; return next(); }
    }

    res.status(401).json({ success: false, message: "Invalid token." });
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};
