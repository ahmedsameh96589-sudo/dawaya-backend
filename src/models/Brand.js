const mongoose = require("mongoose");
const slugify = require("slugify");

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      unique: true,
    },
    nameAr: { type: String, trim: true },
    slug: { type: String, unique: true },
    logo: { type: String, default: "default-brand.png" },
    description: { type: String },
    country: { type: String },
    website: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

brandSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// مهم للـ Seeder
brandSchema.pre("insertMany", function (next, docs) {
  docs.forEach((doc) => {
    if (doc.name) {
      doc.slug = slugify(doc.name, { lower: true, strict: true });
    }
  });
  next();
});

module.exports = mongoose.model("Brand", brandSchema);
