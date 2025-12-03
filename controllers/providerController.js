const Provider = require("../models/Provider");
const Category = require("../models/Category");

// Create Provider
exports.createProvider = async (req, res) => {
    try {
        const { categoryId, name, speciality, hourlyPrice, location } = req.body;

        // 1️⃣ Validate required fields
        if (!categoryId || !name || !speciality || !hourlyPrice || !location) {
            return res.status(400).json({
                msg: "categoryId, name, speciality, hourlyPrice, and location are required."
            });
        }

        // 2️⃣ Validate category ID exists
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(400).json({ msg: "Invalid categoryId. Category not found." });
        }

        // 3️⃣ Prevent duplicate providers (same name + speciality)
        const existing = await Provider.findOne({ name, speciality });
        if (existing) {
            return res.status(409).json({
                msg: "Provider with the same name and speciality already exists."
            });
        }

        // 4️⃣ Create provider
        const provider = await Provider.create(req.body);

        res.status(201).json({
            message: "Provider created successfully",
            provider
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
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



// Update provider
exports.updateProvider = async (req, res) => {
    try {
        const provider = await Provider.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!provider) {
            return res.status(404).json({ msg: "Provider not found" });
        }

        res.json(provider);

    } catch (error) {
        res.status(500).json({ error: error.message });
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
