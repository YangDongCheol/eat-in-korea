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
const A = (restrictions, spice, feel, mode = "dine") => ({ restrictions, spice, feel, mode });
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

// --- staff card, links, storage, sanitizers ---
const EXPECTED_NOTES = {
  pork: "저는 돼지고기를 먹을 수 없어요. 돼지고기나 돼지고기 육수가 들어가나요?",
  vegetarian: "저는 채식을 해요. 고기, 생선, 고기 육수, 젓갈이 들어가나요?",
  seafood: "저는 해산물을 먹을 수 없어요. 생선, 새우, 조개, 젓갈이 들어가나요?",
  nuts: "저는 견과류와 땅콩을 먹을 수 없어요. 들어가나요?",
};
test("staffCard no restrictions", () => {
  eq(staffCard(M[0], []), { dish: "김치찌개", order: "이거 1인분 주세요.", notes: [] });
});
for (const r of Object.keys(EXPECTED_NOTES)) {
  test(`staffCard each sentence: ${r}`, () => eq(staffCard(M[0], [r]).notes, [EXPECTED_NOTES[r]]));
}
test("staffCard order", () => {
  eq(staffCard(M[0], ["nuts", "pork", "seafood", "vegetarian"]).notes,
    [EXPECTED_NOTES.pork, EXPECTED_NOTES.vegetarian, EXPECTED_NOTES.seafood, EXPECTED_NOTES.nuts]);
});
test("mapsUrl encodes", () => {
  eq(mapsUrl({ ko: "떡볶이 & 튀김" }),
    "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("떡볶이 & 튀김 식당"));
});

const fake = (o = {}) => ({ getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = v; } });
const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
test("loadJSON missing", () => eq(loadJSON(fake(), "history", []), []));
test("loadJSON broken", () => eq(loadJSON(fake({ history: "{oops" }), "history", []), []));
test("storage throws", () => {
  eq(loadJSON(broken, "history", []), []);
  saveJSON(broken, "history", [1]);
});
test("round trip", () => {
  const s = fake();
  saveJSON(s, "answers", A(["pork"], "hot", "light"));
  eq(loadJSON(s, "answers", null), A(["pork"], "hot", "light"));
});

test("addEntry caps at 100", () => {
  const h = Array.from({ length: 100 }, (_, i) => ({ id: "m" + i, at: 100 - i }));
  const out = addEntry(h, "new", 999);
  eq(out.length, 100);
  eq(out[0], { id: "new", at: 999 });
  eq(out.some(e => e.id === "m99"), false);
  eq(h.length, 100);
  eq(h[0].id, "m0");
});

test("sanitizeAnswers null/string/number", () => {
  for (const raw of [null, "x", 42]) eq(sanitizeAnswers(raw), DEFAULT_ANSWERS);
});
test("sanitizeAnswers unknown values", () => {
  eq(sanitizeAnswers({ restrictions: ["pork", "moon", "pork"], spice: "lava", feel: "x" }), A(["pork"], "none", "any"));
});
test("sanitizeAnswers keeps valid", () => {
  eq(sanitizeAnswers(A(["nuts"], "hot", "light")), A(["nuts"], "hot", "light"));
});
test("sanitizeAnswers returns new object", () => {
  const out = sanitizeAnswers(null);
  eq(out !== DEFAULT_ANSWERS && out.restrictions !== DEFAULT_ANSWERS.restrictions, true);
});

test("sanitizeAnswers mode", () => {
  eq(sanitizeAnswers({ mode: "delivery" }).mode, "delivery");
  for (const raw of [{ mode: "fly" }, { mode: 5 }, {}]) eq(sanitizeAnswers(raw).mode, "dine");
});
test("sanitizeAnswers old stored value", () => {
  eq(sanitizeAnswers({ restrictions: ["nuts"], spice: "hot", feel: "light" }), A(["nuts"], "hot", "light", "dine"));
});
const UA_AND = "Mozilla/5.0 (Linux; Android 14; SM-S936N) AppleWebKit/537.36";
const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
const playFb = pkg => "intent://#Intent;package=" + pkg + ";S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3D" + pkg + ";end";
test("DELIVERY_APPS", () => {
  eq(DELIVERY_APPS, [
    { id: "coupangeats", pkg: "com.coupang.mobile.eats", web: "https://www.coupangeats.com/" },
    { id: "baemin", pkg: "com.sampleapp", web: "https://www.baemin.com/" },
  ]);
});
test("isAndroid", () => {
  eq(isAndroid(UA_AND), true);
  eq(isAndroid("linux android"), true);
  for (const ua of [UA_IOS, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "", undefined, null]) eq(isAndroid(ua), false);
});
test("deliveryUrl android", () => {
  eq(deliveryUrl(DELIVERY_APPS[0], UA_AND), "intent://#Intent;package=com.coupang.mobile.eats;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.coupang.mobile.eats;end");
  eq(deliveryUrl(DELIVERY_APPS[1], UA_AND), playFb("com.sampleapp"));
});
test("deliveryUrl non-android", () => {
  for (const ua of [UA_IOS, undefined]) DELIVERY_APPS.forEach(a => eq(deliveryUrl(a, ua), a.web));
});

const ID = ["a", "b"];
test("sanitizeHistory non-array", () => {
  for (const raw of [{}, null, "x"]) eq(sanitizeHistory(raw, ID), []);
});
test("sanitizeHistory filters", () => {
  eq(sanitizeHistory([{ id: "zzz", at: 1 }, { id: "a", at: NaN }, { id: "a", at: "5" }, null, { id: "b", at: 7 }], ID), [{ id: "b", at: 7 }]);
});
test("sanitizeHistory caps at 100", () => {
  const raw = Array.from({ length: 150 }, (_, i) => ({ id: "a", at: i }));
  eq(sanitizeHistory(raw, ID).length, 100);
});

// --- strings ---
const FORBIDDEN = ["halal", "할랄", "清真", "safe", "안전", "安全", "guarantee", "保证", "allergen-free", "no allergens", "无过敏原", "过敏原", "알레르기 걱정 없", "알레르기 없", "알레르기 안심", "무알레르기", "보장"];
const STRING_KEYS = ["title", "subtitle", "langEn", "langZh", "qRestrict", "optPork", "optVeg", "optSeafood", "optNuts", "qSpice", "spiceNone", "spiceMild", "spiceHot", "qFeel", "feelHearty", "feelLight", "feelAny", "go", "historyLink", "historyTitle", "noHistory", "back", "another", "showStaff", "findNearby", "pickedTag", "contains", "tagPork", "tagMeat", "tagSeafood", "tagNuts", "tagNone", "disclaimer", "noMatch", "noMatchHint", "staffBack", "remove", "spiceLabel", "qMode", "modeDine", "modeDelivery", "deliveryCoupang", "deliveryBaemin", "deliveryHint", "deliveryCopyFailed", "langKo"];
test("strings keys match", () => {
  const en = Object.keys(STRINGS.en).sort();
  eq(en, Object.keys(STRINGS.zh).sort());
  eq(en, Object.keys(STRINGS.ko).sort());
  eq(en, [...STRING_KEYS].sort());
});
test("strings not empty", () => {
  for (const l of ["en", "zh", "ko"]) for (const [k, v] of Object.entries(STRINGS[l]))
    if (typeof v !== "string" || !v.trim()) throw new Error(`${l}.${k} empty`);
});
test("strings en disclaimer exact", () => {
  eq(STRINGS.en.disclaimer, "Ingredients shown are what this dish usually contains. Every restaurant is different, so always check with the staff. This app is not a substitute for allergy care.");
});
test("strings ko disclaimer exact", () => {
  eq(STRINGS.ko.disclaimer, "표시된 재료는 이 음식에 보통 들어가는 재료예요. 식당마다 다르니 꼭 직원에게 확인하세요. 이 앱은 알레르기 대비를 대신하지 않아요.");
});
test("strings ko has hangul", () => {
  for (const [k, v] of Object.entries(STRINGS.ko))
    if (!["title", "langEn", "langZh", "deliveryCoupang", "deliveryBaemin"].includes(k) && !/[가-힣]/.test(v)) throw new Error(`ko.${k} has no hangul`);
});
test("strings ko nut labels mention peanuts", () => {
  for (const k of ["optNuts", "tagNuts"]) if (!STRINGS.ko[k].includes("땅콩")) throw new Error(`ko.${k} lacks 땅콩`);
});
test("strings placeholders", () => {
  for (const l of ["en", "zh", "ko"]) eq(STRINGS[l].deliveryHint.split("{name}").length - 1, 1);
});
test("strings zh has chinese", () => {
  for (const [k, v] of Object.entries(STRINGS.zh))
    if (!["title", "langEn", "langZh", "langKo", "deliveryCoupang", "deliveryBaemin"].includes(k) && !/[\u4e00-\u9fff]/.test(v)) throw new Error(`zh.${k} has no hanzi`);
});
test("strings no guarantee claims", () => {
  for (const l of ["en", "zh", "ko"]) for (const [k, v] of Object.entries(STRINGS[l]))
    for (const w of FORBIDDEN) if (v.toLowerCase().includes(w)) throw new Error(`${l}.${k} contains "${w}"`);
});
test("detectLang", () => {
  for (const z of ["zh-CN", "zh-TW", "ZH"]) eq(detectLang(z), "zh");
  for (const k of ["ko-KR", "KO", "ko"]) eq(detectLang(k), "ko");
  for (const e of ["en-US", "ja-JP", "", undefined, null]) eq(detectLang(e), "en");
});

// --- menus ---
const nonEmpty = v => typeof v === "string" && v.trim() !== "";
test("MENUS size", () => {
  if (MENUS.length < 60 || MENUS.length > 80) throw new Error(`size ${MENUS.length}`);
});
test("MENUS valid", () => {
  const tags = ["pork", "meat", "seafood", "nuts"];
  for (const m of MENUS) {
    const where = m && m.id;
    if (!/^[a-z0-9-]+$/.test(m.id)) throw new Error(`bad id ${where}`);
    for (const v of [m.ko, m.emoji, m.rom, m.name?.en, m.name?.zh, m.desc?.en, m.desc?.zh])
      if (!nonEmpty(v)) throw new Error(`empty field in ${where}`);
    if (!Number.isInteger(m.spice) || m.spice < 0 || m.spice > 3) throw new Error(`spice ${where}`);
    if (!["hearty", "light"].includes(m.feel)) throw new Error(`feel ${where}`);
    if (!Array.isArray(m.contains) || m.contains.some(c => !tags.includes(c)) || new Set(m.contains).size !== m.contains.length)
      throw new Error(`contains ${where}`);
    if (m.contains.includes("pork") && !m.contains.includes("meat")) throw new Error(`pork without meat ${where}`);
  }
  eq(new Set(MENUS.map(m => m.id)).size, MENUS.length);
  eq(new Set(MENUS.map(m => m.ko)).size, MENUS.length);
});
test("MENUS zh has chinese", () => {
  for (const m of MENUS) for (const v of [m.name.zh, m.desc.zh])
    if (!/[一-鿿]/.test(v)) throw new Error(`${m.id} zh has no hanzi`);
});
test("MENUS no guarantee claims", () => {
  for (const m of MENUS) for (const v of [m.ko, m.name.en, m.name.zh, m.desc.en, m.desc.zh, m.desc.ko])
    for (const w of FORBIDDEN) if (v.toLowerCase().includes(w)) throw new Error(`${m.id} contains "${w}"`);
});
const allowedCount = (restrictions, spice) => MENUS.filter(m => allowed(m, A(restrictions, spice, "any"))).length;
test("single restriction leaves enough", () => {
  for (const r of ["pork", "seafood", "nuts"]) if (allowedCount([r], "hot") < 20) throw new Error(`${r}: ${allowedCount([r], "hot")}`);
  if (allowedCount(["vegetarian"], "hot") < 8) throw new Error(`vegetarian: ${allowedCount(["vegetarian"], "hot")}`);
});
test("MENUS desc mentioning nuts is tagged nuts", () => {
  const nutWords = /\b(nuts?|peanuts?|walnuts?|almonds?|chestnuts?)\b|坚果|花生|核桃|松子|杏仁|栗/i;
  for (const m of MENUS) if (nutWords.test(m.desc.en + " " + m.desc.zh) && !m.contains.includes("nuts"))
    throw new Error(`${m.id} mentions nuts but has no nuts tag`);
});
test("MENUS desc mentioning pork products is tagged pork", () => {
  for (const m of MENUS) if (/\b(pork|ham|bacon|sausage|spam|mandu|dumplings?)\b/i.test(m.desc.en) && !m.contains.includes("pork"))
    throw new Error(`${m.id} desc mentions pork but is not tagged`);
});
test("MENUS ko desc", () => {
  for (const m of MENUS) if (!nonEmpty(m.desc.ko) || !/[가-힣]/.test(m.desc.ko)) throw new Error(`${m.id} desc.ko missing or no hangul`);
});
test("MENUS ko nut keywords imply nuts tag", () => {
  for (const m of MENUS) if (/견과|땅콩|호두|잣|아몬드/.test(m.desc.ko) && !m.contains.includes("nuts"))
    throw new Error(`${m.id} desc.ko mentions nuts but has no nuts tag`);
});
test("vegetarian hearty has menus", () => {
  const n = MENUS.filter(m => allowed(m, A(["vegetarian"], "hot", "hearty"))).length;
  if (n < 2) throw new Error(`only ${n}`);
});
test("all four restrictions still has menus", () => {
  const n = allowedCount(["pork", "vegetarian", "seafood", "nuts"], "none");
  if (n < 3) throw new Error(`only ${n}`);
});
test("every spice level has menus", () => {
  for (const s of [0, 1, 2, 3]) {
    const n = MENUS.filter(m => m.spice === s).length;
    if (n < 5) throw new Error(`spice ${s}: ${n}`);
  }
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
