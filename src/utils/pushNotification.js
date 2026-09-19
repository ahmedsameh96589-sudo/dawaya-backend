const admin = require("firebase-admin");
const fs   = require("fs");
const path = require("path");

let initAttempted = false;
let initReady = false;

function initFirebase() {
  if (admin.apps.length) {
    initReady = true;
    return true;
  }
  if (initAttempted) return initReady;
  initAttempted = true;

  try {
    const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!accountPath) {
      console.warn("🔔 Push disabled: set FIREBASE_SERVICE_ACCOUNT in .env");
      return false;
    }

    const resolved = path.resolve(accountPath);
    if (!fs.existsSync(resolved)) {
      console.warn(`🔔 Push disabled: service account not found at ${resolved}`);
      return false;
    }

    const serviceAccount = require(resolved);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initReady = true;
    console.log("🔔 Firebase Admin ready for push notifications.");
    return true;
  } catch (err) {
    console.error("🔔 Firebase Admin init failed:", err.message);
    return false;
  }
}

async function sendPush({ token, title, body, data = {} }) {
  if (!token) {
    console.warn("🔔 Push skipped: no FCM token for recipient.");
    return false;
  }
  if (!initFirebase()) return false;

  try {
    const messageId = await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v == null ? "" : String(v)])
      ),
      android: { priority: "high", notification: { channelId: "dawayaa_messages" } },
      apns:    { payload: { aps: { sound: "default", badge: 1 } } },
    });
    console.log(`🔔 Push sent (${messageId}): ${title}`);
    return true;
  } catch (err) {
    const code = err.code || "";
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      console.warn("🔔 Stale FCM token — device should re-login to refresh token.");
    } else {
      console.error("🔔 Push send failed:", err.message);
    }
    return false;
  }
}

async function sendPushToUser(userId, payload) {
  const User = require("../models/User");
  const user = await User.findById(userId).select("+fcmToken");
  if (!user?.fcmToken) {
    console.warn(`🔔 Push skipped: user ${userId} has no fcmToken saved.`);
    return false;
  }
  return sendPush({ token: user.fcmToken, ...payload });
}

async function sendPushToDoctor(doctorId, payload) {
  const Doctor = require("../models/Doctor");
  const doctor = await Doctor.findById(doctorId).select("+fcmToken");
  if (!doctor?.fcmToken) {
    console.warn(`🔔 Push skipped: doctor ${doctorId} has no fcmToken saved.`);
    return false;
  }
  return sendPush({ token: doctor.fcmToken, ...payload });
}

module.exports = { initFirebase, sendPush, sendPushToUser, sendPushToDoctor };
