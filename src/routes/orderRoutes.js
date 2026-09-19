const express = require("express");
const router = express.Router();

const c = require("../controllers/orderController");

const {
  protect,
  restrictTo
} = require("../middlewares/auth");

const {
  validate,
  placeOrderRules
} = require("../middlewares/validate");

const upload =
  require("../middlewares/upload");

// User routes
router.post(
  "/",
  protect,
  upload.single("prescription"),
  placeOrderRules,
  validate,
  c.placeOrder
);

router.get("/", protect, c.getMyOrders);

router.get("/:id", protect, c.getOrder);

router.put(
  "/:id/cancel",
  protect,
  c.cancelOrder
);

// Admin routes
router.get(
  "/admin/all",
  protect,
  restrictTo("admin"),
  c.getAllOrders
);

router.put(
  "/:id/status",
  protect,
  restrictTo("admin"),
  c.updateOrderStatus
);

module.exports = router;