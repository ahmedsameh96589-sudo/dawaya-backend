// Socket.IO layer: pushes consultation (chat) events to the two people in a
// consultation the moment they happen, so the app does not have to poll.
//
// Clients connect with `auth: { token }` (the same JWT as the REST API).
// Each connection joins a room for its account — `user:<id>` or
// `doctor:<id>` — and the controllers emit to those rooms.

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

function roomFor(role, id) {
  return `${role === "doctor" ? "doctor" : "user"}:${id}`;
}

function authenticate(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Not authorized."));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.role = decoded.role === "doctor" ? "doctor" : "user";
    socket.data.id = decoded.id;
    next();
  } catch {
    next(new Error("Invalid or expired token."));
  }
}

function initRealtime(httpServer, { corsOrigins = [] } = {}) {
  io = new Server(httpServer, {
    cors: corsOrigins.length ? { origin: corsOrigins } : undefined,
  });
  io.use(authenticate);
  io.on("connection", (socket) => {
    socket.join(roomFor(socket.data.role, socket.data.id));
  });
  return io;
}

// Sends `event` to both participants of a consultation. Safe to call when
// realtime is not initialized (e.g. in unit tests of the controllers).
function emitToConsultation(consultation, event, payload) {
  if (!io) return;
  io.to(roomFor("user", consultation.user))
    .to(roomFor("doctor", consultation.doctor))
    .emit(event, { consultationId: consultation._id.toString(), ...payload });
}

module.exports = { initRealtime, emitToConsultation, authenticate, roomFor };
