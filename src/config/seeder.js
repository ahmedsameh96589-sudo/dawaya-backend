const mongoose  = require("mongoose");
require("dotenv").config();

const User        = require("../models/User");
const Category    = require("../models/Category");
const Subcategory = require("../models/Subcategory");
const Brand       = require("../models/Brand");
const Medicine    = require("../models/Medicine");

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Clear collections
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Subcategory.deleteMany({}),
    Brand.deleteMany({}),
    Medicine.deleteMany({}),
  ]);
  console.log("🗑  Collections cleared");

  // ── Admin user ──────────────────────────────────────────────
  await User.create({
    name: "DAWAYA Admin", email: "admin@dawaya.com",
    phone: "01000000000", password: "Admin@1234",
    role: "admin", isVerified: true,
  });
  console.log("👤 Admin created — admin@dawaya.com / Admin@1234");

  // ── Sample user ─────────────────────────────────────────────
  await User.create({
    name: "Ahmed Sameh", email: "ahmed@example.com",
    phone: "01012345678", password: "User@1234",
    role: "user", isVerified: true,
  });
  console.log("👤 Sample user created — ahmed@example.com / User@1234");

  // ── Categories ──────────────────────────────────────────────
  const categories = await Category.insertMany([
    { name: "Pain Relief",            nameAr: "مسكنات الألم",         sortOrder: 1 },
    { name: "Antibiotics",            nameAr: "مضادات حيوية",         sortOrder: 2 },
    { name: "Vitamins & Supplements", nameAr: "فيتامينات ومكملات",    sortOrder: 3 },
    { name: "Chronic Disease",        nameAr: "أمراض مزمنة",          sortOrder: 4 },
    { name: "Skin Care",              nameAr: "العناية بالبشرة",       sortOrder: 5 },
    { name: "Cosmetics",              nameAr: "مستحضرات التجميل",      sortOrder: 6 },
  ]);
  console.log(`📂 ${categories.length} categories created`);

  // ── Subcategories ────────────────────────────────────────────
  const subcategories = await Subcategory.insertMany([
    // Pain Relief
    { name: "Headache",        nameAr: "صداع",               category: categories[0]._id },
    { name: "Muscle Pain",     nameAr: "آلام العضلات",        category: categories[0]._id },
    { name: "Fever",           nameAr: "حمى",                 category: categories[0]._id },
    // Antibiotics
    { name: "Broad Spectrum",  nameAr: "واسع المجال",         category: categories[1]._id },
    { name: "Penicillin",      nameAr: "بنسيلين",             category: categories[1]._id },
    // Vitamins
    { name: "Vitamin C",       nameAr: "فيتامين سي",          category: categories[2]._id },
    { name: "Vitamin D",       nameAr: "فيتامين د",           category: categories[2]._id },
    // Chronic Disease
    { name: "Diabetes",        nameAr: "السكري",              category: categories[3]._id },
    { name: "Hypertension",    nameAr: "ارتفاع الضغط",        category: categories[3]._id },
    // Skin Care
    { name: "Moisturizers",    nameAr: "مرطبات",              category: categories[4]._id },
    // Cosmetics  (indices 10–15)
    { name: "Face Makeup",     nameAr: "مكياج الوجه",         category: categories[5]._id },
    { name: "Lip Products",    nameAr: "منتجات الشفاه",       category: categories[5]._id },
    { name: "Eye Makeup",      nameAr: "مكياج العيون",        category: categories[5]._id },
    { name: "Perfumes",        nameAr: "عطور",                category: categories[5]._id },
    { name: "Hair Care",       nameAr: "العناية بالشعر",      category: categories[5]._id },
    { name: "Nail Care",       nameAr: "العناية بالأظافر",    category: categories[5]._id },
  ]);
  console.log(`📂 ${subcategories.length} subcategories created`);

  // ── Brands ───────────────────────────────────────────────────
  const brands = await Brand.insertMany([
    { name: "GSK",         nameAr: "جي إس كيه",        country: "UK" },
    { name: "Pharco",      nameAr: "فاركو",             country: "Egypt" },
    { name: "Julphar",     nameAr: "جولفار",            country: "UAE" },
    { name: "Merck",       nameAr: "ميرك",              country: "Germany" },
    { name: "Abbott",      nameAr: "أبوت",              country: "USA" },
    { name: "Amriya",      nameAr: "أمرية",             country: "Egypt" },
    // Cosmetics brands (indices 6–10)
    { name: "L'Oréal",     nameAr: "لوريال",            country: "France" },
    { name: "Maybelline",  nameAr: "ميبلين",            country: "USA" },
    { name: "Nivea",       nameAr: "نيفيا",             country: "Germany" },
    { name: "MAC",         nameAr: "ماك",               country: "USA" },
    { name: "Garnier",     nameAr: "جارنييه",           country: "France" },
  ]);
  console.log(`🏷  ${brands.length} brands created`);

  // ── Medicines ────────────────────────────────────────────────
  const medicines = [
    // ── Pain Relief ─────────────────────────────────────────
    {
      name: "Panadol",
      nameAr: "بنادول",
      activeIngredient: "Paracetamol",
      category: categories[0]._id,
      subcategory: subcategories[2]._id,
      brand: brands[0]._id,
      dosageForm: "tablet",
      strength: "500mg",
      price: 15,
      stock: 200,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: true,
      images: [
        "https://cdn11.bigcommerce.com/s-vhzbg5/images/stencil/1280x1280/products/1687/4607/apiifop6i__35317.1499347716.jpg?c=2",
      ],
    },
    {
      name: "Adol",
      nameAr: "أدول",
      activeIngredient: "Paracetamol",
      category: categories[0]._id,
      subcategory: subcategories[2]._id,
      brand: brands[2]._id,
      dosageForm: "tablet",
      strength: "500mg",
      price: 10,
      stock: 150,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://cdn.shortpixel.ai/spai/q_lossy+ret_img+to_auto/https://elshazlypharmacy.com/wp-content/uploads/2023/12/adol-sinus-24-caplets-4zti-01678612271.webp",
      ],
    },
    {
      name: "Cetal",
      nameAr: "سيتال",
      activeIngredient: "Paracetamol",
      category: categories[0]._id,
      subcategory: subcategories[2]._id,
      brand: brands[5]._id,
      dosageForm: "tablet",
      strength: "500mg",
      price: 8,
      stock: 100,
      discountPercent: 10,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://anwar.store/cdn/shop/files/images_9bf861bd-0602-4166-bfe9-d31e70d4d4c2.jpg?v=1733745573",
      ],
    },
    {
      name: "Brufen",
      nameAr: "بروفين",
      activeIngredient: "Ibuprofen",
      category: categories[0]._id,
      subcategory: subcategories[1]._id,
      brand: brands[4]._id,
      dosageForm: "tablet",
      strength: "400mg",
      price: 22,
      stock: 80,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: true,
      images: [
        "https://media.zid.store/thumbs/4c4bc3af-e1aa-43ea-aab7-eeeb6bc4f5dc/dbdf00cb-acca-4baf-92be-2f3ec17ebd93-thumbnail-1000x1000.png",
      ],
    },
    // ── Antibiotics ─────────────────────────────────────────
    {
      name: "Amoxil",
      nameAr: "أموكسيل",
      activeIngredient: "Amoxicillin",
      category: categories[1]._id,
      subcategory: subcategories[3]._id,
      brand: brands[0]._id,
      dosageForm: "capsule",
      strength: "500mg",
      price: 35,
      stock: 60,
      discountPercent: 0,
      requiresPrescription: true,
      isFeatured: false,
      images: [
        "https://almasrypharmacy.com/media/catalog/product/cache/0/0/0004541_amoxil-capsule-500mg-10s_550_2.png",
      ],
    },
    {
      name: "Augmentin",
      nameAr: "أوجمنتين",
      activeIngredient: "Amoxicillin/Clavulanate",
      category: categories[1]._id,
      subcategory: subcategories[3]._id,
      brand: brands[0]._id,
      dosageForm: "tablet",
      strength: "625mg",
      price: 55,
      stock: 40,
      discountPercent: 0,
      requiresPrescription: true,
      isFeatured: false,
      images: [
        "https://cdn.salla.sa/aeogjR/6ddcebfd-dfd0-4e8f-b6a3-3f5f2d4efd28-1000x1000-9HYzZlUSQxFJEM1XkW49PwUkl2nWwNf0pn5qhrBG.jpg",
      ],
    },
    // ── Vitamins ─────────────────────────────────────────────
    {
      name: "Vitamin C 1000",
      nameAr: "فيتامين سي",
      activeIngredient: "Ascorbic Acid",
      category: categories[2]._id,
      subcategory: subcategories[5]._id,
      brand: brands[1]._id,
      dosageForm: "tablet",
      strength: "1000mg",
      price: 18,
      stock: 300,
      discountPercent: 5,
      requiresPrescription: false,
      isFeatured: true,
      images: [
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT3xQSBWSecJk11K-WtI_rQE7RIFZFk2ltcUA&s",
      ],
    },
    {
      name: "D-Pearls",
      nameAr: "دي بيرلز",
      activeIngredient: "Vitamin D3",
      category: categories[2]._id,
      subcategory: subcategories[6]._id,
      brand: brands[3]._id,
      dosageForm: "capsule",
      strength: "1000IU",
      price: 45,
      stock: 90,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://m.media-amazon.com/images/I/61CJUNQc2lL._AC_UF894,1000_QL80_.jpg",
      ],
    },
    // ── Chronic Disease ──────────────────────────────────────
    {
      name: "Glucophage",
      nameAr: "جلوكوفاج",
      activeIngredient: "Metformin",
      category: categories[3]._id,
      subcategory: subcategories[7]._id,
      brand: brands[3]._id,
      dosageForm: "tablet",
      strength: "500mg",
      price: 25,
      stock: 70,
      discountPercent: 0,
      requiresPrescription: true,
      isFeatured: false,
      images: [
        "https://onehealth.pk/cdn/shop/files/Glucophage_500mg_5x10_Tablets_1000x.jpg?v=1741942717",
      ],
    },
    {
      name: "Concor",
      nameAr: "كونكور",
      activeIngredient: "Bisoprolol",
      category: categories[3]._id,
      subcategory: subcategories[8]._id,
      brand: brands[3]._id,
      dosageForm: "tablet",
      strength: "5mg",
      price: 40,
      stock: 50,
      discountPercent: 0,
      requiresPrescription: true,
      isFeatured: false,
      images: [
        "https://assetpharmacy.com/wp-content/uploads/2017/09/Concor-5mg-Bisoprolol-Fumarate-5mg-Tablets-30-Tablets-1.jpg",
      ],
    },
    // ── Skin Care ────────────────────────────────────────────
    {
      name: "Cetaphil",
      nameAr: "سيتافيل",
      activeIngredient: "Glycerin",
      category: categories[4]._id,
      subcategory: subcategories[9]._id,
      brand: brands[4]._id,
      dosageForm: "cream",
      strength: "N/A",
      price: 120,
      stock: 35,
      discountPercent: 15,
      requiresPrescription: false,
      isFeatured: true,
      images: [
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTEsZmzceGIs8HnHi3TPonJNkvBoJM0GO-VPA&s",
      ],
    },

    // ── Cosmetics ────────────────────────────────────────────

    // Face Makeup (subcategory index 10)
    {
      name: "L'Oréal True Match Foundation",
      nameAr: "كريم أساس لوريال ترو ماتش",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[10]._id,
      brand: brands[6]._id,
      dosageForm: "syrup",
      strength: "N/A",
      price: 180,
      stock: 60,
      discountPercent: 10,
      requiresPrescription: false,
      isFeatured: true,
      images: [
        "https://th.bing.com/th/id/OIP.G2JArFXdGKDX0Or4YDIilAHaJp?w=139&h=182&c=7&r=0&o=7&dpr=1.3&pid=1.7&rm=3",
      ],
    },
    {
      name: "Maybelline Fit Me Foundation",
      nameAr: "كريم أساس ميبلين فيت مي",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[10]._id,
      brand: brands[7]._id,
      dosageForm: "syrup",
      strength: "N/A",
      price: 150,
      stock: 75,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://www.maybelline.com/~/media/mny/us/face-makeup/foundation/fit-me-matte-poreless-foundation/maybelline-fit-me-matte-poreless-foundation-packaging.jpg",
      ],
    },
    {
      name: "Garnier BB Cream",
      nameAr: "كريم بي بي جارنييه",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[10]._id,
      brand: brands[10]._id,
      dosageForm: "cream",
      strength: "N/A",
      price: 95,
      stock: 90,
      discountPercent: 5,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://www.garnier.com.eg/-/media/project/loreal/brand-sites/garnier/emea/eg/products/skin-care/bb-cream/garnier-skin-naturals-bb-cream.jpg",
      ],
    },

    // Lip Products (subcategory index 11)
    {
      name: "MAC Ruby Woo Lipstick",
      nameAr: "أحمر شفاه ماك روبي وو",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[11]._id,
      brand: brands[9]._id,
      dosageForm: "cream",
      strength: "N/A",
      price: 320,
      stock: 45,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: true,
      images: [
        "https://www.maccosmetics.com/media/export/cms/products/640x600/mac_sku_MF9U01_640x600_0.jpg",
      ],
    },
    {
      name: "Maybelline SuperStay Lip Gloss",
      nameAr: "جلوس شفاه ميبلين سوبر ستاي",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[11]._id,
      brand: brands[7]._id,
      dosageForm: "syrup",
      strength: "N/A",
      price: 110,
      stock: 80,
      discountPercent: 10,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://www.maybelline.com/~/media/mny/us/lip-makeup/lip-gloss/superstay-vinyl-ink/maybelline-superstay-vinyl-ink-lip-gloss-packaging.jpg",
      ],
    },

    // Eye Makeup (subcategory index 12)
    {
      name: "L'Oréal Telescopic Mascara",
      nameAr: "ماسكارا لوريال تيليسكوبيك",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[12]._id,
      brand: brands[6]._id,
      dosageForm: "syrup",
      strength: "N/A",
      price: 135,
      stock: 100,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: true,
      images: [
        "https://www.loreal-paris.com.eg/-/media/project/loreal/brand-sites/oap/emea/eg/products/makeup/eye/mascara/telescopic-original-mascara/loreal-paris-eye-telescopic-mascara-black-000-3600523393015-front.jpg",
      ],
    },
    {
      name: "Maybelline Eyebrow Pencil",
      nameAr: "قلم حواجب ميبلين",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[12]._id,
      brand: brands[7]._id,
      dosageForm: "cream",
      strength: "N/A",
      price: 85,
      stock: 120,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://www.maybelline.com/~/media/mny/us/eye-makeup/brows/brow-ultra-slim-defining-eyebrow-pencil/maybelline-brow-ultra-slim-eyebrow-pencil-packaging.jpg",
      ],
    },

    // Perfumes (subcategory index 13)
    {
      name: "L'Oréal Paradise Garden EDP",
      nameAr: "عطر لوريال باراديس جاردن",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[13]._id,
      brand: brands[6]._id,
      dosageForm: "spray",
      strength: "50ml",
      price: 450,
      stock: 30,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://www.loreal-paris.com.eg/-/media/project/loreal/brand-sites/oap/emea/eg/products/fragrance/paradise-garden/loreal-paris-fragrance-paradise-garden-edp-50ml.jpg",
      ],
    },
    {
      name: "Nivea Black & White Deodorant",
      nameAr: "مزيل عرق نيفيا بلاك آند وايت",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[13]._id,
      brand: brands[8]._id,
      dosageForm: "spray",
      strength: "150ml",
      price: 75,
      stock: 150,
      discountPercent: 5,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://www.nivea.com.eg/-/media/project/beiersdorf/nivea/mea/eg/products/deodorant/black-and-white/nivea-black-and-white-deodorant-spray-150ml.jpg",
      ],
    },

    // Hair Care (subcategory index 14)
    {
      name: "Garnier Fructis Shampoo",
      nameAr: "شامبو جارنييه فروكتيس",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[14]._id,
      brand: brands[10]._id,
      dosageForm: "syrup",
      strength: "400ml",
      price: 90,
      stock: 110,
      discountPercent: 10,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://www.garnier.com.eg/-/media/project/loreal/brand-sites/garnier/emea/eg/products/hair-care/fructis/garnier-fructis-shampoo-400ml.jpg",
      ],
    },
    {
      name: "Nivea Hair Milk Leave-In Conditioner",
      nameAr: "كريم شعر نيفيا هير ميلك",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[14]._id,
      brand: brands[8]._id,
      dosageForm: "cream",
      strength: "200ml",
      price: 65,
      stock: 85,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://www.nivea.com.eg/-/media/project/beiersdorf/nivea/mea/eg/products/hair/hair-milk/nivea-hair-milk-leave-in-conditioner-200ml.jpg",
      ],
    },

    // Nail Care (subcategory index 15)
    {
      name: "Maybelline SuperStay Nail Polish",
      nameAr: "طلاء أظافر ميبلين سوبر ستاي",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[15]._id,
      brand: brands[7]._id,
      dosageForm: "syrup",
      strength: "10ml",
      price: 55,
      stock: 95,
      discountPercent: 0,
      requiresPrescription: false,
      isFeatured: false,
      images: [
        "https://www.maybelline.com/~/media/mny/us/nail-makeup/nail-color/superstay-7-day-gel-nail-color/maybelline-superstay-7-day-gel-nail-color-packaging.jpg",
      ],
    },
    {
      name: "L'Oréal Color Riche Nail Polish",
      nameAr: "طلاء أظافر لوريال كولور ريش",
      activeIngredient: "N/A",
      category: categories[5]._id,
      subcategory: subcategories[15]._id,
      brand: brands[6]._id,
      dosageForm: "syrup",
      strength: "13ml",
      price: 70,
      stock: 70,
      discountPercent: 15,
      requiresPrescription: false,
      isFeatured: true,
      images: [
        "https://www.loreal-paris.com.eg/-/media/project/loreal/brand-sites/oap/emea/eg/products/makeup/nail/color-riche/loreal-paris-nail-color-riche-nail-polish.jpg",
      ],
    },
  ];

  await Medicine.insertMany(medicines);
  console.log(`💊 ${medicines.length} products created`);

  console.log("\n🌱 Database seeded successfully!\n");
  console.log("─────────────────────────────────────────────────────────────────");
  console.log("  Admin:  admin@dawaya.com / Admin@1234");
  console.log("  User:   ahmed@example.com / User@1234");
  console.log("─────────────────────────────────────────────────────────────────");
  console.log("  Categories:    6  (+ Cosmetics)");
  console.log("  Subcategories: 16 (+ Face Makeup, Lip Products, Eye Makeup,");
  console.log("                      Perfumes, Hair Care, Nail Care)");
  console.log("  Brands:        11 (+ L'Oréal, Maybelline, Nivea, MAC, Garnier)");
  console.log(`  Products:      ${medicines.length}`);
  console.log("─────────────────────────────────────────────────────────────────\n");
  process.exit(0);
};

seed().catch((err) => { console.error("❌ Seeder error:", err); process.exit(1); });