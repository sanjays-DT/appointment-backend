const router = require("express").Router();

const {
  getCategories,
  getCategoryImage
} = require("../controllers/categoryController");


router.get("/:id/image", getCategoryImage);
router.get("/",  getCategories);


module.exports = router;
