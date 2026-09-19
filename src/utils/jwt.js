const jwt = require("jsonwebtoken");

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const sendToken = (user, statusCode, res, message = "Success") => {
  const token = generateToken(user._id);
  user.password        = undefined;
  user.otp             = undefined;
  user.otpExpires      = undefined;
  user.resetToken      = undefined;
  user.resetTokenExpires = undefined;

  res.status(statusCode).json({ success: true, message, token, data: { user } });
};

module.exports = { generateToken, sendToken };
