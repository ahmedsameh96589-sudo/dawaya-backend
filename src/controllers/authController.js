const crypto  = require("crypto");
const User    = require("../models/User");
const Doctor  = require("../models/Doctor");
const { sendToken }             = require("../utils/jwt");
const { generateOTP, generateResetToken, hashOTP, otpExpiresAt } = require("../utils/otp");
const { sendOTPEmail, sendResetPasswordEmail } = require("../utils/email");
const { sendOTPSMS }            = require("../utils/sms");

// ─── Helper: send OTP via both email & SMS ────────────────────
const dispatchOTP = async (user, purpose) => {
  const otp        = generateOTP();
  const hashedOtp  = hashOTP(otp);
  const expiresAt  = otpExpiresAt();

  user.emailOtp        = hashedOtp;
  user.emailOtpExpires = expiresAt;
  user.emailOtpPurpose = purpose;
  user.phoneOtp        = hashedOtp;
  user.phoneOtpExpires = expiresAt;
  user.phoneOtpPurpose = purpose;

  await user.save({ validateBeforeSave: false });

  // Fire both — don't block on failure
  await Promise.allSettled([
    sendOTPEmail(user.email, otp, purpose),
    sendOTPSMS(user.phone, otp, purpose),
  ]);

  return otp; // returned only for dev convenience
};

// ═══════════════════════════════════════════════════════════════
//  1. REGISTER
//  POST /api/auth/register
//  Body: { name, email, phone, password, language? }
// ═══════════════════════════════════════════════════════════════
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password, language } = req.body;

    // Check duplicates
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      const field = existing.email === email ? "Email" : "Phone number";
      return res.status(400).json({ success: false, message: `${field} is already registered.` });
    }

    // Create user (unverified)
    const user = await User.create({ name, email, phone, password, language, isVerified: false });

    // Send verification OTP
    await dispatchOTP(user, "verification");

    res.status(201).json({
      success: true,
      message: "Registration successful. An OTP has been sent to your email and phone. Please verify your account.",
      data:    { userId: user._id, email: user.email, phone: user.phone },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  2. VERIFY OTP  (works for: registration, forgot password, login 2FA)
//  POST /api/auth/verify-otp
//  Body: { userId, otp, purpose }
//  purpose: "verification" | "forgot_password" | "login"
// ═══════════════════════════════════════════════════════════════
exports.verifyOTP = async (req, res, next) => {
  try {
    const { userId, otp, purpose } = req.body;

    if (!userId || !otp || !purpose)
      return res.status(400).json({ success: false, message: "userId, otp, and purpose are required." });

    const user = await User.findById(userId)
      .select("+emailOtp +emailOtpExpires +emailOtpPurpose +phoneOtp +phoneOtpExpires +phoneOtpPurpose");

    if (!user)
      return res.status(404).json({ success: false, message: "User not found." });

    const hashedInput = hashOTP(otp);

    // Validate OTP (email or phone — whichever matches)
    const emailMatch = user.emailOtp === hashedInput &&
                       user.emailOtpPurpose === purpose &&
                       user.emailOtpExpires > Date.now();

    const phoneMatch = user.phoneOtp === hashedInput &&
                       user.phoneOtpPurpose === purpose &&
                       user.phoneOtpExpires > Date.now();

    if (!emailMatch && !phoneMatch) {
      // Check if OTP is correct but expired
      const otpCorrectButExpired =
        (user.emailOtp === hashedInput && user.emailOtpExpires <= Date.now()) ||
        (user.phoneOtp === hashedInput && user.phoneOtpExpires <= Date.now());

      return res.status(400).json({
        success: false,
        message: otpCorrectButExpired
          ? "OTP has expired. Please request a new one."
          : "Invalid OTP. Please check and try again.",
      });
    }

    // ── Clear OTP fields ──────────────────────────────────────
    user.emailOtp        = undefined;
    user.emailOtpExpires = undefined;
    user.emailOtpPurpose = undefined;
    user.phoneOtp        = undefined;
    user.phoneOtpExpires = undefined;
    user.phoneOtpPurpose = undefined;

    // ── Handle each purpose ───────────────────────────────────
    if (purpose === "verification") {
      user.isVerified = true;
      await user.save({ validateBeforeSave: false });
      return sendToken(user, 200, res, "Account verified successfully. Welcome to DAWAYA!");
    }

    if (purpose === "login") {
      user.lastLoginAt = new Date();
      await user.save({ validateBeforeSave: false });
      return sendToken(user, 200, res, "Login successful.");
    }

    if (purpose === "forgot_password") {
      // Issue a short-lived reset token so user can now call reset-password
      const { raw, hashed } = generateResetToken();
      user.resetPasswordToken   = hashed;
      user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      await user.save({ validateBeforeSave: false });

      return res.status(200).json({
        success: true,
        message: "OTP verified. Use the resetToken to set your new password.",
        data:    { resetToken: raw },
      });
    }

    await user.save({ validateBeforeSave: false });
    res.status(200).json({ success: true, message: "OTP verified." });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  3. RESEND OTP
//  POST /api/auth/resend-otp
//  Body: { userId, purpose }
// ═══════════════════════════════════════════════════════════════
exports.resendOTP = async (req, res, next) => {
  try {
    const { userId, purpose } = req.body;

    const user = await User.findById(userId)
      .select("+emailOtpExpires");

    if (!user)
      return res.status(404).json({ success: false, message: "User not found." });

    // Throttle: prevent spam (must wait at least 1 minute between resends)
    if (user.emailOtpExpires) {
      const minutesLeft = (user.emailOtpExpires - Date.now()) / 1000 / 60;
      const totalMinutes = parseInt(process.env.OTP_EXPIRES_MINUTES) || 10;
      if (minutesLeft > totalMinutes - 1) {
        return res.status(429).json({
          success: false,
          message: "Please wait at least 1 minute before requesting a new OTP.",
        });
      }
    }

    await dispatchOTP(user, purpose);

    res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your email and phone.",
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  4. LOGIN
//  POST /api/auth/login
//  Body: { email, password }
//  Flow: credentials → send OTP → user verifies via /verify-otp (purpose: "login")
// ═══════════════════════════════════════════════════════════════
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password are required." });

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (user && (await user.comparePassword(password))) {
      if (!user.isActive)
        return res.status(403).json({ success: false, message: "Your account has been deactivated. Contact support." });

      if (!user.isVerified)
        return res.status(403).json({
          success: false,
          message: "Account not verified. Please verify your account first.",
          data: { userId: user._id, needsVerification: true },
        });

      // Send login OTP for 2FA
      await dispatchOTP(user, "login");

      return res.status(200).json({
        success: true,
        message: "Credentials verified. An OTP has been sent to your email and phone to complete login.",
        data:    { userId: user._id, accountType: "user" },
      });
    }

    // Doctors live in a separate collection (created via admin panel)
    const doctor = await Doctor.findOne({ email: normalizedEmail }).select("+password");

    if (doctor && (await doctor.comparePassword(password))) {
      if (!doctor.isActive)
        return res.status(403).json({ success: false, message: "Account deactivated. Contact admin." });

      doctor.lastSeenAt = new Date();
      await doctor.save({ validateBeforeSave: false });

      const jwt   = require("jsonwebtoken");
      const token = jwt.sign(
        { id: doctor._id, role: "doctor" },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      return res.status(200).json({
        success: true,
        message: "Doctor login successful.",
        token,
        data: {
          userId:      doctor._id,
          role:        "doctor",
          accountType: "doctor",
          name:        doctor.name,
        },
      });
    }

    return res.status(401).json({ success: false, message: "Invalid email or password." });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  5. FORGOT PASSWORD
//  POST /api/auth/forgot-password
//  Body: { email }
//  Flow A (OTP):  sends OTP → verify via /verify-otp (purpose: "forgot_password") → /reset-password
//  Flow B (Link): sends a reset link to email directly
// ═══════════════════════════════════════════════════════════════
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, message: "Email is required." });

    const user = await User.findOne({ email });

    // Always respond 200 to prevent email enumeration
    if (!user)
      return res.status(200).json({ success: true, message: "If this email is registered, a reset link has been sent." });

    // Generate reset token & save hashed version
    const { raw, hashed } = generateResetToken();
    user.resetPasswordToken   = hashed;
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await user.save({ validateBeforeSave: false });

    // Also send OTP (both methods)
    await dispatchOTP(user, "forgot_password");

    // Build reset URL for email link
    const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${raw}&id=${user._id}`;
    await sendResetPasswordEmail(user.email, resetURL);

    res.status(200).json({
      success: true,
      message: "A password reset link and OTP have been sent to your email and phone.",
      // Only expose in development
      ...(process.env.NODE_ENV === "development" && { resetToken: raw, userId: user._id }),
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  6. RESET PASSWORD  (via token from email link)
//  POST /api/auth/reset-password
//  Body: { userId, resetToken, newPassword }
// ═══════════════════════════════════════════════════════════════
exports.resetPassword = async (req, res, next) => {
  try {
    const { userId, resetToken, newPassword } = req.body;

    if (!userId || !resetToken || !newPassword)
      return res.status(400).json({ success: false, message: "userId, resetToken, and newPassword are required." });

    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });

    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    const user = await User.findOne({
      _id:                  userId,
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user)
      return res.status(400).json({ success: false, message: "Reset token is invalid or has expired." });

    // Set new password & clear token
    user.password             = newPassword;
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ success: true, message: "Password reset successfully. You can now login." });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  7. GET MY PROFILE
//  GET /api/auth/me
// ═══════════════════════════════════════════════════════════════
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  8. UPDATE MY PROFILE
//  PUT /api/auth/me
// ═══════════════════════════════════════════════════════════════
exports.updateMe = async (req, res, next) => {
  try {
    const { name, phone, gender, dateOfBirth, language } = req.body;
    const updates = { name, phone, gender, dateOfBirth, language };
    if (req.file) updates.avatar = req.file.filename;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  9. CHANGE PASSWORD  (while logged in)
//  PUT /api/auth/change-password
//  Body: { currentPassword, newPassword }
// ═══════════════════════════════════════════════════════════════
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ success: false, message: "Current password is incorrect." });

    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });

    user.password = newPassword;
    await user.save();

    sendToken(user, 200, res, "Password changed successfully.");
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  ADDRESS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /api/auth/addresses
exports.getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("addresses");
    res.status(200).json({ success: true, data: { addresses: user.addresses } });
  } catch (err) { next(err); }
};

// POST /api/auth/addresses
exports.addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
    if (user.addresses.length === 0) req.body.isDefault = true;
    user.addresses.push(req.body);
    await user.save();
    res.status(201).json({ success: true, data: { addresses: user.addresses } });
  } catch (err) { next(err); }
};

// PUT /api/auth/addresses/:addressId
exports.updateAddress = async (req, res, next) => {
  try {
    const user    = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ success: false, message: "Address not found." });
    if (req.body.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
    Object.assign(address, req.body);
    await user.save();
    res.status(200).json({ success: true, data: { addresses: user.addresses } });
  } catch (err) { next(err); }
};

// DELETE /api/auth/addresses/:addressId
exports.deleteAddress = async (req, res, next) => {
  try {
    const user    = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ success: false, message: "Address not found." });
    address.deleteOne();
    await user.save();
    res.status(200).json({ success: true, message: "Address deleted.", data: { addresses: user.addresses } });
  } catch (err) { next(err); }
};

// PUT /api/auth/addresses/:addressId/set-default
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses.forEach((a) => (a.isDefault = a._id.toString() === req.params.addressId));
    await user.save();
    res.status(200).json({ success: true, data: { addresses: user.addresses } });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
//  GOOGLE OAUTH
//  POST /api/auth/google
//  Body: { idToken }  ← الـ ID Token الجاي من Flutter Google Sign-In
// ═══════════════════════════════════════════════════════════════
exports.googleAuth = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken)
      return res.status(400).json({ success: false, message: "Google ID token is required." });

    // ── Verify token with Google ───────────────────────────────
    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ success: false, message: "Invalid or expired Google token." });
    }

    const { sub: googleId, email, name, picture, email_verified } = payload;

    if (!email_verified)
      return res.status(400).json({ success: false, message: "Google email is not verified." });

    // ── Find or Create user ────────────────────────────────────
    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    let isNewUser = false;

    if (user) {
      // مستخدم موجود — ربط Google ID لو مش مربوط
      if (!user.googleId) {
        user.googleId     = googleId;
        user.authProvider = "google";
        user.isVerified   = true;
        if (picture && user.avatar === "default-avatar.png") user.avatar = picture;
        await user.save({ validateBeforeSave: false });
      }

      if (!user.isActive)
        return res.status(403).json({ success: false, message: "Account is deactivated. Contact support." });

    } else {
      // مستخدم جديد — تسجيل تلقائي عن طريق Google
      isNewUser = true;
      user = await User.create({
        name,
        email,
        googleId,
        avatar:       picture || "default-avatar.png",
        authProvider: "google",
        isVerified:   true,   // Google users auto-verified
        isActive:     true,
      });
    }

    // تحديث آخر تسجيل دخول
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    sendToken(
      user,
      isNewUser ? 201 : 200,
      res,
      isNewUser
        ? "Account created successfully with Google. Welcome to DAWAYA! 🎉"
        : "Login with Google successful."
    );

  } catch (err) { next(err); }
};
