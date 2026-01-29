const express = require("express");
const router = express.Router();
const multer = require("multer");
const providerController = require("../controllers/providerController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

const upload = multer({ storage: multer.memoryStorage() });

/* =====================
   EXISTING ROUTES (UNCHANGED)
   ===================== */
router.post("/", upload.single("avatar"), providerController.createProvider);
router.put("/:id", upload.single("avatar"), providerController.updateProvider);
router.get("/:id/avatar", providerController.getProviderAvatar);
router.get("/", protect, providerController.getProviders);
router.get("/:id", protect, providerController.getProviderById);
router.delete("/:id", protect, adminOnly, providerController.deleteProvider);


router.put(
  "/:id/availability",
  protect,
  adminOnly,
  providerController.setAvailability
);

router.put(
  "/:id/unavailable-dates",
  protect,
  adminOnly,
  providerController.addUnavailableDates
);




module.exports = router;
