const User = require("../models/User");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken");

// ================= REGISTER =================
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const avatarFile = req.file;

    if (!name || !email || !password)
      return res.status(400).json({ message: "Missing fields" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    let avatar = null;
    if (avatarFile)
      avatar = { data: avatarFile.buffer, contentType: avatarFile.mimetype };

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      avatar,
    });

    res.status(201).json({
      message: "Registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= LOGIN =================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid Credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid Credentials" });

    const token = generateToken({
      id: user._id,
      role: user.role,
      email: user.email,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar ? true : false,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= FORGOT PASSWORD REQUEST =================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent duplicate request
    if (user.forgotPassword.status === "PENDING") {
      return res.status(400).json({
        message: "Request already pending. Please wait 30 minutes.",
      });
    }

    user.forgotPassword = {
      status: "PENDING",
      requestedAt: new Date(),
      approvedAt: null,
    };

    await user.save();

    res.json({
      message: "Request submitted. Please wait up to 30 minutes for approval.",
      status: "PENDING",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= CHECK FORGOT PASSWORD APPROVAL =================
exports.checkForgotApproval = async (req, res) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email });

    if (!user || user.forgotPassword.status === "NONE") {
      return res.json({ status: "NONE" });
    }

    // AUTO APPROVE AFTER 30 MIN
    if (
      user.forgotPassword.status === "PENDING" &&
      Date.now() - user.forgotPassword.requestedAt.getTime() >= THIRTY_MIN
    ) {
      user.forgotPassword.status = "APPROVED";
      user.forgotPassword.approvedAt = new Date();
      await user.save();
    }

    res.json({
      status: user.forgotPassword.status,
      remainingTime:
        user.forgotPassword.status === "PENDING"
          ? THIRTY_MIN -
            (Date.now() - user.forgotPassword.requestedAt.getTime())
          : 0,
    });
  } catch (err) {
    res.status(500).json({ status: "ERROR" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });

    if (!user || user.forgotPassword.status !== "APPROVED") {
      return res.status(403).json({ message: "Not approved yet" });
    }

    user.password = await bcrypt.hash(password, 10);

    // Reset forgot password state
    user.forgotPassword = {
      status: "NONE",
      requestedAt: null,
      approvedAt: null,
    };

    await user.save();

    res.json({ message: "Password updated successfully. Please login." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= ADMIN APPROVE FORGOT PASSWORD REQUEST =================
exports.adminApproveRequest = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.forgotPassword.status = "APPROVED";
    user.forgotPassword.approvedAt = new Date();

    await user.save();

    res.json({ message: "Forgot password request approved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const THIRTY_MIN = 30 * 60 * 1000;

exports.getForgotPasswordStatus = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ status: "NONE" });

    const user = await User.findOne({ email });
    if (!user || user.forgotPassword.status === "NONE") {
      return res.json({ status: "NONE" });
    }

    // AUTO APPROVE AFTER 30 MIN
    if (
      user.forgotPassword.status === "PENDING" &&
      Date.now() - user.forgotPassword.requestedAt.getTime() >= THIRTY_MIN
    ) {
      user.forgotPassword.status = "APPROVED";
      user.forgotPassword.approvedAt = new Date();
      await user.save();
    }

    const remainingTime =
      user.forgotPassword.status === "PENDING"
        ? THIRTY_MIN -
          (Date.now() - user.forgotPassword.requestedAt.getTime())
        : 0;

    res.json({
      status: user.forgotPassword.status,
      remainingTime,
    });
  } catch (err) {
    res.status(500).json({ status: "ERROR" });
  }
};
