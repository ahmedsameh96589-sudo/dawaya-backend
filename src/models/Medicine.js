const mongoose = require("mongoose");
const slugify = require("slugify");

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true },
    nameAr: { type: String, trim: true },
    slug: { type: String, unique: true },

    // Subtitle — short tagline shown under the medicine name
    subtitle: { type: String, trim: true, maxlength: 150 },
    subtitleAr: { type: String, trim: true, maxlength: 150 },

    description: { type: String },
    descriptionAr: { type: String },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: "Subcategory" },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },

    activeIngredient: { type: String },
    dosageForm: {
      type: String,
      enum: [
        "tablet",
        "capsule",
        "syrup",
        "injection",
        "cream",
        "drops",
        "spray",
        "powder",
        "other",
      ],
    },
    strength: { type: String },
    packageSize: { type: String },
    usageInstructions: { type: String },
    sideEffects: [String],
    storageConditions: { type: String },

    price: { type: Number, required: [true, "Price is required"], min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, default: 0, min: 0 },
    sku: { type: String, unique: true, sparse: true },
    images: [String],

    requiresPrescription: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },

    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },

    // Manually pinned alternatives — admin can set these explicitly
    manualAlternatives: [
      {
        medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" },
        note: { type: String }, // English note e.g. "Cheaper option"
        noteAr: { type: String }, // Arabic note  e.g. "خيار أرخص"
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
medicineSchema.index({
  name: "text",
  nameAr: "text",
  activeIngredient: "text",
  subtitle: "text",
});
medicineSchema.index({ category: 1, subcategory: 1, brand: 1, price: 1 });

// Virtual: final price after discount
medicineSchema.virtual("finalPrice").get(function () {
  if (!this.discountPercent) return this.price;
  return parseFloat(
    (this.price - (this.price * this.discountPercent) / 100).toFixed(2),
  );
});

// Virtual: stock status
medicineSchema.virtual("inStock").get(function () {
  return this.stock > 0;
});

// Auto-generate slug on name change
medicineSchema.pre("save", function (next) {
  if (this.isModified("name"))
    this.slug = slugify(this.name + "-" + Date.now(), {
      lower: true,
      strict: true,
    });
  next();
});

// ✅ Important: Auto-generate slug for insertMany (Seeder)
medicineSchema.pre("insertMany", function (next, docs) {
  docs.forEach((doc) => {
    if (doc.name) {
      doc.slug = slugify(doc.name + "-" + Date.now(), {
        lower: true,
        strict: true,
      });
    }
  });
  next();
});

module.exports = mongoose.model("Medicine", medicineSchema);
