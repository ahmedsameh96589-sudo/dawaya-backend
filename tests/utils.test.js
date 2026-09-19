const escapeRegex = require("../src/utils/escapeRegex");
const { generateOTP, hashOTP } = require("../src/utils/otp");
const ApiFeatures = require("../src/utils/apiFeatures");

// Records what ApiFeatures passes to Mongoose instead of querying a database.
const fakeQuery = () => {
  const q = { filters: [] };
  q.find = (f) => { q.filters.push(f); return q; };
  return q;
};

describe("escapeRegex", () => {
  it("matches special characters literally", () => {
    const re = new RegExp(escapeRegex("vitamin c (1000mg)+"), "i");
    expect(re.test("Vitamin C (1000mg)+ tablets")).toBe(true);
    expect(re.test("vitamin c 1000mg")).toBe(false);
  });

  it("neutralises catastrophic-backtracking patterns", () => {
    const re = new RegExp(escapeRegex("(a+)+$"));
    const start = Date.now();
    re.test("a".repeat(30) + "!");
    expect(Date.now() - start).toBeLessThan(50);
  });
});

describe("generateOTP", () => {
  it("returns a 6-digit code", () => {
    for (let i = 0; i < 200; i++) expect(generateOTP()).toMatch(/^\d{6}$/);
  });

  it("hashes codes deterministically", () => {
    expect(hashOTP("123456")).toBe(hashOTP("123456"));
    expect(hashOTP("123456")).not.toBe(hashOTP("654321"));
  });
});

describe("ApiFeatures.filter", () => {
  it("turns range filters into MongoDB operators", () => {
    const q = fakeQuery();
    new ApiFeatures(q, { price: { gte: "10", lt: "50" }, isFeatured: "true" }).filter();
    expect(q.filters[0]).toEqual({ price: { $gte: "10", $lt: "50" }, isFeatured: "true" });
  });

  it("drops operator injection attempts", () => {
    const q = fakeQuery();
    new ApiFeatures(q, { $where: "sleep(1000)", name: { $ne: "x" }, price: { gte: "5", $regex: ".*" } }).filter();
    expect(q.filters[0]).toEqual({ price: { $gte: "5" } });
  });

  it("ignores paging, sorting and search keys", () => {
    const q = fakeQuery();
    new ApiFeatures(q, { page: "2", limit: "10", sort: "price", fields: "name", search: "pan" }).filter();
    expect(q.filters[0]).toEqual({});
  });
});

describe("ApiFeatures.search", () => {
  it("searches the given fields case-insensitively with escaped input", () => {
    const q = fakeQuery();
    new ApiFeatures(q, { search: "c++" }).search(["name", "activeIngredient"]);
    const { $or } = q.filters[0];
    expect($or).toHaveLength(2);
    expect($or[0].name.test("Vitamin C++ Complex")).toBe(true);
    expect($or[0].name.flags).toBe("i");
  });
});
