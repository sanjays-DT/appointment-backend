const express = require("express");
const router = express.Router();
const providerController = require("../controllers/providerController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

// CRUD Routes
router.post("/", protect, adminOnly, providerController.createProvider);        // Create provider
router.get("/", protect, providerController.getProviders);                      // Get all providers
router.get("/:id", protect, providerController.getProviderById);                // Get provider by ID
router.put("/:id", protect, adminOnly, providerController.updateProvider);      // Update provider
router.delete("/:id", protect, adminOnly, providerController.deleteProvider);   // Delete provider

// Availability Routes
router.put("/:id/availability", protect, adminOnly, providerController.setAvailability);          
router.put("/:id/unavailable-dates", protect, adminOnly, providerController.addUnavailableDates);

module.exports = router;
