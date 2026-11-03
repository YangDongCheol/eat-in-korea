// Runs tests.js headless with the same script order as test.html: `node run-tests.js`
const fs = require("fs"), vm = require("vm"), path = require("path");
for (const f of ["logic.js", "strings.js", "menus.js", "tests.js"]) {
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
Promise.all(pending).then(report);
