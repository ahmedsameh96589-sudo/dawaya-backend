const express = require("express");
const router = express.Router();
const c = require("../controllers/userController");
const { protect } = require("../middlewares/auth");

router.use(protect);

router.get("/me", c.getMe);
router.put("/me", c.updateMe);

module.exports = router;
