const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

// ─── Address sub-schema ───────────────────────────────────────
const addressSchema = new mongoose.Schema({
  label:       { type: String, default: "Home" },
  street:      { type: String, required: true },
  building:    { type: String },
  floor:       { type: String },
  apartment:   { type: String },
  city:        { type: String, required: true },
  district:    { type: String },
  postalCode:  { type: String },
  coordinates: { lat: Number, lng: Number },
  isDefault:   { type: Boolean, default: false },
});

// ─── User schema ──────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: [true, "Name is required"],     trim: true },
    email:    { type: String, required: [true, "Email is required"],    unique: true, lowercase: true, trim: true },
    phone:    { type: String, unique: true, sparse: true },
    password: { type: String, minlength: 6, select: false },
    avatar:   { type: String, default: "default-avatar.png" },
    role:     { type: String, enum: ["user", "admin"], default: "user" },
    gender:   { type: String, enum: ["male", "female", "other"] },
    dateOfBirth: { type: Date },
    language:    { type: String, enum: ["en", "ar"], default: "en" },

    addresses: [addressSchema],

    // ── Account status ──────────────────────────────────────
    isActive:   { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },  // email/phone verified

    // ── Email OTP (verification & login 2FA) ────────────────
    emailOtp:        { type: String, select: false },  // hashed
    emailOtpExpires: { type: Date,   select: false },
    emailOtpPurpose: {
      type: String,
      enum: ["verification", "forgot_password", "login"],
      select: false,
    },

    // ── Phone OTP ───────────────────────────────────────────
    phoneOtp:        { type: String, select: false },  // hashed
    phoneOtpExpires: { type: Date,   select: false },
    phoneOtpPurpose: {
      type: String,
      enum: ["verification", "forgot_password", "login"],
      select: false,
    },

    // ── Reset password token (link-based) ───────────────────
    resetPasswordToken:   { type: String, select: false },  // hashed
    resetPasswordExpires: { type: Date,   select: false },

    // ── Google OAuth ─────────────────────────────────────────
    googleId:     { type: String, unique: true, sparse: true },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },

    // ── Push notifications ──────────────────────────────────
    fcmToken: { type: String, select: false },

    // ── Misc ────────────────────────────────────────────────
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// ─── Hash password before save ────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Instance methods ─────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
