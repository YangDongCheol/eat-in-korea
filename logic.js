// Pure logic (no DOM): menu filtering and picking.
const RECENT_MS = 72 * 3600 * 1000;

// Restriction/spice/feel only; history and shown are handled by pick().
function allowed(menu, a) {
  const has = x => menu.contains.includes(x);
  const r = a.restrictions;
  return !(r.includes("pork") && has("pork"))
    && !(r.includes("vegetarian") && (has("meat") || has("seafood")))
    && !(r.includes("seafood") && has("seafood"))
    && !(r.includes("nuts") && has("nuts"))
    && (a.spice === "hot" || menu.spice <= (a.spice === "none" ? 0 : 1))
    && (a.feel === "any" || menu.feel === a.feel);
}

// Returns { menu, cycled }. cycled: every allowed menu was already shown this session — caller resets shown to [menu.id].
function pick(menus, answers, history, shown, now, rand = Math.random) {
  const matched = menus.filter(m => allowed(m, answers));
  if (!matched.length) return { menu: null, cycled: false };
  let pool = matched.filter(m => !shown.includes(m.id));
  const cycled = !pool.length;
  if (cycled) pool = matched;

  const lastAt = {};
  for (const e of history) lastAt[e.id] = Math.max(lastAt[e.id] ?? -Infinity, e.at);
  const fresh = pool.filter(m => !(now - (lastAt[m.id] ?? -Infinity) < RECENT_MS));
  if (fresh.length) return { menu: fresh[Math.floor(rand() * fresh.length)], cycled };
  // Everything was eaten recently: take the one eaten longest ago.
  const oldest = pool.reduce((a, b) => (lastAt[b.id] < lastAt[a.id] ? b : a));
  return { menu: oldest, cycled };
}

const DEFAULT_ANSWERS = { restrictions: [], spice: "none", feel: "any", mode: "dine" };
const RESTRICTIONS = ["pork", "vegetarian", "seafood", "nuts"]; // also the notes order
const NOTES = {
  pork: "저는 돼지고기를 먹을 수 없어요. 돼지고기나 돼지고기 육수가 들어가나요?",
  vegetarian: "저는 채식을 해요. 고기, 생선, 고기 육수, 젓갈이 들어가나요?",
  seafood: "저는 해산물을 먹을 수 없어요. 생선, 새우, 조개, 젓갈이 들어가나요?",
  nuts: "저는 견과류와 땅콩을 먹을 수 없어요. 들어가나요?",
};
const HISTORY_MAX = 100;

function staffCard(menu, restrictions) {
  return { dish: menu.ko, order: "이거 1인분 주세요.", notes: RESTRICTIONS.filter(r => restrictions.includes(r)).map(r => NOTES[r]) };
}

function mapsUrl(menu) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(menu.ko + " 식당");
}

// Storage may be missing, full, or throw (private mode) — never let that break the app.
function loadJSON(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

function saveJSON(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch {}
}

function addEntry(history, id, now) {
  return [{ id, at: now }, ...history].slice(0, HISTORY_MAX);
}

function sanitizeAnswers(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    restrictions: RESTRICTIONS.filter(x => Array.isArray(r.restrictions) && r.restrictions.includes(x)),
    spice: ["none", "mild", "hot"].includes(r.spice) ? r.spice : DEFAULT_ANSWERS.spice,
    feel: ["hearty", "light", "any"].includes(r.feel) ? r.feel : DEFAULT_ANSWERS.feel,
    mode: r.mode === "delivery" ? "delivery" : "dine",
  };
}

function sanitizeHistory(raw, validIds) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(e => e && validIds.includes(e.id) && Number.isFinite(e.at))
    .slice(0, HISTORY_MAX)
    .map(e => ({ id: e.id, at: e.at }));
}

const DELIVERY_APPS = [
  { id: "coupangeats", pkg: "com.coupang.mobile.eats", web: "https://www.coupangeats.com/" },
  { id: "baemin", pkg: "com.sampleapp", web: "https://www.baemin.com/" },
];

function isAndroid(ua) { return /android/i.test(ua || ""); }

// Android: intent URL (opens the app, else Play Store). Elsewhere: the web page.
function deliveryUrl(app, ua) {
  if (!isAndroid(ua)) return app.web;
  const play = encodeURIComponent("https://play.google.com/store/apps/details?id=" + app.pkg);
  return "intent://#Intent;package=" + app.pkg + ";S.browser_fallback_url=" + play + ";end";
}
