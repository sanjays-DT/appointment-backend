const validator = require("validator");

/* ================= NAME VALIDATOR ================= */
exports.validateName = (name) => {
  if (!name) return "Name is required";

  if (!validator.isLength(name.trim(), { min: 3 })) {
    return "Name must be at least 3 characters long";
  }

  return null;
};

/* ================= EMAIL VALIDATOR ================= */
exports.validateEmail = (email) => {
  if (!email) return "Email is required";

  if (!validator.isEmail(email)) {
    return "Invalid email address";
  }

  return null;
};

/* ================= PASSWORD VALIDATOR ================= */
exports.validatePassword = (password) => {
  if (!password) return "Password is required";

  if (
    !validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
  ) {
    return "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";
  }

  return null;
};
