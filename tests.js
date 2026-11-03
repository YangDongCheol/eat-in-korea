// Tiny test runner: works in test.html (browser) and run-tests.js (node). Call report() after all tests.
const results = [], pending = [];
function test(name, fn) {
  const pass = () => results.push({ name, ok: true });
  const fail = (e) => results.push({ name, ok: false, msg: e.message });
  try {
    const r = fn();
    if (r && typeof r.then === "function") pending.push(r.then(pass, fail));
    else pass();
  } catch (e) { fail(e); }
}
function eq(a, b) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}, got ${x}`);
}


const mk = (id, ko, spice, feel, contains) => ({
  id, ko, emoji: "🍽", rom: id, name: { en: id, zh: id }, desc: { en: id, zh: id }, spice, feel, contains,
});
const M = [
  mk("kimchi", "김치찌개", 2, "hearty", ["pork", "meat", "seafood"]),
  mk("veg", "산채비빔밥", 1, "light", []),
  mk("galbitang", "갈비탕", 0, "hearty", ["meat"]),
  mk("shrimp", "새우탕", 0, "light", ["seafood"]),
  mk("noodle", "땅콩국수", 0, "light", ["nuts"]),
  mk("tteok", "떡볶이", 3, "light", ["seafood"]),
];
const A = (restrictions, spice, feel) => ({ restrictions, spice, feel });
const T = 1_000_000_000_000, H = 3600 * 1000;
const RANDS = [() => 0, () => 0.5, () => 0.99];
const ids = (args) => [...new Set(RANDS.map(r => pick(...args, r).menu.id))].sort();
const all = (a) => [...new Set([0, 1, 2, 3, 4, 5].map(k => pick(M, a, [], [], T, () => k / 6).menu.id))].sort();

// --- pick ---
test("no restrictions hot any returns all", () => {
  eq(all(A([], "hot", "any")), M.map(m => m.id).sort());
});
test("pork excludes pork", () => {
  eq(all(A(["pork"], "hot", "any")).includes("kimchi"), false);
});
test("vegetarian excludes meat and seafood", () => {
  eq(all(A(["vegetarian"], "hot", "any")), ["noodle", "veg"]);
});
test("seafood excludes seafood", () => {
  eq(all(A(["seafood"], "hot", "any")), ["galbitang", "noodle", "veg"]);
});
test("nuts excludes nuts", () => {
  eq(all(A(["nuts"], "hot", "any")).includes("noodle"), false);
});
test("combined restrictions", () => {
  eq(all(A(["pork", "nuts"], "hot", "any")), ["galbitang", "shrimp", "tteok", "veg"]);
});
test("spice none", () => {
  eq(all(A([], "none", "any")), ["galbitang", "noodle", "shrimp"]);
});
test("spice mild", () => {
  eq(all(A([], "mild", "any")), ["galbitang", "noodle", "shrimp", "veg"]);
});
test("feel hearty", () => {
  eq(all(A([], "hot", "hearty")), ["galbitang", "kimchi"]);
});
test("excludes eaten within 72h", () => {
  eq(ids([M, A([], "none", "any"), [{ id: "galbitang", at: T - 71 * H }], [], T]), ["noodle", "shrimp"]);
});
test("allows after 72h", () => {
  eq(pick(M, A([], "none", "any"), [{ id: "galbitang", at: T - 72 * H }], [], T, () => 0).menu.id, "galbitang");
});
test("all recent → oldest eaten", () => {
  const h = [{ id: "galbitang", at: T - 10 * H }, { id: "shrimp", at: T - 20 * H }, { id: "noodle", at: T - 30 * H }];
  eq(ids([M, A([], "none", "any"), h, [], T]), ["noodle"]);
});
test("skips shown", () => {
  eq(ids([M, A([], "none", "any"), [], ["galbitang", "shrimp"], T]), ["noodle"]);
});
test("cycles when all shown", () => {
  const r = pick(M, A([], "none", "any"), [], ["galbitang", "shrimp", "noodle"], T);
  eq(r.menu !== null, true);
  eq(r.cycled, true);
});
test("no match → null", () => {
  eq(pick(M, A(["vegetarian", "nuts"], "none", "hearty"), [], [], T), { menu: null, cycled: false });
});

// --- report ---
function report() {
  const failed = results.filter(r => !r.ok);
  const summary = `${failed.length ? "FAIL " + failed.length : "PASS " + results.length}/${results.length}`;
  if (typeof document !== "undefined") {
    document.title = summary;
    document.body.innerHTML = `<h1>${summary}</h1><ul>` +
      results.map(r => `<li>${r.ok ? "✅" : "❌"} ${r.name}${r.ok ? "" : " — " + r.msg}</li>`).join("") + "</ul>";
  } else {
    results.forEach(r => console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok ? "" : " — " + r.msg}`));
    console.log(summary);
    if (failed.length) process.exitCode = 1;
  }
}
