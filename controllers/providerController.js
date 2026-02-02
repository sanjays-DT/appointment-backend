const Provider = require("../models/Provider");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken");
const { validateName, validateEmail, validatePassword } = require("../utils/validators");

const THIRTY_MIN = 30 * 60 * 1000; // 30 minutes

/* ======================
   SLOT GENERATOR
   ====================== */
const generateSlots = (startTime, endTime, slotMinutes) => {
  const slots = [];
  let start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);

  while (start < end) {
    const next = new Date(start.getTime() + slotMinutes * 60000);
    slots.push({
      time: `${start.toTimeString().slice(0, 5)} - ${next.toTimeString().slice(0, 5)}`,
      isBooked: false,
    });
    start = next;
  }
  return slots;
};

/* ======================
   CREATE PROVIDER
   ====================== */
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

/* ======================
   GET PROVIDERS / BY ID
   ====================== */
exports.getProviders = async (req, res) => {
  try {
    const providers = await Provider.find().populate("categoryId");
    res.json(providers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProviderById = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id).populate("categoryId");
    if (!provider) return res.status(404).json({ message: "Provider not found" });
    res.json(provider);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   UPDATE PROVIDER
   ====================== */
exports.updateProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) return res.sendStatus(404);

    Object.assign(provider, req.body || {});
    if (req.file) {
      provider.avatar = { data: req.file.buffer, contentType: req.file.mimetype };
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

/* ======================
   AVATAR
   ====================== */
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

/* ======================
   DELETE PROVIDER
   ====================== */
exports.deleteProvider = async (req, res) => {
  try {
    const provider = await Provider.findByIdAndDelete(req.params.id);
    if (!provider) return res.status(404).json({ message: "Provider not found" });
    res.json({ message: "Provider deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   SET WEEKLY AVAILABILITY
   ====================== */
exports.setAvailability = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    const { availability } = req.body;
    if (!Array.isArray(availability)) return res.status(400).json({ message: "availability must be an array" });

    provider.weeklyAvailability = availability.map((item) => ({
      day: item.day,
      slots: generateSlots(item.startTime, item.endTime, item.slotMinutes),
    }));

    await provider.save();
    res.json({ message: "Weekly availability updated", weeklyAvailability: provider.weeklyAvailability });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   UNAVAILABLE DATES
   ====================== */
exports.addUnavailableDates = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    const { unavailableDates } = req.body;
    if (!Array.isArray(unavailableDates)) return res.status(400).json({ message: "unavailableDates must be an array" });

    const uniqueDates = unavailableDates.filter(date => !provider.unavailableDates.includes(date));
    provider.unavailableDates.push(...uniqueDates);

    await provider.save();
    res.json({ message: "Unavailable dates added", provider });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   PROVIDER AUTH: REGISTER & LOGIN
   ====================== */
exports.registerProvider = async (req, res) => {
  try {
    const { name, email, password, categoryId, speciality, city, hourlyPrice, address } = req.body;
    const err = validateName(name) || validateEmail(email) || validatePassword(password);
    if (err) return res.status(400).json({ message: err });

    if (await Provider.findOne({ email })) return res.status(400).json({ message: "Email already registered" });

    const provider = new Provider({
      name, email, password: await bcrypt.hash(password, 10),
      categoryId, speciality, city, hourlyPrice, address, isApproved: false,
    });

    if (req.file) provider.avatar = { data: req.file.buffer, contentType: req.file.mimetype };

    await provider.save();
    res.status(201).json({ message: "Registered successfully. Wait for admin approval.", provider: { id: provider._id, name: provider.name, email: provider.email, isApproved: provider.isApproved } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.loginProvider = async (req, res) => {
  try {
    const { email, password } = req.body;
    const provider = await Provider.findOne({ email });
    if (!provider) return res.status(400).json({ message: "Invalid credentials" });

    if (!(await bcrypt.compare(password, provider.password))) return res.status(400).json({ message: "Invalid credentials" });
    if (!provider.isApproved) return res.status(403).json({ message: "Admin approval required" });

    const token = generateToken({ id: provider._id, role: "provider", email: provider.email });
    res.json({ message: "Login successful", token, provider: { id: provider._id, name: provider.name, email: provider.email, avatar: !!provider.avatar } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   PROVIDER DASHBOARD
   ====================== */
exports.getProviderDashboard = async (req, res) => {
  try {
    const provider = await Provider.findById(req.provider._id).populate("categoryId");
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    res.json({ message: "Provider dashboard", provider: { _id: provider._id, name: provider.name, speciality: provider.speciality, city: provider.city, weeklyAvailability: provider.weeklyAvailability, unavailableDates: provider.unavailableDates } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProviderAppointments = async (req, res) => {
  try {
    res.json({ message: "Return provider appointments here" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================
   PROVIDER FORGOT PASSWORD FLOW
   ====================== */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });

    const provider = await Provider.findOne({ email });
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    if (!provider.forgotPassword) provider.forgotPassword = { status: "NONE", requestedAt: null, approvedAt: null };

    // Check pending
    if (provider.forgotPassword.status === "PENDING") {
      const minutesPassed = Math.floor((Date.now() - new Date(provider.forgotPassword.requestedAt)) / 60000);
      if (minutesPassed < 30) return res.status(400).json({ message: `Request pending. Wait ${30 - minutesPassed} more minutes.`, status: "PENDING" });
    }

    provider.forgotPassword.status = "PENDING";
    provider.forgotPassword.requestedAt = new Date();
    provider.forgotPassword.approvedAt = null;

    await provider.save();
    res.json({ message: "Password reset request submitted. Wait for admin approval or auto-approval in 30 minutes.", status: "PENDING", requestedAt: provider.forgotPassword.requestedAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const provider = await Provider.findOne({ email });
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    if (!provider.forgotPassword || provider.forgotPassword.status !== "APPROVED") return res.status(403).json({ message: "Not approved yet" });

    provider.password = await bcrypt.hash(password, 10);
    provider.forgotPassword = { status: "NONE", requestedAt: null, approvedAt: null };
    await provider.save();

    res.json({ message: "Password updated successfully. Please login." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approveForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const provider = await Provider.findOne({ email });
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    if (!provider.forgotPassword || provider.forgotPassword.status !== "PENDING") return res.status(400).json({ message: "No pending forgot-password request" });

    provider.forgotPassword.status = "APPROVED";
    provider.forgotPassword.approvedAt = new Date();
    await provider.save();

    res.json({ message: "Forgot-password request approved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approveProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    provider.isApproved = true;
    await provider.save();

    res.json({ message: "Provider approved", provider: { id: provider._id, isApproved: provider.isApproved } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getForgotPasswordStatus = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ status: "NONE" });

    const provider = await Provider.findOne({ email });
    if (!provider || !provider.forgotPassword || provider.forgotPassword.status === "NONE") return res.json({ status: "NONE" });

    // Auto-approve after 30 min
    if (provider.forgotPassword.status === "PENDING" && Date.now() - new Date(provider.forgotPassword.requestedAt) >= THIRTY_MIN) {
      provider.forgotPassword.status = "APPROVED";
      provider.forgotPassword.approvedAt = new Date();
      await provider.save();
    }

    const remainingTime = provider.forgotPassword.status === "PENDING" ? THIRTY_MIN - (Date.now() - new Date(provider.forgotPassword.requestedAt)) : 0;
    res.json({ status: provider.forgotPassword.status, remainingTime });
  } catch (err) {
    res.status(500).json({ status: "ERROR" });
  }
};
