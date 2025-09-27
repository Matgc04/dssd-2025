const crypto = require("node:crypto");

const GLOBAL_KEY = "__mem_bonita_store__";
global[GLOBAL_KEY] = global[GLOBAL_KEY] || new Map(); // <- persiste entre HMR
const mem = global[GLOBAL_KEY];

const MemoryStore = {
  async get(sid) {
    const item = mem.get(sid);
    if (!item) return null;
    if (Date.now() > item.exp) { mem.delete(sid); return null; }
    return item.data;
  },
  async set(sid, data, ttlSec) {
    mem.set(sid, { data, exp: Date.now() + ttlSec * 1000 });
  },
  async del(sid) { mem.delete(sid); },
};

function newSid() { return crypto.randomUUID(); }

module.exports = { MemoryStore, newSid };