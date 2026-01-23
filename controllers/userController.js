const User = require("../models/User");

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { name, email } = req.body;
    const avatarFile = req.file;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    if (email && email !== user.email) {
      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(400).json({ message: "Email already in use" });
      }
      user.email = email;
    }

    if (name) user.name = name;

    if (avatarFile) {
      user.avatar = {
        data: avatarFile.buffer,
        contentType: avatarFile.mimetype,
      };
    }

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar ? true : false,
      },
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR →", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getUsersForReset = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    const users = await User.find({
      "forgotPassword.status": "PENDING",
    }).select("-password");

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= GET USER PREFERENCES =================
exports.getPreferences = async (req, res) => {
  try {
    // Make sure to fetch the full document including preferences
    const user = await User.findById(req.user._id).select("preferences");

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Always return theme, default to 'light' if missing
    return res.json({ theme: user.preferences?.theme || "light" });
  } catch (err) {
    console.error("Get Preferences Error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};


/* ================= UPDATE USER PREFERENCES ================= */
exports.updatePreferences = async (req, res) => {
  try {
    const { theme } = req.body;

    // Validate theme
    if (!["light", "dark"].includes(theme)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid theme value",
      });
    }

    // Find user
    const user = await User.findById(req.user.id).select("preferences");

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "User not found",
      });
    }

    // Initialize preferences object if missing
    user.preferences = user.preferences || {};
    user.preferences.theme = theme;

    await user.save();

    return res.json({
      ok: true,
      theme: user.preferences.theme,
    });
  } catch (err) {
    console.error("Update Preferences Error:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
};
