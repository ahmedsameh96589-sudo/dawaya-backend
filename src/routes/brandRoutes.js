const express = require("express");
const router  = express.Router();
const c       = require("../controllers/brandController");
const { protect, restrictTo } = require("../middlewares/auth");
const upload  = require("../middlewares/upload");

router.get("/",    c.getBrands);
router.get("/:id", c.getBrand);
router.post("/",      protect, restrictTo("admin"), upload.single("logo"), c.createBrand);
router.put("/:id",    protect, restrictTo("admin"), upload.single("logo"), c.updateBrand);
router.delete("/:id", protect, restrictTo("admin"), c.deleteBrand);

module.exports = router;
