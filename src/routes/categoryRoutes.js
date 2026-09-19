const express = require("express");
const router  = express.Router();
const c       = require("../controllers/categoryController");
const { protect, restrictTo } = require("../middlewares/auth");
const upload  = require("../middlewares/upload");

// ── Categories ────────────────────────────────────────────────
router.get("/",    c.getCategories);
router.get("/:id", c.getCategory);
router.post("/",          protect, restrictTo("admin"), upload.single("image"), c.createCategory);
router.put("/:id",        protect, restrictTo("admin"), upload.single("image"), c.updateCategory);
router.delete("/:id",     protect, restrictTo("admin"), c.deleteCategory);

// ── Subcategories  (nested & flat) ────────────────────────────
router.get("/:categoryId/subcategories", c.getSubcategories);

module.exports = router;
