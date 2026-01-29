const Provider = require("../models/Provider");

/* Slot generator utility */
const generateSlots = (startTime, endTime, slotMinutes) => {
  const slots = [];
  let start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);

  while (start < end) {
    const next = new Date(start.getTime() + slotMinutes * 60000);

    slots.push({
      time: `${start.toTimeString().slice(0, 5)} - ${next
        .toTimeString()
        .slice(0, 5)}`,
      isBooked: false,
    });

    start = next;
  }

  return slots;
};

/* CREATE */
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

/* GET ALL */
exports.getProviders = async (req, res) => {
  try {
    const providers = await Provider.find().populate("categoryId");
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* GET BY ID */
exports.getProviderById = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id).populate(
      "categoryId"
    );

    if (!provider) {
      return res.status(404).json({ msg: "Provider not found" });
    }

    res.json(provider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* UPDATE */
exports.updateProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) return res.sendStatus(404);

    if (req.body && Object.keys(req.body).length > 0) {
      Object.assign(provider, req.body);
    }

    if (req.file) {
      provider.avatar = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await provider.save();

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

/* AVATAR */
exports.getProviderAvatar = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider || !provider.avatar) return res.sendStatus(404);

    res.set("Content-Type", provider.avatar.contentType);
    res.send(provider.avatar.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* DELETE */
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

/*Set weekly availability (slot-based) */
exports.setAvailability = async (req, res) => {
  try {
    const id = req.params.id;
    const provider = await Provider.findById(id);

    if (!provider) {
      return res.status(404).json({ msg: "Provider not found" });
    }

    const { availability } = req.body;

    if (!Array.isArray(availability)) {
      return res
        .status(400)
        .json({ msg: "availability must be an array" });
    }

    provider.weeklyAvailability = availability.map((item) => ({
      day: item.day,
      slots: generateSlots(
        item.startTime,
        item.endTime,
        item.slotMinutes
      ),
    }));

    await provider.save();

    res.json({
      msg: "Weekly availability updated with slots",
      weeklyAvailability: provider.weeklyAvailability,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* UNAVAILABLE DATES */
exports.addUnavailableDates = async (req, res) => {
  try {
    const id = req.params.id;
    const { unavailableDates } = req.body;

    const provider = await Provider.findById(id);
    if (!provider) return res.status(404).json({ msg: "Provider not found" });

    if (!Array.isArray(unavailableDates)) {
      return res.status(400).json({ msg: "unavailableDates must be an array" });
    }

    const uniqueDates = unavailableDates.filter(date => !provider.unavailableDates.includes(date));
    provider.unavailableDates.push(...uniqueDates);
    await provider.save();

    res.json({ msg: "Unavailable dates added", provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
