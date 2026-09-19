const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

// ─────────────────────────────────────────────────────────────
// BUG FIX #5: Auto-create the uploads/ directory if it doesn't
// exist. Without this, multer throws ENOENT on the first upload
// and every file upload fails silently in production.
// ─────────────────────────────────────────────────────────────
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed."));
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });