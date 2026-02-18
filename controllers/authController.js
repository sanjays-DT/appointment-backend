const bcrypt = require("bcrypt");
const User = require("../models/User");
const Provider = require("../models/Provider");
const generateToken = require("../utils/generateToken");
const { validateName, validateEmail, validatePassword } = require("../utils/validators");

const THIRTY_MIN = 30 * 60 * 1000;
const ROLE_CONFIG = {
  user: { model: User, label: "User" },
  provider: { model: Provider, label: "Provider" },
};

const getRoleConfig = (role) => ROLE_CONFIG[String(role || "user").toLowerCase()];
const getRoleFromReq = (req) => (req.body && req.body.role) || (req.query && req.query.role) || "";
const normalizeEmail = (email) => (email ? String(email).trim().toLowerCase() : "");
const getOtherRole = (role) => (String(role).toLowerCase() === "provider" ? "user" : "provider");

const findAccountByEmail = async (email, roleHint) => {
  const normalizedRole = String(roleHint || "").toLowerCase();

  if (ROLE_CONFIG[normalizedRole]) {
    const primaryConfig = ROLE_CONFIG[normalizedRole];
    const primary = await primaryConfig.model.findOne({ email });
    if (primary) return { account: primary, role: normalizedRole, roleConfig: primaryConfig };

    const secondaryRole = getOtherRole(normalizedRole);
    const secondaryConfig = ROLE_CONFIG[secondaryRole];
    const secondary = await secondaryConfig.model.findOne({ email });
    if (secondary) return { account: secondary, role: secondaryRole, roleConfig: secondaryConfig };

    return null;
  }

  const [user, provider] = await Promise.all([
    User.findOne({ email }),
    Provider.findOne({ email }),
  ]);

  if (user) return { account: user, role: "user", roleConfig: ROLE_CONFIG.user };
  if (provider) return { account: provider, role: "provider", roleConfig: ROLE_CONFIG.provider };
  return null;
};

const findAccountById = async (id, roleHint) => {
  const normalizedRole = String(roleHint || "").toLowerCase();

  if (ROLE_CONFIG[normalizedRole]) {
    const primaryConfig = ROLE_CONFIG[normalizedRole];
    const primary = await primaryConfig.model.findById(id);
    if (primary) return { account: primary, role: normalizedRole, roleConfig: primaryConfig };

    const secondaryRole = getOtherRole(normalizedRole);
    const secondaryConfig = ROLE_CONFIG[secondaryRole];
    const secondary = await secondaryConfig.model.findById(id);
    if (secondary) return { account: secondary, role: secondaryRole, roleConfig: secondaryConfig };

    return null;
  }

  const user = await User.findById(id);
  if (user) return { account: user, role: "user", roleConfig: ROLE_CONFIG.user };

  const provider = await Provider.findById(id);
  if (provider) return { account: provider, role: "provider", roleConfig: ROLE_CONFIG.provider };
  return null;
};

// ================= REGISTER =================
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const avatarFile = req.file;

    // ---------------- NAME VALIDATION ----------------
    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ message: nameError });

    // ---------------- EMAIL VALIDATION ----------------
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });

    // ---------------- CHECK EXISTING USER ----------------
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already registered" });

    // ---------------- PASSWORD VALIDATION ----------------
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    // ---------------- HASH PASSWORD ----------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // ---------------- AVATAR HANDLING ----------------
    let avatar = null;
    if (avatarFile) {
      avatar = {
        data: avatarFile.buffer,
        contentType: avatarFile.mimetype
      };
    }

    // ---------------- CREATE USER ----------------
    const user = await User.create({
      name: name.trim(),
      email,
      password: hashedPassword,
      role: role || "user",
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
    console.error("Register Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ================= LOGIN =================
// ================= UNIVERSAL LOGIN =================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ---------------- CHECK IN USER COLLECTION ----------------
    let account = await User.findOne({ email });
    let role;
    let isProvider = false;

    if (account) {
      role = account.role; // admin or user
    } else {
      // ---------------- CHECK IN PROVIDER COLLECTION ----------------
      account = await Provider.findOne({ email });
      if (!account) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      role = "provider";
      isProvider = true;
    }

    // ---------------- PASSWORD CHECK ----------------
    const match = await bcrypt.compare(password, account.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ---------------- PROVIDER APPROVAL CHECK ----------------
    if (isProvider && !account.isApproved) {
      return res.status(403).json({ message: "Admin approval required" });
    }

    // ---------------- GENERATE TOKEN ----------------
    const token = generateToken({
      id: account._id,
      role,
      email: account.email,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: account._id,
        name: account.name,
        email: account.email,
        role,
        avatar: account.avatar ? true : false,
      },
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ================= FORGOT PASSWORD REQUEST =================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const roleHint = getRoleFromReq(req);

    // ---------------- EMAIL VALIDATION ----------------
    const emailError = validateEmail(normalizedEmail);
    if (emailError) return res.status(400).json({ message: emailError });

    const resolved = await findAccountByEmail(normalizedEmail, roleHint);
    if (!resolved) return res.status(400).json({ message: "Invalid credentials" });
    const { account } = resolved;

    // ---------------- CHECK EXISTING REQUEST ----------------
    if (account.forgotPassword?.status === "PENDING") {
      const requestedAt = new Date(account.forgotPassword.requestedAt);
      const now = new Date();
      const minutesPassed = Math.floor((now - requestedAt) / (1000 * 60));

      if (minutesPassed < 30) {
        return res.status(400).json({
          message: `Request already pending. Please wait ${30 - minutesPassed} more minutes.`,
          status: "PENDING",
        });
      }
    }

    // ---------------- CREATE / RESET REQUEST ----------------
    account.forgotPassword = {
      status: "PENDING",
      requestedAt: new Date(),
      approvedAt: null,
    };
    await account.save();

    res.status(200).json({
      message: "Password reset request submitted. Please wait up to 30 minutes for admin approval.",
      status: "PENDING",
      requestedAt: account.forgotPassword.requestedAt,
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ================= CHECK FORGOT PASSWORD APPROVAL =================
exports.checkForgotApproval = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.query && req.query.email);
    const roleHint = getRoleFromReq(req);
    if (!normalizedEmail) return res.status(400).json({ status: "NONE" });

    const resolved = await findAccountByEmail(normalizedEmail, roleHint);
    if (!resolved) return res.json({ status: "NONE" });
    const { account, role } = resolved;

    if (!account || !account.forgotPassword || account.forgotPassword.status === "NONE") {
      return res.json({ status: "NONE" });
    }

    const requestedAtMs = account.forgotPassword.requestedAt
      ? new Date(account.forgotPassword.requestedAt).getTime()
      : null;
    const elapsedMs = requestedAtMs ? Date.now() - requestedAtMs : 0;

    // AUTO APPROVE AFTER 30 MIN (PROVIDER ONLY)
    if (
      role === "provider" &&
      account.forgotPassword.status === "PENDING" &&
      requestedAtMs &&
      elapsedMs >= THIRTY_MIN
    ) {
      account.forgotPassword.status = "APPROVED";
      account.forgotPassword.approvedAt = new Date();
      await account.save();
    }

    res.json({
      status: account.forgotPassword.status,
      remainingTime:
        account.forgotPassword.status === "PENDING"
          ? Math.max(0, THIRTY_MIN - elapsedMs)
          : 0,
    });
  } catch (err) {
    res.status(500).json({ status: "ERROR" });
  }
};

// ================= RESET PASSWORD =================
exports.resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const roleHint = getRoleFromReq(req);

    if (!normalizedEmail || !password) return res.status(400).json({ message: "Email and password required" });

    // ---------------- PASSWORD VALIDATION ----------------
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const resolved = await findAccountByEmail(normalizedEmail, roleHint);
    if (!resolved) return res.status(403).json({ message: "Not approved yet" });
    const { account } = resolved;
    if (!account || !account.forgotPassword || account.forgotPassword.status !== "APPROVED") {
      return res.status(403).json({ message: "Not approved yet" });
    }

    account.password = await bcrypt.hash(password, 10);

    // Reset forgot password state
    account.forgotPassword = { status: "NONE", requestedAt: null, approvedAt: null };
    await account.save();

    res.json({ message: "Password updated successfully. Please login." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= ADMIN APPROVE REQUEST =================
exports.adminApproveRequest = async (req, res) => {
  try {
    const roleHint = getRoleFromReq(req);
    const roleConfig = roleHint ? getRoleConfig(roleHint) : null;
    if (roleHint && !roleConfig) return res.status(400).json({ message: "Invalid role" });
    const { userId, id, email } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const accountId = userId || id;
    let resolved = null;

    if (accountId) {
      resolved = await findAccountById(accountId, roleHint);
    } else if (normalizedEmail) {
      resolved = await findAccountByEmail(normalizedEmail, roleHint);
    } else {
      return res.status(400).json({ message: "userId or email required" });
    }

    if (!resolved) return res.status(404).json({ message: "Account not found" });
    const { account } = resolved;
    if (!account.forgotPassword || account.forgotPassword.status === "NONE") {
      return res.status(400).json({ message: "No pending forgot-password request" });
    }

    account.forgotPassword.status = "APPROVED";
    account.forgotPassword.approvedAt = new Date();
    await account.save();

    res.json({ message: "Forgot password request approved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= ADMIN LIST RESET REQUESTS =================
exports.adminResetRequests = async (req, res) => {
  try {
    const roleHint = getRoleFromReq(req);
    const roleConfig = roleHint ? getRoleConfig(roleHint) : null;
    if (roleHint && !roleConfig) return res.status(400).json({ message: "Invalid role" });

    if (roleConfig) {
      const accounts = await roleConfig.model.find({
        "forgotPassword.status": "PENDING",
      }).select("-password");

      return res.json(accounts);
    }

    const [users, providers] = await Promise.all([
      User.find({ "forgotPassword.status": "PENDING" }).select("-password").lean(),
      Provider.find({ "forgotPassword.status": "PENDING" }).select("-password").lean(),
    ]);

    res.json([
      ...users.map((account) => ({ ...account, role: "user" })),
      ...providers.map((account) => ({ ...account, role: "provider" })),
    ]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Backwards-compatible alias
exports.getForgotPasswordStatus = exports.checkForgotApproval;
