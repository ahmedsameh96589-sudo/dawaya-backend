const express = require("express");
const router  = express.Router();
const c       = require("../controllers/medicineController");
const { protect, restrictTo } = require("../middlewares/auth");
const upload  = require("../middlewares/upload");

// ── Public ────────────────────────────────────────────────────
router.get("/",         c.getMedicines);
router.get("/featured", c.getFeaturedMedicines);
router.get("/:id",      c.getMedicine);

// Alternatives
router.get("/:id/alternatives",         c.getAlternatives);
router.get("/:id/alternatives/manual",  protect, restrictTo("admin"), c.getManualAlternatives);

// ── Admin ─────────────────────────────────────────────────────
router.post("/",               protect, restrictTo("admin"), upload.array("images", 5), c.createMedicine);
router.put("/:id",             protect, restrictTo("admin"), upload.array("images", 5), c.updateMedicine);
router.delete("/:id",          protect, restrictTo("admin"), c.deleteMedicine);
router.patch("/:id/stock",     protect, restrictTo("admin"), c.updateStock);

// Manual alternatives management (Admin)
router.post("/:id/alternatives",            protect, restrictTo("admin"), c.addManualAlternative);
router.delete("/:id/alternatives/:altId",   protect, restrictTo("admin"), c.removeManualAlternative);

module.exports = router;
