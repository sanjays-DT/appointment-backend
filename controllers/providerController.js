const Provider = require("../models/Provider");
const Category = require("../models/Category");
const upload = require("../middlewares/upload");

// CREATE
exports.createProvider = async (req, res) => {
  try {
    const provider = new Provider(req.body);

    if (req.file) {
      provider.avatar = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await provider.save();
    res.status(201).json(provider);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// Get all providers
exports.getProviders = async (req, res) => {
    try {
        const providers = await Provider.find().populate("categoryId");
        res.json(providers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Get provider by ID
exports.getProviderById = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id).populate("categoryId");

        if (!provider) {
            return res.status(404).json({ msg: "Provider not found" });
        }

        res.json(provider);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



// UPDATE PROVIDER
exports.updateProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) return res.sendStatus(404);

    // update text fields
    if (req.body && Object.keys(req.body).length > 0) {
      Object.assign(provider, req.body);
    }

    // update avatar only if uploaded
    if (req.file) {
      provider.avatar = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await provider.save();

    // ❌ do NOT send avatar buffer back
    res.json({
      message: "Provider updated successfully",
      provider: {
        _id: provider._id,
        name: provider.name,
        speciality: provider.speciality,
        hourlyPrice: provider.hourlyPrice,
        city: provider.city,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// // GET PROVIDER AVATAR
exports.getProviderAvatar = async (req, res) => {
   try {
      const provider = await Provider.findById(req.params.id);
      if (!provider || !provider.avatar) 
          return res.sendStatus(404);
      res.set("Content-Type", provider.avatar.contentType);
      res.send(provider.avatar.data);
    } catch (err) {
      console.error("Avatar fetch error →", err);
      res.status(500).json({ message: err.message });
    }
  }; 



// Delete provider
exports.deleteProvider = async (req, res) => {
    try {
        const provider = await Provider.findByIdAndDelete(req.params.id);

        if (!provider) {
            return res.status(404).json({ msg: "Provider not found" });
        }

        res.json({ msg: "Provider deleted successfully" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Set weekly availability
exports.setAvailability = async (req, res) => {
    try {
        const id = req.params.id; // your requested variable format

        const provider = await Provider.findById(id);
        if (!provider) {
            return res.status(404).json({ msg: "Provider not found" });
        }

        const { weeklyAvailability } = req.body;

        // Validate array
        if (!Array.isArray(weeklyAvailability)) {
            return res.status(400).json({
                msg: "weeklyAvailability must be an array"
            });
        }

        // Validate each entry
        for (const slot of weeklyAvailability) {
            if (!slot.day || !slot.startTime || !slot.endTime) {
                return res.status(400).json({
                    msg: "Each availability item must include: day, startTime, endTime"
                });
            }
        }

        // Update
        provider.weeklyAvailability = weeklyAvailability;
        await provider.save();

        res.json({
            msg: "Availability updated",
            provider
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



// Add unavailable dates
exports.addUnavailableDates = async (req, res) => {
    try {
        const id = req.params.id;
        const { unavailableDates } = req.body;

        const provider = await Provider.findById(id);
        if (!provider) {
            return res.status(404).json({ msg: "Provider not found" });
        }

        // Validate array
        if (!Array.isArray(unavailableDates)) {
            return res.status(400).json({
                msg: "unavailableDates must be an array"
            });
        }

        // Avoid duplicate dates
        const uniqueDates = unavailableDates.filter(
            date => !provider.unavailableDates.includes(date)
        );

        provider.unavailableDates.push(...uniqueDates);
        await provider.save();

        res.json({
            msg: "Unavailable dates added",
            provider
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
