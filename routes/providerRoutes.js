const express = require("express");
const router = express.Router();
const providerController = require("../controllers/providerController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

router.post("/", protect, adminOnly, providerController.createProvider);        
router.get("/", protect, providerController.getProviders);                     
router.get("/:id", protect, providerController.getProviderById);                
router.put("/:id", protect, adminOnly, providerController.updateProvider);     
router.delete("/:id", protect, adminOnly, providerController.deleteProvider);   


router.put("/:id/availability", protect, adminOnly, providerController.setAvailability);          
router.put("/:id/unavailable-dates", protect, adminOnly, providerController.addUnavailableDates);

module.exports = router;
