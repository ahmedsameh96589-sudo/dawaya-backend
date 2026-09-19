const mongoose = require("mongoose");
const slugify = require("slugify");

const subcategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true },
    nameAr: { type: String, trim: true },
    slug: { type: String },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    description: { type: String },
    descriptionAr: { type: String },
    image: { type: String, default: "default-subcategory.png" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

subcategorySchema.index({ slug: 1, category: 1 }, { unique: true });

subcategorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// مهم للـ Seeder
subcategorySchema.pre("insertMany", function (next, docs) {
  docs.forEach((doc) => {
    if (doc.name) {
      doc.slug = slugify(doc.name, { lower: true, strict: true });
    }
  });
  next();
});

module.exports = mongoose.model("Subcategory", subcategorySchema);
