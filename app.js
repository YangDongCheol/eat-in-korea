// UI: ask -> result -> staff card, plus history. Logic lives in logic.js, text in strings.js.
const QUESTIONS = [
  ["restrictions", "qRestrict", true, [["pork", "optPork", "🐷"], ["vegetarian", "optVeg", "🥬"], ["seafood", "optSeafood", "🐟"], ["nuts", "optNuts", "🥜"]]],
  ["spice", "qSpice", false, [["none", "spiceNone", "🙂"], ["mild", "spiceMild", "🌶️"], ["hot", "spiceHot", "🔥"]]],
  ["feel", "qFeel", false, [["hearty", "feelHearty", "🍖"], ["light", "feelLight", "🥗"], ["any", "feelAny", "🎲"]]],
];
const TAGS = { pork: "tagPork", meat: "tagMeat", seafood: "tagSeafood", nuts: "tagNuts" };
const $ = (id) => document.getElementById(id);

let store = null;
try { store = window.localStorage; } catch {} // access itself can throw in private mode

const savedLang = loadJSON(store, "lang", null);
let lang = savedLang === "en" || savedLang === "zh" ? savedLang : detectLang(navigator.language);
const answers = sanitizeAnswers(loadJSON(store, "lastAnswers", null));
let history = sanitizeHistory(loadJSON(store, "history", []), MENUS.map(m => m.id));
let shown = [];
let current = null;
let recorded = false;
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
  $("staff-btn").hidden = $("nearby").hidden = $("another").hidden = !m;
  if (!m) return;
  $("menu-emoji").textContent = m.emoji;
  $("menu-name").textContent = m.name[lang];
  $("menu-ko").textContent = `${m.ko} · ${m.rom}`;
  const sp = $("menu-spice");
  sp.textContent = "🌶️".repeat(m.spice);
  sp.setAttribute("role", "img");
  sp.setAttribute("aria-label", `${t.qSpice} ${m.spice}`);
  const tags = Object.keys(TAGS).filter(k => m.contains.includes(k)).map(k => t[TAGS[k]]);
  $("menu-tags").replaceChildren(...(tags.length ? tags : [t.tagNone]).map(x => {
    const li = document.createElement("li");
    li.textContent = x;
    return li;
  }));
  $("menu-desc").textContent = m.desc[lang];
}

function renderStaff() {
  const c = staffCard(current, answers.restrictions);
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
    name.textContent = byId[e.id].name[lang];
    const time = document.createElement("time");
    time.textContent = new Date(e.at).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "✕";
    del.setAttribute("aria-label", t.remove);
    del.onclick = () => {
      history = history.filter((_, j) => j !== i);
      saveJSON(store, "history", history);
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
  saveJSON(store, "history", history);
  renderHistory();
}

$("go").onclick = () => {
  saveJSON(store, "lastAnswers", answers);
  shown = [];
  showPick();
};
$("another").onclick = showPick;
$("back").onclick = () => show("ask", "ask-title");
$("staff-btn").onclick = () => { record(); renderStaff(); show("staff", "staff-dish"); };
$("nearby").onclick = () => { record(); window.open(mapsUrl(current), "_blank", "noopener"); };
$("staff-back").onclick = () => show("result", "menu-name");
$("to-history").onclick = () => { show("history", "history-title"); };
$("history-back").onclick = () => show("ask", "ask-title");
for (const b of document.querySelectorAll("[data-lang]")) {
  b.onclick = () => { lang = b.dataset.lang; saveJSON(store, "lang", lang); renderAll(); };
}

buildQuestions();
renderAll();
