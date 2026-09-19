const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Generic send ─────────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};

// ─── OTP Email ────────────────────────────────────────────────
const sendOTPEmail = async (to, otp, purpose = "verification") => {
  const titles = {
    verification:     "Verify Your DAWAYA Account",
    forgot_password:  "Reset Your DAWAYA Password",
    login:            "Your DAWAYA Login OTP",
  };

  const messages = {
    verification:    "Please use the code below to verify your account.",
    forgot_password: "Please use the code below to reset your password.",
    login:           "Please use the code below to complete your login.",
  };

  await sendEmail({
    to,
    subject: titles[purpose] || "Your DAWAYA OTP",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:8px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="color:#1a73e8;">💊 DAWAYA Pharmacy</h2>
        </div>
        <p style="color:#333;font-size:15px;">${messages[purpose] || "Your OTP code:"}</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
          <h1 style="color:#1a73e8;letter-spacing:8px;font-size:40px;margin:0;">${otp}</h1>
        </div>
        <p style="color:#666;font-size:13px;">This code expires in <strong>${process.env.OTP_EXPIRES_MINUTES || 10} minutes</strong>.</p>
        <p style="color:#666;font-size:13px;">If you didn't request this, please ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;" />
        <p style="color:#aaa;font-size:12px;text-align:center;">© ${new Date().getFullYear()} DAWAYA Pharmacy. All rights reserved.</p>
      </div>
    `,
  });
};

// ─── Reset Password Link Email ────────────────────────────────
const sendResetPasswordEmail = async (to, resetURL) => {
  await sendEmail({
    to,
    subject: "Reset Your DAWAYA Password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:8px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="color:#1a73e8;">💊 DAWAYA Pharmacy</h2>
        </div>
        <p style="color:#333;font-size:15px;">You requested a password reset. Click the button below to set a new password:</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${resetURL}" style="background:#1a73e8;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold;">Reset Password</a>
        </div>
        <p style="color:#666;font-size:13px;">This link expires in <strong>30 minutes</strong>.</p>
        <p style="color:#666;font-size:13px;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="color:#1a73e8;font-size:13px;word-break:break-all;">${resetURL}</p>
        <p style="color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;" />
        <p style="color:#aaa;font-size:12px;text-align:center;">© ${new Date().getFullYear()} DAWAYA Pharmacy. All rights reserved.</p>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendOTPEmail, sendResetPasswordEmail };
