const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Provider = require("../models/Provider");

/* =========================
   UNIVERSAL AUTH MIDDLEWARE
========================= */
exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let currentUser;

    //  If admin or normal user
    if (decoded.role === "admin" || decoded.role === "user") {
      currentUser = await User.findById(decoded.id).select("-password");
      if (!currentUser)
        return res.status(401).json({ message: "User not found" });

      req.user = currentUser;
    }

    //If provider
    else if (decoded.role === "provider") {
      currentUser = await Provider.findById(decoded.id).select("-password");
      if (!currentUser)
        return res.status(401).json({ message: "Provider not found" });

      req.provider = currentUser;
    } else {
      return res.status(403).json({ message: "Invalid role" });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

/* =========================
   ROLE MIDDLEWARES
========================= */

// ðŸ”¹ Admin only
exports.adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only access" });
  }
  next();
};

// ðŸ”¹ Provider only
exports.providerOnly = (req, res, next) => {
  if (!req.provider) {
    return res.status(403).json({ message: "Provider only access" });
  }
  next();
};

// ðŸ”¹ Provider must be approved
exports.providerApprovedOnly = (req, res, next) => {
  if (!req.provider) {
    return res.status(401).json({ message: "Not authorized" });
  }

  if (!req.provider.isApproved) {
    return res.status(403).json({ message: "Provider not approved" });
  }

  next();
};

// ðŸ”¹ Provider ownership check
exports.providerOwnership = (req, res, next) => {
  if (!req.provider) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const loggedInProviderId = req.provider._id.toString();
  const targetProviderId = req.params.id;

  if (loggedInProviderId !== targetProviderId) {
    return res.status(403).json({
      message: "You cannot modify another provider",
    });
  }

  next();
};

exports.authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    let role;

    // detect role from logged-in entity
    if (req.user) role = req.user.role;
    if (req.provider) role = "provider";

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        message: `Access denied. Allowed roles: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};

