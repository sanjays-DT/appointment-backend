const router = require("express").Router();
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");
const {
  createCategory,
  getCategories,
  getSingleCategory,
  updateCategory,
  deleteCategory,
  getCategoryImage
} = require("../controllers/categoryController");


router.get("/:id/image", getCategoryImage);
router.get("/", protect, getCategories);


module.exports = router;
