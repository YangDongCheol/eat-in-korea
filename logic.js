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
