const escapeRegex = require("./escapeRegex");

class ApiFeatures {
  constructor(query, queryString) {
    this.query       = query;
    this.queryString = queryString;
    this.page        = 1;
    this.limit       = 12;
  }

  filter() {
    const queryObj = { ...this.queryString };
    ["page", "sort", "limit", "fields", "search"].forEach((f) => delete queryObj[f]);
    // Only plain values and range operators are allowed. Anything else —
    // e.g. ?$where=… or ?price[$ne]=… — could run arbitrary MongoDB operators.
    const filter = {};
    for (const [key, value] of Object.entries(queryObj)) {
      if (key.startsWith("$")) continue;
      if (value && typeof value === "object") {
        const range = {};
        for (const op of ["gte", "gt", "lte", "lt"]) {
          if (typeof value[op] === "string") range[`$${op}`] = value[op];
        }
        if (Object.keys(range).length) filter[key] = range;
      } else {
        filter[key] = value;
      }
    }
    this.query = this.query.find(filter);
    return this;
  }

  search(fields = ["name"]) {
    if (this.queryString.search) {
      const regex  = new RegExp(escapeRegex(this.queryString.search), "i");
      this.query   = this.query.find({ $or: fields.map((f) => ({ [f]: regex })) });
    }
    return this;
  }

  sort() {
    this.query = this.queryString.sort
      ? this.query.sort(this.queryString.sort.split(",").join(" "))
      : this.query.sort("-createdAt");
    return this;
  }

  limitFields() {
    this.query = this.queryString.fields
      ? this.query.select(this.queryString.fields.split(",").join(" "))
      : this.query.select("-__v");
    return this;
  }

  paginate(defaultLimit = 12) {
    this.page  = parseInt(this.queryString.page)  || 1;
    this.limit = parseInt(this.queryString.limit) || defaultLimit;
    this.query = this.query.skip((this.page - 1) * this.limit).limit(this.limit);
    return this;
  }
}

module.exports = ApiFeatures;
