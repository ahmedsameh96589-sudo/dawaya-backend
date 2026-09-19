const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const requireTokenForPrivateUploads = require("../src/middlewares/privateUploads");
const { getNews } = require("../src/controllers/newsController");

process.env.JWT_SECRET = "test-secret";

describe("private uploads", () => {
  const app = express();
  app.use("/uploads", requireTokenForPrivateUploads, (req, res) => res.send("file"));
  const token = jwt.sign({ id: "u1" }, process.env.JWT_SECRET);

  it("serves public images without a token", async () => {
    await request(app).get("/uploads/images-123.png").expect(200);
  });

  it.each(["prescription-1.jpg", "attachment-9.png"])("blocks %s without a token", async (file) => {
    await request(app).get(`/uploads/${file}`).expect(401);
  });

  it("blocks a forged token", async () => {
    const forged = jwt.sign({ id: "u1" }, "wrong-secret");
    await request(app).get("/uploads/prescription-1.jpg").set("Authorization", `Bearer ${forged}`).expect(401);
  });

  it("serves private files to a signed-in user", async () => {
    await request(app).get("/uploads/prescription-1.jpg").set("Authorization", `Bearer ${token}`).expect(200);
  });
});

describe("GET /api/news", () => {
  const app = express();
  app.get("/api/news", getNews);

  it("returns curated articles in NewsAPI shape when no key is set", async () => {
    delete process.env.NEWS_API_KEY;
    const res = await request(app).get("/api/news").expect(200);
    const [first] = res.body.data.articles;
    expect(res.body.count).toBeGreaterThan(0);
    expect(first).toEqual(expect.objectContaining({ title: expect.any(String), source: { name: "DAWAYA" } }));
  });

  it("falls back to curated articles when NewsAPI fails", async () => {
    process.env.NEWS_API_KEY = "test-key";
    const realFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await request(app).get("/api/news?language=ar").expect(200);
      expect(res.body.data.articles[0].source.name).toBe("DAWAYA");
    } finally {
      global.fetch = realFetch;
      spy.mockRestore();
      delete process.env.NEWS_API_KEY;
    }
  });
});
