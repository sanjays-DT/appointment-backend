const User = require("../models/User");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken");

/* ================= REGISTER ================= */

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const avatarFile = req.file; 

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    let avatar = null;
    if (avatarFile) {
      avatar = {
        data: avatarFile.buffer,
        contentType: avatarFile.mimetype,
      };
    }

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
    console.log("REGISTER ERROR →", err);
    res.status(500).json({ message: err.message });
  }
};
/* ================= LOGIN ================= */

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid Credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Invalid Credentials" });

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
    console.log("LOGIN ERROR →", err);
    res.status(500).json({ message: err.message });
  }
};
