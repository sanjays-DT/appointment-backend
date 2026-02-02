const jwt = require("jsonwebtoken");
const Provider = require("../models/Provider");

exports.protectProvider = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // support tokens that use either `role` or legacy `type`
    const isProviderToken = decoded.role === "provider" || decoded.type === "provider";
    if (!isProviderToken) {
      return res.status(403).json({ message: "Invalid token" });
    }

    req.provider = await Provider.findById(decoded.id).select("-password");
    if (!req.provider) return res.status(401).json({ message: "Provider not found" });

    next();
  } catch (err) {
    res.status(401).json({ message: "Token failed" });
  }
};

// Ensure provider has been approved by admin
exports.providerApprovedOnly = (req, res, next) => {
  if (!req.provider) return res.status(401).json({ message: "Not authorized" });
  if (!req.provider.isApproved) return res.status(403).json({ message: "Provider not approved" });
  next();
};
