const express = require("express");
const router = express.Router();
const multer = require("multer");
const providerController = require("../controllers/providerController");

const {
  protect,
  adminOnly,
  providerOnly,
  providerApprovedOnly,
  providerOwnership,
  authorizeRoles
} = require("../middlewares/authMiddleware");
const upload = multer({ storage: multer.memoryStorage() });


// PROVIDER AUTH ROUTES
router.post("/auth/register", upload.single("avatar"), providerController.registerProvider);
router.get("/:id/slots", providerController.getProviderSlots);

//  PROVIDER DASHBOARD ROUTES (JWT-protected)
router.get(
  "/dashboard",
  protect,
  providerOnly,
  providerApprovedOnly,
  providerController.getProviderDashboard
);
router.get("/:id/dashboard-stats", protect, providerOnly, providerApprovedOnly, providerController.getProviderDashboardStats);


// ADMIN APPROVAL ROUTES
router.put("/admin/approve/:id", protect, adminOnly, providerController.approveProvider);

// EXISTING ADMIN / CRUD ROUTES
router.post("/", upload.single("avatar"), protect, adminOnly, providerController.createProvider);
router.put("/preferences", protect , providerController.updatePreferences);
router.get("/preferences", protect, providerController.getPreferences);
router.put("/:id", upload.single("avatar"), protect, authorizeRoles("admin", "provider"),providerOwnership,providerController.updateProvider);
router.get("/:id/avatar", providerController.getProviderAvatar);
router.get("/", protect, providerController.getProviders);
router.get("/:id", protect,providerController.getProviderById);
router.delete("/:id", protect, adminOnly, providerController.deleteProvider);

router.put("/:id/availability",protect,providerOnly,providerOwnership,providerController.setAvailability);
router.get("/:id/availability", providerController.getAvailability);
router.put("/:id/unavailable-dates", protect, providerOwnership, providerController.setUnavailableDates);
router.get("/:id/unavailable-dates", protect, providerOwnership, providerController.getUnavailableDates);
router.delete("/:id/unavailable-dates", protect, providerOwnership, providerController.removeUnavailableDate);

module.exports = router;
