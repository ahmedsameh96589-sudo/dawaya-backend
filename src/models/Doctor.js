const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const doctorSchema = new mongoose.Schema(
  {
    name:           { type: String, required: [true, "Name is required"], trim: true },
    nameAr:         { type: String, trim: true },
    email:          { type: String, required: [true, "Email is required"], unique: true, lowercase: true },
    phone:          { type: String, required: [true, "Phone is required"], unique: true },
    password:       { type: String, required: [true, "Password is required"], minlength: 6, select: false },
    avatar:         { type: String, default: "default-doctor.png" },

    specialty:      { type: String, required: [true, "Specialty is required"] }, // e.g. "Pharmacist", "General Physician"
    specialtyAr:    { type: String },
    bio:            { type: String },
    bioAr:          { type: String },

    experience:     { type: Number, default: 0 },   // years
    qualifications: [String],                         // e.g. ["MD", "PhD"]
    languages:      { type: [String], default: ["Arabic"] },

    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count:   { type: Number, default: 0 },
    },

    consultationFee: { type: Number, default: 0 },   // 0 = free

    isAvailable:    { type: Boolean, default: true },  // online/offline toggle
    isActive:       { type: Boolean, default: true },
    isVerified:     { type: Boolean, default: false },

    // Working hours
    workingHours: {
      from: { type: String, default: "09:00" },
      to:   { type: String, default: "21:00" },
    },

    totalConsultations: { type: Number, default: 0 },
    lastSeenAt:         { type: Date },
    fcmToken:           { type: String, select: false },
  },
  { timestamps: true }
);

// Ensure rating subdocument exists before save
doctorSchema.pre("save", function (next) {
  if (!this.rating) {
    this.rating = { average: 0, count: 0 };
  } else {
    if (this.rating.average == null || Number.isNaN(this.rating.average)) this.rating.average = 0;
    if (this.rating.count == null || Number.isNaN(this.rating.count)) this.rating.count = 0;
  }
  next();
});

// Hash password before save
doctorSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

doctorSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("Doctor", doctorSchema);
