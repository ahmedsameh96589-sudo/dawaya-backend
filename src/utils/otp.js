const crypto = require("crypto");

// Generate a 6-digit numeric OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate a secure random token (for reset password links)
const generateResetToken = () => {
  const raw   = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hashed };
};

// Hash an OTP for storage
const hashOTP = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

// OTP expiry time
const otpExpiresAt = () => {
  const minutes = parseInt(process.env.OTP_EXPIRES_MINUTES) || 10;
  return new Date(Date.now() + minutes * 60 * 1000);
};

module.exports = { generateOTP, generateResetToken, hashOTP, otpExpiresAt };
