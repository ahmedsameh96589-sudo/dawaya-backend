const mongoose = require("mongoose");
const slugify = require("slugify");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      unique: true,
    },
    nameAr: { type: String, trim: true },
    slug: { type: String, unique: true },
    description: { type: String },
    descriptionAr: { type: String },
    image: { type: String, default: "default-category.png" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

categorySchema.virtual("subcategories", {
  ref: "Subcategory",
  localField: "_id",
  foreignField: "category",
});

categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// مهم للـ Seeder
categorySchema.pre("insertMany", function (next, docs) {
  docs.forEach((doc) => {
    if (doc.name) {
      doc.slug = slugify(doc.name, { lower: true, strict: true });
    }
  });
  next();
});

module.exports = mongoose.model("Category", categorySchema);
