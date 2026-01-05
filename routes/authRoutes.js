const express = require("express");
const upload = require("../middlewares/upload.js");
const router = express.Router();
const { register, login } = require("../controllers/authController.js");

router.post("/register", upload.single("avatar"), register);
router.post("/login", login);

module.exports = router;
