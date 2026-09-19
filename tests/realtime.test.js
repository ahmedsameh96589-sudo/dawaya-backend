const http = require("http");
const jwt = require("jsonwebtoken");
const { io: connect } = require("socket.io-client");
const { initRealtime, emitToConsultation, roomFor } = require("../src/realtime");

process.env.JWT_SECRET = "test-secret";

const token = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET);

const client = (url, auth) =>
  new Promise((resolve, reject) => {
    const socket = connect(url, { auth, transports: ["websocket"], reconnection: false });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => reject(err));
  });

describe("realtime", () => {
  let server, url, sockets = [];

  beforeAll((done) => {
    server = http.createServer();
    initRealtime(server);
    server.listen(0, () => { url = `http://localhost:${server.address().port}`; done(); });
  });

  afterEach(() => { sockets.forEach((s) => s.disconnect()); sockets = []; });
  afterAll((done) => { server.close(done); });

  it("rejects connections without a valid token", async () => {
    await expect(client(url, {})).rejects.toThrow("Not authorized.");
    await expect(client(url, { token: "junk" })).rejects.toThrow("Invalid or expired token.");
  });

  it("delivers a consultation event to the patient and the doctor only", async () => {
    const patient = await client(url, { token: token("u1", "user") });
    const doctor = await client(url, { token: token("d1", "doctor") });
    const stranger = await client(url, { token: token("u2", "user") });
    sockets.push(patient, doctor, stranger);

    const received = (socket) =>
      new Promise((resolve) => socket.once("consultation:message", resolve));
    const strangerGotOne = new Promise((resolve) => {
      stranger.once("consultation:message", () => resolve(true));
      setTimeout(() => resolve(false), 300);
    });

    emitToConsultation({ _id: "c9", user: "u1", doctor: "d1" }, "consultation:message", {
      message: { text: "hi" },
    });

    const [toPatient, toDoctor] = await Promise.all([received(patient), received(doctor)]);
    expect(toPatient).toEqual({ consultationId: "c9", message: { text: "hi" } });
    expect(toDoctor).toEqual(toPatient);
    expect(await strangerGotOne).toBe(false);
  });

  it("names rooms by account type", () => {
    expect(roomFor("doctor", "d1")).toBe("doctor:d1");
    expect(roomFor("user", "u1")).toBe("user:u1");
    expect(roomFor("admin", "a1")).toBe("user:a1");
  });
});
