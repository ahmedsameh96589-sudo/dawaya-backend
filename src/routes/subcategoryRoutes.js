const express = require("express");
const router  = express.Router();
const c       = require("../controllers/categoryController");
const { protect, restrictTo } = require("../middlewares/auth");
const upload  = require("../middlewares/upload");

router.get("/",    c.getSubcategories);
router.get("/:id", c.getSubcategory);
router.post("/",      protect, restrictTo("admin"), upload.single("image"), c.createSubcategory);
router.put("/:id",    protect, restrictTo("admin"), upload.single("image"), c.updateSubcategory);
router.delete("/:id", protect, restrictTo("admin"), c.deleteSubcategory);

module.exports = router;
