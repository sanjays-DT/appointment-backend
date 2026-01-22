const User = require("../models/User");

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
