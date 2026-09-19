const jwt  = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer"))
      token = req.headers.authorization.split(" ")[1];

    if (!token)
      return res.status(401).json({ success: false, message: "Not authorized. Please login." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id);

    if (!user || !user.isActive)
      return res.status(401).json({ success: false, message: "User not found or deactivated." });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};

exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: "Access denied. Insufficient permissions." });
  next();
};
