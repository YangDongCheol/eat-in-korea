// UI: ask -> result -> staff card, plus history. Logic lives in logic.js, text in strings.js.
const QUESTIONS = [
  ["mode", "qMode", false, [["dine", "modeDine", "🍴"], ["delivery", "modeDelivery", "🛵"]]],
  ["restrictions", "qRestrict", true, [["pork", "optPork", "🐷"], ["vegetarian", "optVeg", "🥬"], ["seafood", "optSeafood", "🐟"], ["nuts", "optNuts", "🥜"]]],
  ["spice", "qSpice", false, [["none", "spiceNone", "🙂"], ["mild", "spiceMild", "🌶️"], ["hot", "spiceHot", "🔥"]]],
  ["feel", "qFeel", false, [["hearty", "feelHearty", "🍖"], ["light", "feelLight", "🥗"], ["any", "feelAny", "🎲"]]],
];
const TAGS = { pork: "tagPork", meat: "tagMeat", seafood: "tagSeafood", nuts: "tagNuts" };
const $ = (id) => document.getElementById(id);

let store = null;
try { store = window.localStorage; } catch {} // access itself can throw in private mode

const savedLang = loadJSON(store, "eik:lang", null);
let lang = ["en", "zh", "ko"].includes(savedLang) ? savedLang : detectLang(navigator.language);
const answers = sanitizeAnswers(loadJSON(store, "eik:lastAnswers", null));
let history = sanitizeHistory(loadJSON(store, "eik:history", []), MENUS.map(m => m.id));
let shown = [];
let current = null;
let recorded = false;
let hint = null; // delivery tip state: null | "copied" | "failed"; kept so a language switch can redraw it
const chipLabels = []; // [button, stringKey, emoji] so a language switch can relabel without rebuilding

function show(id, focusId) {
  for (const s of document.querySelectorAll("main > section")) s.hidden = s.id !== id;
  $("langs").hidden = id === "staff";
  window.scrollTo(0, 0);
  if (focusId) $(focusId).focus();
}

// Built once; taps only flip aria-pressed so the focused button survives.
function buildQuestions() {
  for (const [key, qKey, multi, options] of QUESTIONS) {
    const fs = document.createElement("fieldset");
    const lg = document.createElement("legend");
    lg.dataset.s = qKey;
    const chips = document.createElement("div");
    chips.className = "chips";
    const isOn = (val) => multi ? answers[key].includes(val) : answers[key] === val;
    for (const [val, sKey, emoji] of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.val = val;
      b.setAttribute("aria-pressed", String(isOn(val)));
      b.onclick = () => {
        if (multi) answers[key] = RESTRICTIONS.filter(r => (r === val) !== answers[key].includes(r));
        else answers[key] = val;
        for (const c of chips.children) c.setAttribute("aria-pressed", String(isOn(c.dataset.val)));
      };
      chipLabels.push([b, sKey, emoji]);
      chips.append(b);
    }
    fs.append(lg, chips);
    $("questions").append(fs);
  }
}

function renderResult() {
  const t = STRINGS[lang];
  const m = current;
  $("menu").hidden = !m;
  $("no-match").hidden = Boolean(m);
  const delivery = answers.mode === "delivery";
  $("another").hidden = !m;
  $("staff-btn").hidden = !m || delivery || lang === "ko";
  $("nearby").hidden = !m || delivery;
  $("delivery-coupang").hidden = $("delivery-baemin").hidden = !m || !delivery;
  renderHint();
  if (!m) return;
  $("menu-emoji").textContent = m.emoji;
  $("menu-name").textContent = menuName(m);
  $("menu-ko").hidden = lang === "ko";
  $("menu-ko").textContent = `${m.ko} · ${m.rom}`;
  const sp = $("menu-spice");
  sp.textContent = "🌶️".repeat(m.spice);
  if (m.spice) { sp.setAttribute("role", "img"); sp.setAttribute("aria-label", `${t.spiceLabel} ${m.spice}`); }
  else { sp.removeAttribute("role"); sp.removeAttribute("aria-label"); }
  const tags = Object.keys(TAGS).filter(k => m.contains.includes(k)).map(k => t[TAGS[k]]);
  $("menu-tags").replaceChildren(...(tags.length ? tags : [t.tagNone]).map(x => {
    const li = document.createElement("li");
    li.textContent = x;
    return li;
  }));
  $("menu-desc").textContent = m.desc[lang];
}

const menuName = (m) => lang === "ko" ? m.ko : m.name[lang];

function renderHint() {
  const el = $("delivery-hint");
  if (!hint || !current || answers.mode !== "delivery") return el.replaceChildren();
  const t = STRINGS[lang];
  const mark = (tag) => Object.assign(document.createElement(tag), { lang: "ko", textContent: current.ko });
  if (hint === "copied") {
    const [before, after] = t.deliveryHint.split("{name}");
    return el.replaceChildren(before, mark("span"), after);
  }
  el.replaceChildren(t.deliveryCopyFailed, mark("strong"));
}

function renderStaff() {
  const c = staffCard(current, answers.restrictions);
  $("staff-back").lang = lang; // the section is lang="ko"; the toggle is hidden here
  $("staff-dish").textContent = c.dish;
  $("staff-order").textContent = c.order;
  $("staff-notes").replaceChildren(...c.notes.map(n => {
    const li = document.createElement("li");
    li.textContent = n;
    return li;
  }));
}

function renderHistory() {
  const t = STRINGS[lang];
  const byId = Object.fromEntries(MENUS.map(m => [m.id, m]));
  $("history-list").replaceChildren(...history.map((e, i) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = menuName(byId[e.id]);
    const time = document.createElement("time");
    time.textContent = new Date(e.at).toLocaleString({ zh: "zh-CN", ko: "ko-KR" }[lang] || "en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "✕";
    del.setAttribute("aria-label", t.remove);
    del.onclick = () => {
      history = history.filter((_, j) => j !== i);
      saveJSON(store, "eik:history", history);
      renderHistory();
    };
    li.append(name, time, del);
    return li;
  }));
  $("history-empty").hidden = history.length > 0;
}

// Re-renders everything for the current language without re-picking.
function renderAll() {
  const t = STRINGS[lang];
  document.documentElement.lang = lang;
  document.title = t.title;
  for (const el of document.querySelectorAll("[data-s]")) el.textContent = t[el.dataset.s];
  for (const [b, sKey, emoji] of chipLabels) {
    b.textContent = `${emoji} ${t[sKey]}`;
    b.setAttribute("aria-label", t[sKey]);
  }
  for (const b of document.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  renderResult();
  renderHistory();
}

function showPick() {
  const { menu, cycled } = pick(MENUS, answers, history, shown, Date.now());
  current = menu;
  recorded = false;
  hint = null;
  if (menu) shown = cycled ? [menu.id] : [...shown, menu.id];
  renderResult();
  show("result", menu ? "menu-name" : "no-match-title");
  $("menu").classList.remove("pop");
  void $("menu").offsetWidth; // restart the CSS animation on every pick
  $("menu").classList.add("pop");
}

// Only the first use per recommendation is recorded.
function record() {
  if (recorded) return;
  recorded = true;
  history = addEntry(history, current.id, Date.now());
  saveJSON(store, "eik:history", history);
  renderHistory();
}

$("go").onclick = () => {
  saveJSON(store, "eik:lastAnswers", answers);
  shown = [];
  showPick();
};
$("another").onclick = showPick;
$("back").onclick = () => { hint = null; renderHint(); show("ask", "ask-title"); };
$("staff-btn").onclick = () => { record(); renderStaff(); show("staff", "staff-dish"); };
$("nearby").onclick = () => { record(); window.open(mapsUrl(current), "_blank", "noopener"); };
function navigate(url) { window.location.assign(url); } // global so manual checks can override it
for (const [id, app] of [["delivery-coupang", DELIVERY_APPS[0]], ["delivery-baemin", DELIVERY_APPS[1]]]) {
  $(id).onclick = async () => {
    record();
    try { await navigator.clipboard.writeText(current.ko); hint = "copied"; } catch { hint = "failed"; }
    renderHint();
    navigate(deliveryUrl(app, navigator.userAgent));
  };
}
$("staff-back").onclick = () => show("result", "menu-name");
$("to-history").onclick = () => { show("history", "history-title"); };
$("history-back").onclick = () => show("ask", "ask-title");
for (const b of document.querySelectorAll("[data-lang]")) {
  b.onclick = () => { lang = b.dataset.lang; saveJSON(store, "eik:lang", lang); renderAll(); };
}

buildQuestions();
renderAll();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
