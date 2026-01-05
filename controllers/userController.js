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
