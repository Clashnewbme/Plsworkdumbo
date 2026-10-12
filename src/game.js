'use strict';
// Original real-time territory conquest game. Simulation runs on a hidden
// grid; rendering is resolution-independent and smoothed (no visible tiles).
const W = 192, H = 120, N = W * H, TICK = 100;
let BOTS = 14;
const COST = { city: 150, port: 100, ship: 220, defense: 120 };
const BTYPE = { city: 1, port: 2, defense: 3 };
const DIFFS = { easy: { name: 'Easy', think: 24, grow: .85 }, normal: { name: 'Normal', think: 15, grow: 1 }, hard: { name: 'Hard', think: 9, grow: 1.2 }, brutal: { name: 'Brutal', think: 6, grow: 1.4 } };
let difficulty = 'normal';
// player-tweakable match settings (menu)
const SETTINGS = { start: 2, winPct: 60, troops: 100, gold: 100, sea: 0 };

const rnd = Math.random;

// ---------- map generation (value noise) ----------
function makeNoise() {
  const g = 12, v = [];
  for (let i = 0; i < (g + 1) * (g + 1); i++) v.push(rnd());
  const f = t => t * t * (3 - 2 * t);
  return (x, y, s) => {
    const fx = x / W * g * s, fy = y / H * g * s;
    const ix = Math.floor(fx) % g, iy = Math.floor(fy) % g, tx = f(fx % 1), ty = f(fy % 1);
    const a = v[iy * (g + 1) + ix], b = v[iy * (g + 1) + ix + 1];
    const c = v[(iy + 1) * (g + 1) + ix], d = v[(iy + 1) * (g + 1) + ix + 1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}
const land = new Uint8Array(N), height = new Float32Array(N);
const MAPS = {
  continents: { name: 'Continents', a: .5, b: 1, fall: .5, sea: .36 },
  islands: { name: 'Islands', a: 1.4, b: 2.4, fall: .35, sea: .45 },
  archipelago: { name: 'Archipelago', a: 2.2, b: 3.6, fall: .3, sea: .45 },
  pangaea: { name: 'Pangaea', a: .4, b: .8, fall: .9, sea: .3 },
  lakes: { name: 'Great Lakes', a: 3, b: 5, fall: .15, sea: .42 },
  highlands: { name: 'Highlands', a: .8, b: 1.6, fall: .6, sea: .4 },
  scattered: { name: 'Scattered Isles', a: 3, b: 6, fall: .45, sea: .47 }
};
// ---------- flags (stripes: s, direction d, optional circle c, optional cross x) ----------
const FLAGS = {
  France: { d: 'v', s: ['#0055a4', '#fff', '#ef4135'] }, Germany: { d: 'h', s: ['#000', '#dd0000', '#ffce00'] },
  Brazil: { d: 'h', s: ['#009c3b'], c: '#ffdf00' }, Japan: { d: 'h', s: ['#fff'], c: '#bc002d' },
  Egypt: { d: 'h', s: ['#ce1126', '#fff', '#000'] }, Canada: { d: 'v', s: ['#d52b1e', '#fff', '#fff', '#d52b1e'] },
  India: { d: 'h', s: ['#ff9933', '#fff', '#138808'], c: '#000080' }, Mexico: { d: 'v', s: ['#006847', '#fff', '#ce1126'] },
  Spain: { d: 'h', s: ['#aa151b', '#f1bf00', '#f1bf00', '#aa151b'] }, Italy: { d: 'v', s: ['#009246', '#fff', '#ce2b37'] },
  Kenya: { d: 'h', s: ['#000', '#bb0000', '#006600'] }, Norway: { d: 'h', s: ['#ba0c2f'], x: '#fff' },
  Peru: { d: 'v', s: ['#d91023', '#fff', '#d91023'] }, Turkey: { d: 'h', s: ['#e30a17'], c: '#fff' },
  Poland: { d: 'h', s: ['#fff', '#dc143c'] }, Australia: { d: 'h', s: ['#00008b'], c: '#fff' },
  Argentina: { d: 'h', s: ['#74acdf', '#fff', '#74acdf'], c: '#f6b40e' }, Sweden: { d: 'h', s: ['#006aa7'], x: '#fecc00' },
  Ireland: { d: 'v', s: ['#169b62', '#fff', '#ff883e'] }, Ukraine: { d: 'h', s: ['#0057b7', '#ffd700'] },
  Netherlands: { d: 'h', s: ['#ae1c28', '#fff', '#21468b'] }, Nigeria: { d: 'v', s: ['#008751', '#fff', '#008751'] },
  Finland: { d: 'h', s: ['#fff'], x: '#003580' }, Greece: { d: 'h', s: ['#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf'] }
};
const COUNTRIES = Object.keys(FLAGS);
const flagMain = f => { const c = f.c && f.s.length === 1 && f.s[0] !== '#fff' ? f.s[0] : f.s[f.s.length > 2 ? 1 : 0]; return c === '#fff' ? (f.c || f.x || f.s[f.s.length - 1]) : c; };
function drawFlag(g, f, x, y, w, h) {
  const n = f.s.length;
  f.s.forEach((c, k) => { g.fillStyle = c; if (f.d === 'v') g.fillRect(x + w * k / n, y, w / n + .02, h); else g.fillRect(x, y + h * k / n, w, h / n + .02); });
  if (f.x) { g.fillStyle = f.x; g.fillRect(x + w * .25, y, w * .16, h); g.fillRect(x, y + h * .4, w, h * .2); }
  if (f.c) { g.fillStyle = f.c; g.beginPath(); g.arc(x + w / 2, y + h / 2, h * (f.s.length > 1 ? .2 : .3), 0, 7); g.fill(); }
}
function flagCss(f) {
  const n = f.s.length, st = f.s.map((c, k) => c + ' ' + (k / n * 100) + '% ' + ((k + 1) / n * 100) + '%').join(',');
  return 'linear-gradient(' + (f.d === 'v' ? 'to right' : 'to bottom') + ',' + st + ')';
}

// ---------- cosmetics catalog & persistent save ----------
const SHAPES = ['rect', 'circle', 'star', 'diamond', 'tri', 'hex'];
const CATALOG = {
  flag: { label: 'Flags', items: [{ id: 'none', name: 'No flag', price: 0 }].concat(COUNTRIES.map((c, k) => ({ id: c, name: c, price: 40 + (k % 5) * 20, flag: FLAGS[c] }))) },
  pattern: { label: 'Territory', items: [
    { id: 'solid', name: 'Solid', price: 0 }, { id: 'striped', name: 'Striped', price: 60 }, { id: 'dotted', name: 'Dotted', price: 60 },
    { id: 'checker', name: 'Checkerboard', price: 90 }, { id: 'glow', name: 'Glowing border', price: 120 }] },
  bset: { label: 'Buildings', items: [
    { id: 'classic', name: 'Classic', price: 0, city: 'rect', port: 'tri', fill: '#fff', line: '#000' },
    { id: 'gold', name: 'Golden', price: 100, city: 'rect', port: 'tri', fill: '#ffd700', line: '#5a4500' },
    { id: 'castle', name: 'Castle', price: 120, city: 'hex', port: 'diamond', fill: '#e8dcc0', line: '#3b2f1a' },
    { id: 'neon', name: 'Neon', price: 150, city: 'star', port: 'circle', fill: '#39ff14', line: '#003300' },
    { id: 'royal', name: 'Royal', price: 200, city: 'star', port: 'diamond', fill: '#ffd700', line: '#4b0082' }] },
  ship: { label: 'Ships', items: [
    { id: 'classic', name: 'Classic', price: 0, hull: '#fff', sail: '#fff', line: '#000' },
    { id: 'pirate', name: 'Pirate', price: 90, hull: '#111', sail: '#fff', line: '#fff' },
    { id: 'crimson', name: 'Crimson', price: 80, hull: '#8b0000', sail: '#ff4d4d', line: '#000' },
    { id: 'ice', name: 'Frost', price: 100, hull: '#9fd8ff', sail: '#e6f7ff', line: '#003366' },
    { id: 'golden', name: 'Golden', price: 140, hull: '#ffd700', sail: '#fff3b0', line: '#5a4500' }] }
};
const itemOf = (cat, id) => CATALOG[cat].items.find(i => i.id === id) || CATALOG[cat].items[0];
let save = { coins: 100, owned: {}, eq: { flag: 'none', pattern: 'solid', bset: 'classic', ship: 'classic' }, color: '#2a8cff' };
try { const o = JSON.parse(localStorage.getItem('pdSave') || 'null'); if (o) save = { coins: +o.coins || 0, owned: o.owned || {}, eq: Object.assign(save.eq, o.eq), color: /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : save.color }; } catch (e) { /* ignore */ }
const persist = () => { try { localStorage.setItem('pdSave', JSON.stringify(save)); } catch (e) { /* ignore */ } };
const owns = (cat, id) => itemOf(cat, id).price === 0 || !!save.owned[cat + ':' + id];
for (const c in save.eq) if (!owns(c, save.eq[c])) save.eq[c] = CATALOG[c].items[0].id;
const eqItem = cat => itemOf(cat, save.eq[cat]);
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
let mapKind = 'continents', sea = .36;
function genMap(kind) {
  const requested = kind || mapKind;
  const kinds = Object.keys(MAPS);
  const chosen = requested === 'random' ? kinds[(rnd() * kinds.length) | 0] : requested;
  const m = MAPS[chosen] || MAPS.continents; sea = m.sea + SETTINGS.sea; landCount = 0;
  const n1 = makeNoise(), n2 = makeNoise(), n3 = makeNoise(), wx = makeNoise(), wy = makeNoise();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // warp the sample point a little so coastlines are ragged instead of blobby
    const px = x + (wx(x, y, 1.5) - .5) * 14, py = y + (wy(x, y, 1.5) - .5) * 14;
    const dx = x / W - .5, dy = y / H - .5;
    const h = n1(px, py, m.a) * .5 + n2(px, py, m.b) * .3 + n3(px, py, m.b * 2.2) * .2 - Math.hypot(dx * 1.1, dy) * m.fall;
    height[y * W + x] = h; land[y * W + x] = h > sea ? 1 : 0;
  }
  tidyCoast();
}
// two cellular passes: fill pin-holes, drop single-tile specks, then drop
// islands too small to be worth fighting over
function tidyCoast() {
  for (let pass = 0; pass < 2; pass++) {
    const next = land.slice();
    for (let i = 0; i < N; i++) {
      const n = nbrs(i); let l = 0; for (const j of n) l += land[j];
      if (land[i] && l <= 1) next[i] = 0; else if (!land[i] && l >= 3) next[i] = 1;
    }
    land.set(next);
  }
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!land[i] || seen[i]) continue;
    const comp = [i]; seen[i] = 1;
    for (let k = 0; k < comp.length; k++) for (const j of nbrs(comp[k])) if (land[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
    if (comp.length < 25) for (const j of comp) land[j] = 0;
  }
}

// ---------- state ----------
const owner = new Uint8Array(N);          // 0 = unclaimed
const building = new Uint8Array(N);       // 0 none, 1 city, 2 port, 3 defense post
let flagOf = [], players = [], attacks = [], ships = [], navalAttacks = [], tick = 0, over = false, mode = null;
let pendingOffers = [], activeOffer = null, humanOfferCooldown = 0;
let playerName = 'You', started = false, paused = true, toastTimer;
const HUMAN = 1;
const nbrs = i => {
  const x = i % W, r = [];
  if (x > 0) r.push(i - 1); if (x < W - 1) r.push(i + 1);
  if (i >= W) r.push(i - W); if (i < N - W) r.push(i + W);
  return r;
};
const isCoast = i => nbrs(i).some(j => !land[j]);

let botOffset = 0;
function newGame() {
  BOTS = Math.max(1, Math.min(BOTS, 40));
  const R = SETTINGS.start;
  botOffset = (rnd() * COUNTRIES.length) | 0;
  owner.fill(0); building.fill(0); attacks = []; ships = []; navalAttacks = []; tick = 0; over = false; players = [null]; mode = null; rel = {};
  pendingOffers = []; activeOffer = null; humanOfferCooldown = 0; $('offer').hidden = true;
  const spots = [];
  // only spawn on solid ground, not on slivers of coast
  for (let i = 0; i < N; i++) if (land[i] && nbrs(i).every(j => land[j])) spots.push(i);
  if (!spots.length) for (let i = 0; i < N; i++) if (land[i]) spots.push(i);
  const gap = Math.max(8, Math.min(18, Math.sqrt(spots.length / (BOTS + 1)) * 1.1));
  const hues = [];
  for (let p = 1; p <= BOTS + 1; p++) {
    let s, tries = 0;
    do { s = spots[(rnd() * spots.length) | 0]; tries++; }
    while (tries < 400 && players.some(q => q && Math.hypot(q.sx - s % W, q.sy - ((s / W) | 0)) < gap));
    const hue = (p * 137) % 360, cn = COUNTRIES[(p - 2 + botOffset) % COUNTRIES.length];
    const pl = { id: p, name: p === 1 ? playerName : cn, bot: p !== 1, sx: s % W, sy: (s / W) | 0,
      troops: SETTINGS.troops, gold: SETTINGS.gold, tiles: 0, alive: true, color: p === 1 ? hexRgb(save.color) : hsl(hue, 65, 52), think: (rnd() * 20) | 0,
      flag: p === 1 ? eqItem('flag').flag || null : FLAGS[cn] };
    players.push(pl);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = pl.sx + dx, y = pl.sy + dy, j = y * W + x;
      if (x >= 0 && y >= 0 && x < W && y < H && land[j] && !owner[j]) { owner[j] = p; pl.tiles++; }
    }
  }
  dirty = true;
}
function hsl(h, s, l) { // -> [r,g,b]
  s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

// ---------- economy ----------
function count(p, b) { let c = 0; for (let i = 0; i < N; i++) if (owner[i] === p.id && building[i] === b) c++; return c; }
function cap(p, cities) { return 200 + p.tiles * 12 + cities * 800; }
function economy() {
  const cities = new Array(players.length).fill(0), ports = cities.slice(), tiles = cities.slice(), posts = cities.slice();
  for (let i = 0; i < N; i++) if (owner[i]) {
    tiles[owner[i]]++; if (building[i] === 1) cities[owner[i]]++; else if (building[i] === 2) ports[owner[i]]++; else if (building[i] === 3) posts[owner[i]]++;
  }
  for (const p of players) {
    if (!p) continue;
    p.tiles = tiles[p.id]; p.cities = cities[p.id]; p.ports = ports[p.id]; p.posts = posts[p.id];
    if (!p.tiles) { if (p.alive) p.alive = false; attacks = attacks.filter(a => a.p !== p.id); continue; }
    const c = cap(p, p.cities);
    if (p.troops < c) p.troops = Math.min(c, p.troops + (1 + Math.min(p.tiles, 600) * .05 * (1 - p.troops / c) + 0.2 * p.cities) * (p.bot ? DIFFS[difficulty].grow : 1));
    else p.troops = Math.max(c, p.troops - (p.troops - c) * .02);
    p.gold += (p.tiles * .02 + p.cities * 1 + p.ports * 1.5 + .5) * (TICK / 1000) * 2;
  }
}

// ---------- diplomacy ----------
let rel = {};
const rkey = (a, b) => a < b ? a + ',' + b : b + ',' + a;
function relation(a, b) { return rel[rkey(a, b)] || 'neutral'; }
function setRelation(a, b, v) { if (v === 'neutral') delete rel[rkey(a, b)]; else rel[rkey(a, b)] = v; }
function friendly(a, b) { const r = relation(a, b); return r === 'peace' || r === 'alliance'; }
function borders(a, b) {
  for (let i = 0; i < N; i++) if (owner[i] === a) for (const j of nbrs(i)) if (land[j] && owner[j] === b) return true;
  return false;
}
function botAnswer(bot, pid, kind) {
  const me = players[pid], str = bot.troops + bot.tiles * 4, mine = me.troops + me.tiles * 4;
  if (kind === 'peace') return str < mine * 1.5 || rnd() < .3;
  if (kind === 'alliance') return relation(bot.id, pid) === 'peace' && rnd() < .6;
  return false;
}
function diplomacy(pid, target, kind) {
 const bot = players[target], me = players[pid];
 if (!bot || !bot.alive || target === pid) return;
 if (kind === 'war') {
   setRelation(pid, target, 'neutral'); rel[rkey(pid, target)] = 'war';
   showToast('You declared war on ' + bot.name + '.'); return;
 }
 if (kind === 'break') { setRelation(pid, target, 'neutral'); showToast('Treaty with ' + bot.name + ' ended.'); return; }
 if (botAnswer(bot, pid, kind)) {
   setRelation(pid, target, kind);
   showToast(bot.name + ' accepted your ' + (kind === 'peace' ? 'peace treaty.' : 'alliance.'));
 } else showToast(bot.name + ' rejected your ' + (kind === 'peace' ? 'peace offer.' : 'alliance request.'));
}
function showNextOffer() {
 if (activeOffer || !pendingOffers.length) return;
 activeOffer = pendingOffers.shift();
 const bot = players[activeOffer.bot];
 if (!bot || !bot.alive || relation(HUMAN, bot.id) !== activeOffer.relation) {
   activeOffer = null; showNextOffer(); return;
 }
 $('offerText').textContent = bot.name + ' has sent a ' + (activeOffer.kind === 'peace' ? 'peace offer.' : 'alliance request.');
 $('offer').hidden = false;
}
function queueBotOffer(bot, kind) {
 const currentRelation = relation(HUMAN, bot.id);
 if (pendingOffers.some(o => o.bot === bot.id) || (activeOffer && activeOffer.bot === bot.id)) return false;
 pendingOffers.push({ bot: bot.id, kind, relation: currentRelation });
 showNextOffer();
 return true;
}
function answerBotOffer(accept) {
 const offer = activeOffer;
 activeOffer = null; $('offer').hidden = true;
 const bot = offer && players[offer.bot];
 if (bot && bot.alive && relation(HUMAN, bot.id) === offer.relation) {
   if (accept) {
     setRelation(HUMAN, bot.id, offer.kind);
     showToast(bot.name + ' is now ' + (offer.kind === 'peace' ? 'at peace with you.' : 'your ally.'));
   } else showToast('You rejected ' + bot.name + '\'s ' + (offer.kind === 'peace' ? 'peace offer.' : 'alliance request.'));
 } else showToast('That diplomatic offer has expired.');
 showNextOffer();
}

// ---------- combat ----------
function startAttack(pid, target, frac) {
  const p = players[pid];
  if (!p.alive || target === pid) return false;
  if (target && friendly(pid, target)) { if (pid === HUMAN) showToast('You have a treaty with ' + players[target].name + '. Break it first.'); return false; }
  const send = Math.floor(p.troops * frac);
  if (send < 5) return false;
  if (target) setRelation(pid, target, 'war');
  p.troops -= send;
  const ex = attacks.find(a => a.p === pid && a.t === target);
  if (ex) ex.troops += send; else attacks.push({ p: pid, t: target, troops: send });
  return true;
}
function stepAttacks() {
  const cand = new Map();
  for (const a of attacks) cand.set(a, []);
  const byOwner = new Map();
  for (const a of attacks) { if (!byOwner.has(a.p)) byOwner.set(a.p, []); byOwner.get(a.p).push(a); }
  for (let i = 0; i < N; i++) {
    const o = owner[i], list = byOwner.get(o);
    if (!list) continue;
    for (const j of nbrs(i)) if (land[j]) for (const a of list) if (owner[j] === a.t && j !== i) cand.get(a).push(j);
  }
  for (const a of attacks.slice()) {
    if (a.t && friendly(a.p, a.t)) { players[a.p].troops += a.troops; a.troops = 0; continue; }
    const att = players[a.p], def = a.t ? players[a.t] : null, list = cand.get(a);
    let n = Math.min(list.length, Math.max(2, Math.ceil(Math.sqrt(att.tiles) * .8)));
    if (!list.length || (def && !def.alive)) { att.troops += a.troops; a.troops = 0; }
    const done = new Set();
    while (n-- > 0 && a.troops > 0 && list.length) {
      const k = (rnd() * list.length) | 0, j = list.splice(k, 1)[0];
      if (done.has(j) || owner[j] !== a.t) continue;
      // big countries pay more per tile, so nobody snowballs forever
      const sprawl = 1 + att.tiles / (count_land() / 6);
      const cost = (def ? 1 + def.troops / Math.max(1, def.tiles) * .7 : 1) * sprawl * (building[j] === 3 ? 3 : 1);
      if (a.troops < cost) { att.troops += a.troops; a.troops = 0; break; }
      a.troops -= cost; done.add(j);
      if (def) { def.troops = Math.max(0, def.troops - cost * .8); def.tiles--; }
      owner[j] = a.p; att.tiles++; dirty = true;
    }
  }
  attacks = attacks.filter(a => a.troops > 0);
}

// ---------- bots ----------
function botThink(b) {
  if (b.gold > COST.defense + 80 && rnd() < .15) tryBuild(b.id, 3, randomTile(b.id));
  else if (b.gold > COST.city + 50 && rnd() < .5) tryBuild(b.id, 1, randomTile(b.id));
  else if (b.gold > COST.port + 50 && rnd() < .3) tryBuild(b.id, 2, randomTile(b.id));
  if (b.troops < 40 || attacks.some(a => a.p === b.id)) return;
  const targets = new Map(); let free = false;
  for (let i = 0; i < N; i++) if (owner[i] === b.id) for (const j of nbrs(i)) if (land[j] && owner[j] !== b.id) {
    if (!owner[j]) free = true; else targets.set(owner[j], 1);
  }
  let best = 0, bestT = 1e9;
  for (const t of targets.keys()) { const d = players[t].troops / Math.max(1, players[t].tiles); if (d < bestT) { bestT = d; best = t; } }
  if (botDiplomacyThink(b, [...targets.keys()])) return;
  for (const t of [...targets.keys()]) if (friendly(b.id, t)) targets.delete(t);
  best = 0; bestT = 1e9; for (const t of targets.keys()) { const d = players[t].troops / Math.max(1, players[t].tiles); if (d < bestT) { bestT = d; best = t; } }
  if (free && (!best || rnd() < .6)) {
    if (rnd() < .75) startAttack(b.id, 0, .3);
  } else if (best && b.troops > players[best].troops * .5) {
    const advantage = b.troops / Math.max(1, players[best].troops);
    const attackChance = Math.max(.1, Math.min(.85, (advantage - .4) * .55));
    if (rnd() < attackChance) startAttack(b.id, best, .5);
  }
}
function botDiplomacyThink(bot, neighbors) {
  if (!neighbors.length) return false;
  const targetId = neighbors[(rnd() * neighbors.length) | 0], target = players[targetId];
  const state = relation(bot.id, targetId), strength = bot.troops + bot.tiles * 4, rivalStrength = target.troops + target.tiles * 4;
  let kind = null;
  if (state === 'war' && strength < rivalStrength * .8 && rnd() < .3) kind = 'peace';
  else if (state === 'neutral' && rnd() < .035) kind = 'peace';
  else if (state === 'peace' && rnd() < .08) kind = 'alliance';
  else if ((state === 'peace' || state === 'alliance') && strength > rivalStrength * 1.4 && rnd() < (state === 'alliance' ? .025 : .06)) {
    setRelation(bot.id, targetId, 'neutral');
    if (targetId === HUMAN) showToast(bot.name + ' broke its treaty with you.');
    return true;
  }
  if (!kind) return false;
  if (targetId === HUMAN) {
    if (tick < humanOfferCooldown) return false;
    humanOfferCooldown = tick + 600;
    return queueBotOffer(bot, kind);
  }
  if (botAnswer(target, bot.id, kind)) setRelation(bot.id, targetId, kind);
  return true;
}
function randomTile(pid) {
  const own = []; for (let i = 0; i < N; i++) if (owner[i] === pid) own.push(i);
  return own.length ? own[(rnd() * own.length) | 0] : -1;
}
function tryBuild(pid, type, i) {
  const p = players[pid], cost = COST[['', 'city', 'port', 'defense'][type]];
  if (i < 0 || owner[i] !== pid || building[i] || p.gold < cost) return false;
  if (type === 2 && !isCoast(i)) return false;
  p.gold -= cost; building[i] = type; dirty = true; return true;
}
function tryBuildShip(pid, i) {
  const p = players[pid];
  if (i < 0 || owner[i] !== pid || building[i] !== 2 || p.gold < COST.ship || ships.filter(s => s.p === pid).length >= 8) return false;
  p.gold -= COST.ship; ships.push({ p: pid, dock: i, busy: false }); dirty = true; return true;
}
function canReach(pid, i) { return nbrs(i).some(j => owner[j] === pid); }
function startNavalAttack(pid, target, frac) {
  const p = players[pid], ship = ships.find(s => s.p === pid && !s.busy);
  if (!ship) { showToast('Build a ship at one of your ports first.'); return false; }
  if (!land[target] || !isCoast(target)) { showToast('Ships can only land on coastal territory.'); return false; }
  if (owner[target] === pid) return false;
  if (owner[target] && friendly(pid, owner[target])) { showToast('You have a treaty with that nation.'); return false; }
  const send = Math.floor(p.troops * frac);
  if (send < 5) { showToast('You need at least 5 troops for an attack.'); return false; }
  if (owner[target]) setRelation(pid, owner[target], 'war');
  p.troops -= send; ship.busy = true;
  const distance = Math.hypot(ship.dock % W - target % W, ((ship.dock / W) | 0) - ((target / W) | 0));
  navalAttacks.push({ p: pid, target, troops: send, ship, progress: 0, duration: Math.max(12, Math.ceil(distance / 2)) });
  showToast('Fleet dispatched to the coast.');
  return true;
}
function stepNavalAttacks() {
  const active = [];
  for (const a of navalAttacks) {
    const attacker = players[a.p];
    if (!attacker || !attacker.alive) { a.ship.busy = false; continue; }
    if (owner[a.target] === a.p) {
      attacker.troops += a.troops; a.ship.busy = false; continue;
    }
    if (++a.progress < a.duration) { active.push(a); continue; }
    const def = owner[a.target] ? players[owner[a.target]] : null;
    const cost = def ? 1 + def.troops / Math.max(1, def.tiles) * .7 : 1;
    if (a.troops >= cost) {
      if (def) { def.troops = Math.max(0, def.troops - cost * .8); def.tiles--; }
      owner[a.target] = a.p; attacker.tiles++;
      attacker.troops += a.troops - cost; dirty = true;
      a.ship.busy = false;
      if (a.p === HUMAN) showToast('Naval landing secured!');
    } else {
      a.ship.busy = false; ships = ships.filter(s => s !== a.ship);
      if (a.p === HUMAN) showToast('The landing failed and your ship was lost.');
    }
  }
  navalAttacks = active;
}

// ---------- loop ----------
function step() {
  if (!started || paused || over) return;
  tick++; stepAttacks(); stepNavalAttacks();
  for (const b of players) if (b && b.bot && b.alive && ++b.think % DIFFS[difficulty].think === 0) botThink(b);
  economy(); checkEnd(); updateHud();
}
function checkEnd() {
  const alive = players.filter(p => p && p.alive);
  const me = players[HUMAN];
  if (!me.alive) end('Defeated');
  else if (alive.length === 1 || me.tiles > count_land() * SETTINGS.winPct / 100) end('Victory!');
}
let landCount = 0; const count_land = () => landCount || (landCount = land.reduce((a, b) => a + b, 0));
function end(t) {
  over = true;
  pendingOffers = []; activeOffer = null; $('offer').hidden = true;
  const me = players[HUMAN], earned = Math.floor(me.tiles / 8) + (t === 'Victory!' ? 100 : 0) + 10;
  save.coins += earned; persist(); updateCoins();
  t += '<br><small>+' + earned + ' coins</small>'; const m = document.getElementById('msg'); m.hidden = false; m.innerHTML = t + '<br><button onclick="location.reload()">Play again</button>'; }

// ---------- rendering ----------
let dirty = true, cam = { x: 0, y: 0, z: 1 };
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const terrain = document.createElement('canvas'), tctx = terrain.getContext('2d');
const terr = document.createElement('canvas'), octx = terr.getContext('2d');
const ter = document.createElement('canvas'), ictx = ter.getContext('2d');
const SS = 4; // terrain supersample
function drawTerrain() {
  terrain.width = W * SS; terrain.height = H * SS;
  // sample bilinear height for smooth coastlines
  const img = tctx.createImageData(W * SS, H * SS), d = img.data;
  const hv = (x, y) => height[Math.max(0, Math.min(H - 1, y | 0)) * W + Math.max(0, Math.min(W - 1, x | 0))];
  for (let py = 0; py < H * SS; py++) for (let px = 0; px < W * SS; px++) {
    const fx = (px + .5) / SS - .5, fy = (py + .5) / SS - .5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const h = (hv(x0, y0) * (1 - tx) + hv(x0 + 1, y0) * tx) * (1 - ty) + (hv(x0, y0 + 1) * (1 - tx) + hv(x0 + 1, y0 + 1) * tx) * ty;
    let r, g, b;
    if (h > sea) { const t = Math.min(1, (h - sea) * 3); r = g = b = 235 - t * 60; if (h < sea + .015) r = g = b = 250; }
    else { const t = Math.max(0, (h - .15) / .21); r = g = b = 10 + t * 30; }
    const o = (py * W * SS + px) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
}
let terrImg, terrData;
function drawOwners() {
  terr.width = W; terr.height = H;
  const img = octx.createImageData(W, H), d = img.data, pat = save.eq.pattern;
  for (let i = 0; i < N; i++) {
    const o = owner[i]; if (!o) continue;
    const c = players[o].color; let edge = false;
    for (const j of nbrs(i)) if (owner[j] !== o) { edge = true; break; }
    let k = edge ? .6 : 1, a = edge ? 255 : 170;
    if (o === HUMAN) {
      const x = i % W, y = (i / W) | 0;
      if (pat === 'striped' && !edge && (x + y) % 4 < 2) k = 1.25;
      else if (pat === 'dotted' && !edge && x % 3 === 0 && y % 3 === 0) k = 1.4;
      else if (pat === 'checker' && !edge && ((x >> 1) + (y >> 1)) % 2) k = 1.25;
      else if (pat === 'glow' && edge) { k = 1.6; a = 255; }
    }
    d[i * 4] = Math.min(255, c[0] * k); d[i * 4 + 1] = Math.min(255, c[1] * k); d[i * 4 + 2] = Math.min(255, c[2] * k);
    d[i * 4 + 3] = a;
  }
  octx.putImageData(img, 0, 0); dirty = false;
}
function shapePath(g, kind, x, y) {
  g.beginPath();
  if (kind === 'rect') g.rect(x - 1, y - 1, 2, 2);
  else if (kind === 'circle') g.arc(x, y, 1.1, 0, 7);
  else if (kind === 'tri') { g.moveTo(x, y - 1.2); g.lineTo(x + 1.1, y + 1); g.lineTo(x - 1.1, y + 1); g.closePath(); }
  else if (kind === 'diamond') { g.moveTo(x, y - 1.3); g.lineTo(x + 1.1, y); g.lineTo(x, y + 1.3); g.lineTo(x - 1.1, y); g.closePath(); }
  else if (kind === 'hex') for (let k = 0; k < 6; k++) g[k ? 'lineTo' : 'moveTo'](x + Math.cos(k * Math.PI / 3) * 1.3, y + Math.sin(k * Math.PI / 3) * 1.3);
  else if (kind === 'star') for (let k = 0; k < 10; k++) { const r = k % 2 ? .6 : 1.4, t = -Math.PI / 2 + k * Math.PI / 5; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(t) * r, y + Math.sin(t) * r); }
  g.closePath();
}
function resize() { cv.width = innerWidth; cv.height = innerHeight; }
function fit() { cam.z = Math.min(cv.width / W, cv.height / H); cam.x = (cv.width - W * cam.z) / 2; cam.y = (cv.height - H * cam.z) / 2; }
function render() {
  if (dirty) drawOwners();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(cam.z, cam.z);
  ctx.drawImage(terrain, 0, 0, W, H);
  // smooth territory: blur the low-res ownership layer (falls back to bilinear scaling)
  if ('filter' in ctx) ctx.filter = 'blur(' + (0.6 * 1) + 'px)';
  ctx.drawImage(terr, 0, 0, W, H);
  ctx.filter = 'none';
  for (let i = 0; i < N; i++) if (building[i]) {
    const x = i % W + .5, y = ((i / W) | 0) + .5;
    const bs = owner[i] === HUMAN ? eqItem('bset') : CATALOG.bset.items[0];
    ctx.fillStyle = bs.fill; ctx.strokeStyle = bs.line; ctx.lineWidth = .2;
    shapePath(ctx, building[i] === 1 ? bs.city : building[i] === 2 ? bs.port : 'hex', x, y);
    if (building[i] === 3) { ctx.fillStyle = '#888'; ctx.fill(); ctx.stroke(); ctx.fillStyle = bs.fill; ctx.beginPath(); ctx.arc(x, y, .5, 0, 7); }
    ctx.fill(); ctx.stroke();
  }
  if (mode && hover && !paused && !over && hover.x >= 0 && hover.y >= 0 && hover.x < W && hover.y < H) {
    const hi = hover.y * W + hover.x, ok = buildCheck(mode, hi), x = hover.x + .5, y = hover.y + .5;
    ctx.globalAlpha = .75; ctx.fillStyle = ok ? '#2ecc40' : '#ff3b30'; ctx.strokeStyle = '#fff'; ctx.lineWidth = .2;
    const bs = eqItem('bset');
    if (mode === 'ship') { ctx.beginPath(); ctx.arc(x, y, 1.2, 0, 7); } else shapePath(ctx, mode === 'city' ? bs.city : mode === 'port' ? bs.port : 'hex', x, y);
    ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (const ship of ships) {
    const attack = navalAttacks.find(a => a.ship === ship);
    const sea = nbrs(ship.dock).find(j => !land[j]);
    const dockX = sea === undefined ? ship.dock % W + .5 : sea % W + .5;
    const dockY = sea === undefined ? ((ship.dock / W) | 0) + .5 : ((sea / W) | 0) + .5;
    const x = attack ? dockX + (attack.target % W + .5 - dockX) * attack.progress / attack.duration : dockX;
    const y = attack ? dockY + (((attack.target / W) | 0) + .5 - dockY) * attack.progress / attack.duration : dockY;
    ctx.save(); ctx.translate(x, y); ctx.scale(1.2, 1.2);
    const sk = ship.p === HUMAN ? eqItem('ship') : CATALOG.ship.items[0];
    ctx.fillStyle = sk.hull; ctx.strokeStyle = sk.line; ctx.lineWidth = .2;
    ctx.beginPath(); ctx.moveTo(-.9, .1); ctx.lineTo(.9, .1); ctx.lineTo(.55, .55); ctx.lineTo(-.55, .55); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sk.sail;
    ctx.beginPath(); ctx.moveTo(-.05, -.9); ctx.lineTo(-.05, .05); ctx.lineTo(.62, .05); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  for (const p of players) if (p && p.alive && p.tiles > 20) { // labels at centroid
    if (p.cx === undefined || tick % 20 === 0) { let sx = 0, sy = 0, c = 0; for (let i = 0; i < N; i++) if (owner[i] === p.id) { sx += i % W; sy += (i / W) | 0; c++; } p.cx = sx / c; p.cy = sy / c; }
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = .4; ctx.font = 'bold ' + Math.min(6, 2 + Math.sqrt(p.tiles) / 6) + 'px sans-serif'; ctx.textAlign = 'center';
    const label = p.name + ' ' + Math.floor(p.troops), fs = Math.min(6, 2 + Math.sqrt(p.tiles) / 6);
    ctx.strokeText(label, p.cx, p.cy); ctx.fillText(label, p.cx, p.cy);
    if (p.flag) {
      const fw = fs * 1.5, fh = fs, fx = p.cx - fw / 2, fy = p.cy - fs * 1.9;
      drawFlag(ctx, p.flag, fx, fy, fw, fh); ctx.strokeStyle = '#000'; ctx.lineWidth = .15; ctx.strokeRect(fx, fy, fw, fh);
    }
  }
  ctx.restore();
  requestAnimationFrame(render);
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
function updateHud() {
  const me = players[HUMAN];
  const fleet = ships.filter(s => s.p === HUMAN).length, sailing = navalAttacks.filter(a => a.p === HUMAN).length;
  $('stats').textContent = 'Troops ' + Math.floor(me.troops) + '/' + cap(me, me.cities || 0) + ' · Gold ' + Math.floor(me.gold) + ' · Land ' + me.tiles + ' · Cities ' + (me.cities || 0) + ' · Ports ' + (me.ports || 0) + ' · Posts ' + (me.posts || 0) + ' · Ships ' + fleet + (sailing ? ' (' + sailing + ' sailing)' : '');
  $('bCity').disabled = me.gold < COST.city; $('bPort').disabled = me.gold < COST.port;
  $('bDef').disabled = me.gold < COST.defense; $('bShip').disabled = me.gold < COST.ship || fleet >= 8;
  $('board').innerHTML = '<b>Leaderboard</b><br>' + players.filter(p => p && p.alive).sort((a, b) => b.tiles - a.tiles).slice(0, 8)
    .map(p => '<span style="color:rgb(' + p.color + ')">■</span> ' + (p.flag ? '<i class="fl" style="background:' + flagCss(p.flag) + '"></i>' : '') + p.name + ' ' + p.tiles).join('<br>');
}
function showToast(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
function toTile(e) { return { x: Math.floor((e.offsetX - cam.x) / cam.z), y: Math.floor((e.offsetY - cam.y) / cam.z) }; }
let drag = null, hover = null;
cv.onmouseleave = () => { hover = null; };
function buildCheck(type, i) {
  if (i < 0 || owner[i] !== HUMAN || !land[i]) return false;
  if (type === 'ship') return building[i] === 2 && players[HUMAN].gold >= COST.ship && ships.filter(s => s.p === HUMAN).length < 8;
  if (building[i]) return false;
  if (type === 'port' && !isCoast(i)) return false;
  return players[HUMAN].gold >= COST[type];
}
const MSGS = { city: 'City built: troop growth increased.', port: 'Port built: gold income increased.', defense: 'Defense post built: attackers pay triple to take it.' };
const ctxMenu = document.createElement('div'); ctxMenu.id = 'ctxMenu'; ctxMenu.hidden = true; document.body.appendChild(ctxMenu);
function hideCtx() { ctxMenu.hidden = true; }
cv.oncontextmenu = e => {
  e.preventDefault(); drag = null;
  const t = toTile(e); if (over || t.x < 0 || t.y < 0 || t.x >= W || t.y >= H) return hideCtx();
  const o = owner[t.y * W + t.x];
  if (!o || o === HUMAN || !land[t.y * W + t.x]) return hideCtx();
  const p = players[o], r = relation(HUMAN, o);
  const label = { neutral: 'Neutral', war: 'At war', peace: 'At peace', alliance: 'Allied' }[r];
  ctxMenu.innerHTML = '<b>' + p.name + '</b><small>' + label + ' · Troops ' + Math.floor(p.troops) + ' · Land ' + p.tiles + '</small>';
  const add = (text, kind) => { const b = document.createElement('button'); b.textContent = text; b.onclick = () => { hideCtx(); diplomacy(HUMAN, o, kind); }; ctxMenu.appendChild(b); };
  if (r !== 'war') add('Declare war', 'war');
  if (r === 'neutral' || r === 'war') add('Propose peace', 'peace');
  if (r === 'peace') add('Request alliance', 'alliance');
  if (r === 'peace' || r === 'alliance') add('Break treaty', 'break');
  ctxMenu.hidden = false;
  ctxMenu.style.left = Math.min(e.clientX, innerWidth - 190) + 'px'; ctxMenu.style.top = Math.min(e.clientY, innerHeight - 200) + 'px';
};
cv.onmousedown = e => { hideCtx(); if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; };
cv.onmousemove = e => { hover = toTile(e); if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { cam.x = drag.cx + dx; cam.y = drag.cy + dy; } };
cv.onmouseup = e => {
  const d = drag; drag = null; if (!d || d.moved || over) return;
  const t = toTile(e); if (t.x < 0 || t.y < 0 || t.x >= W || t.y >= H) return;
  const i = t.y * W + t.x;
  if (mode) {
    if (mode === 'ship') {
      if (tryBuildShip(HUMAN, i)) { showToast('Ship commissioned. Select a coastal enemy to launch it.'); setMode(null); }
      else if (owner[i] !== HUMAN || building[i] !== 2) showToast('Ships must be built on one of your ports.');
      else if (ships.filter(s => s.p === HUMAN).length >= 8) showToast('Your fleet is full (8 ships maximum).');
      else showToast('Not enough gold to build a ship.');
      return;
    }
    const type = BTYPE[mode];
    if (tryBuild(HUMAN, type, i)) { showToast(MSGS[mode]); setMode(null); }
    else if (owner[i] !== HUMAN) showToast('Buildings can only be placed on your own territory.');
    else if (building[i]) showToast('That territory already has a building.');
    else if (type === 2 && !isCoast(i)) showToast('Ports must be placed on the coast.');
    else showToast('Not enough gold to build here.');
    return;
  }
  if (!land[i]) return;
  if (owner[i] === HUMAN) return;
  const frac = $('pct').value / 100;
  if (canReach(HUMAN, i) || borders(HUMAN, owner[i])) startAttack(HUMAN, owner[i], frac);
  else if (isCoast(i) && ships.some(s => s.p === HUMAN && !s.busy)) startNavalAttack(HUMAN, i, frac);
  else if (!owner[i] && !players[HUMAN].tiles) return;
  else if (isCoast(i)) startNavalAttack(HUMAN, i, frac);
  else showToast('No border or port route to that land yet.');
};
cv.onwheel = e => { e.preventDefault(); const k = e.deltaY < 0 ? 1.15 : 1 / 1.15, nz = Math.max(2, Math.min(40, cam.z * k));
  cam.x = e.offsetX - (e.offsetX - cam.x) * nz / cam.z; cam.y = e.offsetY - (e.offsetY - cam.y) * nz / cam.z; cam.z = nz; };
function setMode(m) {
  mode = mode === m ? null : m;
  $('bCity').classList.toggle('on', mode === 'city'); $('bPort').classList.toggle('on', mode === 'port'); $('bDef').classList.toggle('on', mode === 'defense'); $('bShip').classList.toggle('on', mode === 'ship');
  $('help').textContent = mode === 'city' ? 'City mode: click your empty land to build.' : mode === 'port' ? 'Port mode: click empty coastal land to build.' : mode === 'defense' ? 'Defense mode: click your empty land to build a post.' : mode === 'ship' ? 'Ship mode: click one of your ports to commission a ship.' : 'Click land to attack · Build on your territory · Build ships at ports';
}
$('bCity').onclick = () => setMode('city'); $('bPort').onclick = () => setMode('port'); $('bShip').onclick = () => setMode('ship'); $('bDef').onclick = () => setMode('defense');
$('bCancel').onclick = () => {
  const me = players[HUMAN];
  attacks = attacks.filter(a => { if (a.p === HUMAN) { me.troops += a.troops * .8; return false; } return true; });
  navalAttacks = navalAttacks.filter(a => {
    if (a.p !== HUMAN) return true;
    me.troops += a.troops * .8; a.ship.busy = false; return false;
  });
  showToast('Orders cancelled. Most committed troops returned.');
};
$('offerAccept').onclick = () => answerBotOffer(true);
$('offerReject').onclick = () => answerBotOffer(false);
$('pct').oninput = () => $('pctv').textContent = $('pct').value + '%';
$('cCity').textContent = COST.city; $('cPort').textContent = COST.port; $('cShip').textContent = COST.ship; $('cDef').textContent = COST.defense;
$('nameInput').value = playerName = (function () { try { return localStorage.getItem('pdName') || 'You'; } catch (e) { return 'You'; } })();
$('nameInput').oninput = () => {
  playerName = $('nameInput').value.trim().slice(0, 16) || 'You';
  try { localStorage.setItem('pdName', playerName); } catch (e) { /* ignore */ }
  if (players[HUMAN]) players[HUMAN].name = playerName;
};
$('mapSelect').innerHTML = '<option value="random">Random</option>' + Object.keys(MAPS).map(k => '<option value="' + k + '">' + MAPS[k].name + '</option>').join('');
$('mapSelect').onchange = () => { mapKind = $('mapSelect').value; if (!started) { genMap(); newGame(); drawTerrain(); updateHud(); } };
$('diffSelect').innerHTML = Object.keys(DIFFS).map(k => '<option value="' + k + '">' + DIFFS[k].name + '</option>').join('');
$('diffSelect').value = difficulty;
$('diffSelect').onchange = () => { difficulty = $('diffSelect').value; };
$('botSelect').value = BOTS;
const setting = (id, key, redo) => { $(id).value = SETTINGS[key]; $(id).onchange = () => { SETTINGS[key] = +$(id).value; if (!started) { if (redo) genMap(); newGame(); drawTerrain(); updateHud(); } }; };
setting('startSelect', 'start'); setting('winSelect', 'winPct'); setting('troopSelect', 'troops'); setting('goldSelect', 'gold'); setting('seaSelect', 'sea', true);
$('botSelect').onchange = () => { BOTS = +$('botSelect').value; if (!started) { newGame(); updateHud(); } };
$('colorInput').value = save.color;
function applyLook() {
  save.color = $('colorInput').value; persist();
  if (players[HUMAN]) { players[HUMAN].color = hexRgb(save.color); players[HUMAN].flag = eqItem('flag').flag || null; dirty = true; }
}
$('colorInput').oninput = applyLook;
function updateCoins() { $('coins').textContent = save.coins; $('shopCoins').textContent = save.coins; }
let shopTab = 'flag';
function renderShop() {
  $('shopTabs').innerHTML = ''; $('shopGrid').innerHTML = ''; updateCoins();
  for (const cat in CATALOG) {
    const b = document.createElement('button'); b.textContent = CATALOG[cat].label; b.className = cat === shopTab ? 'on' : '';
    b.onclick = () => { shopTab = cat; renderShop(); }; $('shopTabs').appendChild(b);
  }
  for (const it of CATALOG[shopTab].items) {
    const card = document.createElement('div'); card.className = 'item';
    const sw = document.createElement('div'); sw.className = 'swatch';
    if (it.flag) sw.style.background = flagCss(it.flag);
    else if (it.fill) { sw.style.background = it.fill; sw.style.borderColor = it.line; }
    else if (it.hull) { sw.style.background = it.hull; sw.style.borderColor = it.sail; }
    else sw.textContent = it.id === 'none' ? '—' : it.name[0];
    const nm = document.createElement('span'); nm.textContent = it.name;
    const btn = document.createElement('button'), own = owns(shopTab, it.id), eq = save.eq[shopTab] === it.id;
    btn.textContent = eq ? 'Equipped' : own ? 'Equip' : 'Buy ' + it.price; btn.disabled = eq || (!own && save.coins < it.price);
    btn.onclick = () => {
      if (!own) { save.coins -= it.price; save.owned[shopTab + ':' + it.id] = 1; }
      save.eq[shopTab] = it.id;
      if (shopTab === 'flag' && it.flag) { save.color = '#' + hexRgb(rgbHex(flagMain(it.flag))).map(v => v.toString(16).padStart(2, '0')).join(''); $('colorInput').value = save.color; }
      persist(); applyLook(); if (shopTab === 'pattern') dirty = true; renderShop();
    };
    card.append(sw, nm, btn); $('shopGrid').appendChild(card);
  }
}
function rgbHex(c) { return c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c; }
$('shopOpen').onclick = () => { $('shop').hidden = false; renderShop(); };
$('shopClose').onclick = () => { $('shop').hidden = true; };
function showMenu() {
  $('mapSelect').value = mapKind; $('diffSelect').value = difficulty; $('botSelect').value = BOTS; for (const [id, k] of [['startSelect', 'start'], ['winSelect', 'winPct'], ['troopSelect', 'troops'], ['goldSelect', 'gold'], ['seaSelect', 'sea']]) $(id).value = SETTINGS[k]; updateCoins();
  paused = true; $('menu').hidden = false; $('menuStart').hidden = started; $('menuResume').hidden = !started;
}
function beginGame(reset) {
  if (reset) { genMap(); newGame(); drawTerrain(); fit(); }
  started = true; paused = false; $('menu').hidden = true; $('msg').hidden = true; updateHud(); setMode(null);
}
$('menuStart').onclick = () => beginGame(true);
$('menuResume').onclick = () => { paused = false; $('menu').hidden = true; };
$('menuNew').onclick = () => beginGame(true);
$('bMenu').onclick = showMenu;
addEventListener('keydown', e => { if (e.key === 'Escape' && started && !over) showMenu(); });
addEventListener('resize', () => { resize(); fit(); });

genMap(); newGame(); drawTerrain(); resize(); fit(); updateHud(); updateCoins();
setInterval(step, TICK); requestAnimationFrame(render);
