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

router.post("/", upload.single("image"), createCategory);
router.put("/:id", upload.single("image"), updateCategory);
router.get("/:id/image", getCategoryImage);
router.get("/", protect, getCategories);
router.get("/:id", protect, getSingleCategory);
router.delete("/:id", protect, adminOnly, deleteCategory);

module.exports = router;
