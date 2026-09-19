const express = require("express");
const router  = express.Router();
const c       = require("../controllers/wishlistController");
const { protect } = require("../middlewares/auth");

router.use(protect);

router.get("/",                              c.getWishlist);
router.post("/:medicineId",                  c.addToWishlist);
router.delete("/:medicineId",                c.removeFromWishlist);
router.delete("/",                           c.clearWishlist);
router.post("/:medicineId/move-to-cart",     c.moveToCart);

module.exports = router;
