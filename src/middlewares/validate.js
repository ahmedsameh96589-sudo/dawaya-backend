const { validationResult, body } = require("express-validator");

// Run validations and return errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  next();
};

// ── Auth validators ───────────────────────────────────────────
const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("phone").optional().trim(),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

const loginRules = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const verifyOTPRules = [
  body("userId").notEmpty().withMessage("userId is required"),
  body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
  body("purpose").isIn(["verification", "forgot_password", "login"]).withMessage("Invalid purpose"),
];

const forgotPasswordRules = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
];

const resetPasswordRules = [
  body("userId").notEmpty().withMessage("userId is required"),
  body("resetToken").notEmpty().withMessage("resetToken is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

// ── Order validators ──────────────────────────────────────────
const placeOrderRules = [
  body("deliveryAddress.street").notEmpty().withMessage("Street is required"),
  body("deliveryAddress.city").notEmpty().withMessage("City is required"),
  body("paymentMethod").isIn(["cash_on_delivery", "credit_card"]).withMessage("Invalid payment method"),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  verifyOTPRules,
  forgotPasswordRules,
  resetPasswordRules,
  placeOrderRules,
};
