const jwt = require("jsonwebtoken");

// Prescriptions and chat attachments are medical data, so they are only
// served to a request carrying a valid user or doctor token. Every other
// upload (product images, avatars, logos) stays public.
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

module.exports = requireTokenForPrivateUploads;
