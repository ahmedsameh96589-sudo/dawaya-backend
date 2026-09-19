// ─── Lazy init — won't crash if credentials are missing ───────
let _client = null;

const getClient = () => {
  if (_client) return _client;

  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token || !sid.startsWith("AC")) {
    console.warn("⚠️  Twilio credentials not configured — SMS will be skipped.");
    return null;
  }

  const twilio = require("twilio");
  _client = twilio(sid, token);
  return _client;
};

const sendSMS = async (to, body) => {
  const c = getClient();
  if (!c) {
    console.log(`📵 SMS skipped → ${to}: ${body}`);
    return;
  }
  await c.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER, to });
};

const sendOTPSMS = async (phone, otp, purpose = "verification") => {
  const messages = {
    verification:    `Your DAWAYA verification code is: ${otp}. Valid for ${process.env.OTP_EXPIRES_MINUTES || 10} minutes.`,
    forgot_password: `Your DAWAYA password reset code is: ${otp}. Valid for ${process.env.OTP_EXPIRES_MINUTES || 10} minutes.`,
    login:           `Your DAWAYA login code is: ${otp}. Valid for ${process.env.OTP_EXPIRES_MINUTES || 10} minutes.`,
  };
  await sendSMS(phone, messages[purpose] || `Your DAWAYA OTP is: ${otp}`);
};

module.exports = { sendSMS, sendOTPSMS };
