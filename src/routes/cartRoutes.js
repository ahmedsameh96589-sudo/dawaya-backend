const express = require("express");
const router  = express.Router();
const c       = require("../controllers/cartController");
const { protect } = require("../middlewares/auth");

router.use(protect); // All cart routes require login

router.get("/",                         c.getCart);
router.post("/add",                     c.addToCart);
router.put("/update",                   c.updateCartItem);
router.delete("/remove/:medicineId",    c.removeFromCart);
router.delete("/clear",                 c.clearCart);
router.post("/coupon",                  c.applyCoupon);
router.delete("/coupon",                c.removeCoupon);

module.exports = router;
