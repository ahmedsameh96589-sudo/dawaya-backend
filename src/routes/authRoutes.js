const express  = require("express");
const router   = express.Router();
const auth     = require("../controllers/authController");
const { protect } = require("../middlewares/auth");
const upload   = require("../middlewares/upload");
const {
  validate, registerRules, loginRules,
  verifyOTPRules, forgotPasswordRules, resetPasswordRules,
} = require("../middlewares/validate");

// ── Public ────────────────────────────────────────────────────
router.post("/register",          registerRules,       validate, auth.register);
router.post("/login",             loginRules,          validate, auth.login);
router.post("/google",                                           auth.googleAuth);
router.post("/verify-otp",        verifyOTPRules,      validate, auth.verifyOTP);
router.post("/resend-otp",                                       auth.resendOTP);
router.post("/forgot-password",   forgotPasswordRules, validate, auth.forgotPassword);
router.post("/reset-password",    resetPasswordRules,  validate, auth.resetPassword);

// ── Private ───────────────────────────────────────────────────
router.get("/me",                 protect,                       auth.getMe);
router.put("/me",                 protect, upload.single("avatar"), auth.updateMe);
router.put("/change-password",    protect,                       auth.changePassword);

// ── Addresses ─────────────────────────────────────────────────
router.get("/addresses",                   protect, auth.getAddresses);
router.post("/addresses",                  protect, auth.addAddress);
router.put("/addresses/:addressId",        protect, auth.updateAddress);
router.delete("/addresses/:addressId",     protect, auth.deleteAddress);
router.put("/addresses/:addressId/set-default", protect, auth.setDefaultAddress);

module.exports = router;
