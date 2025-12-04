const router = require("express").Router();
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const {
  createCategory,
  getCategories,
  getSingleCategory,
  updateCategory,
  deleteCategory
} = require("../controllers/categoryController");

router.post("/", protect, adminOnly, createCategory);
router.get("/", protect, getCategories);
router.get("/:id",protect, getSingleCategory);
router.put("/:id", protect, adminOnly, updateCategory);
router.delete("/:id", protect, adminOnly, deleteCategory);

module.exports = router;
