const express = require("express");
const router = express.Router();
const multer = require("multer");
const providerController = require("../controllers/providerController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");
const { protectProvider, providerApprovedOnly } = require("../middlewares/providerAuth");

const upload = multer({ storage: multer.memoryStorage() });

/* =====================
   PROVIDER AUTH ROUTES
   ===================== */
router.post("/auth/register", upload.single("avatar"), providerController.registerProvider);
router.post("/auth/login", providerController.loginProvider);
router.post("/auth/forgot-password", providerController.forgotPassword);
router.post("/auth/reset-password", providerController.resetPassword);

/* =====================
   PROVIDER DASHBOARD ROUTES (JWT-protected)
   ===================== */
router.get("/dashboard", protectProvider, providerApprovedOnly, providerController.getProviderDashboard);
router.get("/dashboard/appointments", protectProvider, providerController.getProviderAppointments);
router.put("/dashboard/availability", protectProvider, providerController.setAvailability);
router.put("/dashboard/unavailable-dates", protectProvider, providerController.addUnavailableDates);


/* =====================
   ADMIN APPROVAL ROUTES
   ===================== */
router.put("/admin/approve/:id", protect, adminOnly, providerController.approveProvider);
router.put("/admin/approve-forgot-password", protect, adminOnly, providerController.approveForgotPassword);
/* =====================
   EXISTING ADMIN / CRUD ROUTES
   ===================== */
router.post("/", upload.single("avatar"), protect, adminOnly, providerController.createProvider);
router.put("/:id", upload.single("avatar"), protect, adminOnly, providerController.updateProvider);
router.get("/:id/avatar", providerController.getProviderAvatar);
router.get("/", protect, providerController.getProviders);
router.get("/:id", protect,providerController.getProviderById);
router.delete("/:id", protect, adminOnly, providerController.deleteProvider);

router.put("/:id/availability", protect, adminOnly, providerController.setAvailability);
router.put("/:id/unavailable-dates", protect, adminOnly, providerController.addUnavailableDates);

module.exports = router;
