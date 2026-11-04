// Runs tests.js headless with the same script order as test.html: `node run-tests.js`
const fs = require("fs"), vm = require("vm"), path = require("path");
for (const f of ["logic.js", "strings.js", "menus.js", "modes.js", "tests.js"]) {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, "utf8"), { filename: f });
}
const swSrc = () => fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
test("sw install fetches with cache: reload", () => {
  const listeners = {}, added = [];
  const ctx = {
    self: { addEventListener: (t, fn) => (listeners[t] = fn), skipWaiting: () => {} },
    caches: { open: async () => ({ addAll: async (reqs) => added.push(...reqs) }) },
    Request: class { constructor(url, init) { this.url = url; this.cache = init && init.cache; } },
  };
  vm.runInNewContext(swSrc(), ctx);
  let done;
  listeners.install({ waitUntil: (p) => (done = p) });
  return done.then(() => {
    eq(added.length > 0, true);
    eq(added.filter((r) => typeof r === "string" || r.cache !== "reload").length, 0);
  });
});
test("sw cache name versioned", () => {
  eq(/const CACHE = "eik-v\d+"/.test(swSrc()), true);
});
test("sw activate only deletes this app's old caches", () => {
  const listeners = {}, deleted = [];
  const cur = swSrc().match(/const CACHE = "(eik-v\d+)"/)[1];
  const ctx = {
    self: { addEventListener: (t, fn) => (listeners[t] = fn), clients: { claim: async () => {} } },
    caches: { keys: async () => ["wte-v3", "eik-v0", cur], delete: async (k) => deleted.push(k) },
  };
  vm.runInNewContext(swSrc(), ctx);
  let done;
  listeners.activate({ waitUntil: (p) => (done = p) });
  return done.then(() => eq(deleted, ["eik-v0"]));
});
test("sw FILES matches assets index.html loads", () => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const files = JSON.parse(swSrc().match(/const FILES = (\[.*?\]);/)[1]);
  const norm = (u) => u.replace(/^\.\//, "");
  const used = [...html.matchAll(/<(?:script|link)[^>]*?(?:src|href)="([^"]+)"/g)].map((m) => norm(m[1])).filter((u) => !/^(https?:)?\/\//.test(u));
  for (const u of used) if (!files.map(norm).includes(u)) throw new Error(`${u} not in FILES`);
  for (const f of files) if (f !== "./" && !fs.existsSync(path.join(__dirname, f))) throw new Error(`${f} missing on disk`);
});
Promise.all(pending).then(report);
