const { MemoryStore } = require("./sessionStore");
const store = MemoryStore; // único singleton
module.exports = { store };