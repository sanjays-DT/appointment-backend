const router = require("express").Router();

router.use("/auth", require("./authRoutes"));
router.use("/categories", require("./categoryRoutes"));

module.exports = router;
