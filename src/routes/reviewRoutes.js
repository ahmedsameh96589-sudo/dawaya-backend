const express = require("express");
const router  = express.Router();
const c       = require("../controllers/reviewController");
const { protect } = require("../middlewares/auth");

// Mounted on /api/medicines/:medicineId/reviews  AND  /api/reviews
router.get("/my",                            protect, c.getMyReviews);
router.get("/:medicineId",                            c.getMedicineReviews);
router.post("/:medicineId",                  protect, c.createReview);
router.put("/:id",                           protect, c.updateReview);
router.delete("/:id",                        protect, c.deleteReview);

module.exports = router;
