'use strict';
const W = 192, H = 120, N = W * H, TICK = 100;
let BOTS = 14;
const BASE_COST = { city: 160, port: 110, defense: 120, ship: 200 };
const COST_SCALE = { city: 30, port: 20, defense: 15, ship: 25 };
const COST = BASE_COST;
function costOf(type, p) {
  const k = typeof type === 'number' ? ['', 'city', 'port', 'defense'][type] : type;
  if (!k || !BASE_COST[k]) return 0;
  if (!p) return BASE_COST[k];
  let owned = 0;
  if (k === 'city') owned = p.cities || 0;
  else if (k === 'port') owned = p.ports || 0;
  else if (k === 'defense') owned = p.posts || 0;
  else if (k === 'ship') owned = ships.filter(s => s.p === p.id).length;
  return BASE_COST[k] + owned * (COST_SCALE[k] || 0);
}
const BTYPE = { city: 1, port: 2, defense: 3 };
const DIFFS = { easy: { name: 'Easy', think: 24, grow: .85 }, normal: { name: 'Normal', think: 15, grow: 1 }, hard: { name: 'Hard', think: 9, grow: 1.2 }, brutal: { name: 'Brutal', think: 6, grow: 1.4 } };
let difficulty = 'normal';
const SETTINGS = { start: 2, winPct: 60, troops: 100, gold: 100, sea: 0 };

const rnd = Math.random;

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
  Finland: { d: 'h', s: ['#fff'], x: '#003580' }, Greece: { d: 'h', s: ['#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf'] },
  'United Kingdom': { d: 'h', s: ['#012169', '#fff', '#c8102e'], x: '#fff' }, 'United States': { d: 'h', s: ['#b22234', '#fff', '#b22234', '#fff', '#b22234'], c: '#3c3b6e' }
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
    { id: 'golden', name: 'Golden', price: 140, hull: '#ffd700', sail: '#fff3b0', line: '#5a4500' },
    { id: 'ironclad', name: 'Ironclad', price: 160, hull: '#3a3a3a', sail: '#888', line: '#111' }] }
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
    const px = x + (wx(x, y, 1.5) - .5) * 14, py = y + (wy(x, y, 1.5) - .5) * 14;
    const dx = x / W - .5, dy = y / H - .5;
    const h = n1(px, py, m.a) * .5 + n2(px, py, m.b) * .3 + n3(px, py, m.b * 2.2) * .2 - Math.hypot(dx * 1.1, dy) * m.fall;
    height[y * W + x] = h; land[y * W + x] = h > sea ? 1 : 0;
  }
  tidyCoast();
}
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
  computeWaterComponents();
}

const waterComp = new Int32Array(N);
let waterCompCount = 0;
function computeWaterComponents() {
  waterComp.fill(0);
  waterCompCount = 0;
  for (let i = 0; i < N; i++) {
    if (land[i] || waterComp[i]) continue;
    waterCompCount++;
    const q = [i];
    waterComp[i] = waterCompCount;
    for (let head = 0; head < q.length; head++) {
      const curr = q[head], cx = curr % W, cy = (curr / W) | 0;
      const dxs = [1, -1, 0, 0, 1, -1, 1, -1];
      const dys = [0, 0, 1, -1, 1, 1, -1, -1];
      for (let d = 0; d < 8; d++) {
        const nx = cx + dxs[d], ny = cy + dys[d];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const ni = ny * W + nx;
        if (land[ni] || waterComp[ni]) continue;
        if (d >= 4 && (land[cy * W + nx] || land[ny * W + cx])) continue;
        waterComp[ni] = waterCompCount;
        q.push(ni);
      }
    }
  }
}

let soundEnabled = true;
const sfx = {
  button: new Audio('Assets/Sounds/Button.mp3'),
  click: new Audio('Assets/Sounds/Click.mp3'),
  trade: new Audio('Assets/Sounds/TradeSuccess.mp3')
};
Object.values(sfx).forEach(sound => { sound.preload = 'auto'; });
function playSfx(type) {
  if (!soundEnabled) return;
  try {
    const sound = sfx[type === 'trade' || type === 'treaty' ? 'trade' : type === 'button' ? 'button' : 'click'].cloneNode();
    const playback = sound.play();
    if (playback) playback.catch(() => {});
  } catch (e) { /* epikk */ }
}
document.addEventListener('click', e => {
  if (e.target.closest('button')) playSfx('button');
});

const owner = new Uint8Array(N);          
const building = new Uint8Array(N);      
let flagOf = [], players = [], attacks = [], ships = [], navalAttacks = [], tick = 0, over = false, mode = null;
let pendingOffers = [], activeOffer = null, humanOfferCooldown = 0;
let tradeAgreements = [], sinkingEffects = [], cannonEffects = [];
let playerName = 'You', started = false, paused = true, toastTimer;
const HUMAN = 1;
const nbrs = i => {
  const x = i % W, r = [];
  if (x > 0) r.push(i - 1); if (x < W - 1) r.push(i + 1);
  if (i >= W) r.push(i - W); if (i < N - W) r.push(i + W);
  return r;
};
const isCoast = i => nbrs(i).some(j => !land[j]);
let coastTiles = [];
function updateCoastTiles() {
  coastTiles = [];
  for (let i = 0; i < N; i++) if (land[i] && isCoast(i)) coastTiles.push(i);
}

let diploEvents = [];
function addDiploEvent(type, message, bot) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  diploEvents.unshift({ type, message, bot, time });
  if (diploEvents.length > 25) diploEvents.pop();
  renderDiploFeed();
}
function renderDiploFeed() {
  const feed = $('diploFeed');
  if (!feed) return;
  if (!diploEvents.length) {
    feed.innerHTML = '<div class="diplo-placeholder" id="diploEmpty">No diplomatic events yet. Right-click a nation on the map to interact.</div>';
    return;
  }
  feed.innerHTML = diploEvents.slice(0, 10).map(ev => {
    let icon = '', badgeClass = 'tag-neutral'; // will add later
    if (ev.type === 'alliance-request') { icon = 'Assets/Badges/alliance-request.png'; badgeClass = 'tag-request'; }
    else if (ev.type === 'alliance-accept') { icon = 'Assets/Badges/alliance-accept.png'; badgeClass = 'tag-success'; }
    else if (ev.type === 'alliance-reject') { icon = 'Assets/Badges/alliance-reject.png'; badgeClass = 'tag-danger'; }
    else if (ev.type === 'peace-offer') { icon = 'Assets/Badges/peace-offer.png'; badgeClass = 'tag-request'; }
    else if (ev.type === 'peace-accept') { icon = 'Assets/Badges/peace-accept.png'; badgeClass = 'tag-success'; }
    else if (ev.type === 'peace-reject') { icon = 'Assets/Badges/peace-reject.png'; badgeClass = 'tag-danger'; }
    else if (ev.type === 'trade-request') { icon = 'Assets/Badges/trade-request.png'; badgeClass = 'tag-request'; }
    else if (ev.type === 'trade-accept') { icon = 'Assets/Badges/trade-accept.png'; badgeClass = 'tag-success'; }
    else if (ev.type === 'trade-reject') { icon = 'Assets/Badges/trade-reject.png'; badgeClass = 'tag-danger'; }
    else if (ev.type === 'war') { icon = 'Assets/Badges/war.png'; badgeClass = 'tag-danger'; }
    else if (ev.type === 'break') { icon = 'Assets/Badges/break.png'; badgeClass = 'tag-warning'; }
    else if (ev.type === 'reject') { icon = 'Assets/Badges/reject.png'; badgeClass = 'tag-danger'; }

    const flagHtml = ev.bot && ev.bot.flag ? '<i class="fl" style="background:' + flagCss(ev.bot.flag) + '"></i>' : '';
    const colorPill = ev.bot ? '<span class="diplo-color" style="background:rgb(' + ev.bot.color + ')"></span>' : '';

    return '<div class="diplo-item ' + badgeClass + '">' +
      '<div class="diplo-item-header">' +
        '<span class="diplo-item-icon">' + (icon ? '<img src="' + icon + '" alt="' + ev.type + '" width="20" height="20">' : '') + '</span>' +
        '<span class="diplo-item-time">' + ev.time + '</span>' +
      '</div>' +
      '<div class="diplo-item-body">' + colorPill + flagHtml + '<span class="diplo-text">' + ev.message + '</span></div>' +
    '</div>';
  }).join('');
}

function getSeaPath(startTile, targetTile) {
  const startSeas = [];
  if (!land[startTile]) startSeas.push(startTile);
  else {
    for (const j of nbrs(startTile)) if (!land[j]) startSeas.push(j);
  }
  if (!startSeas.length) return null;

  const targetSeas = new Set();
  if (!land[targetTile]) targetSeas.add(targetTile);
  else {
    for (const j of nbrs(targetTile)) if (!land[j]) targetSeas.add(j);
  }
  if (!targetSeas.size) return null;

  const tx = targetTile % W, ty = (targetTile / W) | 0;
  let startSea = -1, minD = 1e9;
  for (const s of startSeas) {
    const sc = waterComp[s];
    let reachable = false;
    for (const t of targetSeas) {
      if (waterComp[t] === sc) { reachable = true; break; }
    }
    if (reachable) {
      const d = Math.hypot((s % W) - tx, ((s / W) | 0) - ty);
      if (d < minD) { minD = d; startSea = s; }
    }
  }
  if (startSea === -1) return null;

  if (targetSeas.has(startSea)) {
    const pts = [startSea];
    if (land[targetTile]) pts.push(targetTile);
    return pts;
  }

  const dist = new Float32Array(N).fill(1e9);
  const parent = new Int32Array(N).fill(-1);
  const inOpen = new Uint8Array(N);
  const heap = [startSea];
  const fScore = new Float32Array(N).fill(1e9);

  dist[startSea] = 0;
  fScore[startSea] = Math.hypot((startSea % W) - tx, ((startSea / W) | 0) - ty);
  inOpen[startSea] = 1;

  function push(idx) {
    heap.push(idx);
    inOpen[idx] = 1;
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fScore[heap[i]] < fScore[heap[p]]) {
        const t = heap[i]; heap[i] = heap[p]; heap[p] = t;
        i = p;
      } else break;
    }
  }

  function pop() {
    const top = heap[0], bot = heap.pop();
    inOpen[top] = 0;
    if (heap.length > 0) {
      heap[0] = bot;
      let i = 0;
      while (true) {
        let best = i, l = (i << 1) + 1, r = l + 1;
        if (l < heap.length && fScore[heap[l]] < fScore[heap[best]]) best = l;
        if (r < heap.length && fScore[heap[r]] < fScore[heap[best]]) best = r;
        if (best !== i) {
          const t = heap[i]; heap[i] = heap[best]; heap[best] = t;
          i = best;
        } else break;
      }
    }
    return top;
  }

  const dxs = [1, -1, 0, 0, 1, -1, 1, -1];
  const dys = [0, 0, 1, -1, 1, 1, -1, -1];
  const costs = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];
  let reachedEnd = -1;

  while (heap.length > 0) {
    const curr = pop();
    if (targetSeas.has(curr)) {
      reachedEnd = curr;
      break;
    }
    const cx = curr % W, cy = (curr / W) | 0, cd = dist[curr];

    for (let d = 0; d < 8; d++) {
      const nx = cx + dxs[d], ny = cy + dys[d];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = ny * W + nx;
      if (land[ni]) continue;
      if (d >= 4 && (land[cy * W + nx] || land[ny * W + cx])) continue;

      const coastCost = (nbrs(ni).some(j => land[j]) && !targetSeas.has(ni)) ? 0.35 : 0;
      const nd = cd + costs[d] + coastCost;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        parent[ni] = curr;
        fScore[ni] = nd + Math.hypot(nx - tx, ny - ty);
        if (!inOpen[ni]) push(ni);
      }
    }
  }

  if (reachedEnd === -1) return null;

  const rawPath = [];
  let s = reachedEnd;
  while (s !== -1) {
    rawPath.push(s);
    s = parent[s];
  }
  rawPath.reverse();
  if (land[targetTile]) {
    rawPath.push(targetTile);
  }
  return rawPath;
}

function findLandTradePath(hubA, hubB, pidA, pidB) {
  if (hubA < 0 || hubB < 0 || !land[hubA] || !land[hubB]) return null;
  const dist = new Float32Array(N).fill(1e9);
  const parent = new Int32Array(N).fill(-1);
  const q = [hubA];
  dist[hubA] = 0;
  let reached = false;

  for (let head = 0; head < q.length; head++) {
    const curr = q[head];
    if (curr === hubB) { reached = true; break; }
    const cx = curr % W, cy = (curr / W) | 0;
    const dxs = [1, -1, 0, 0], dys = [0, 0, 1, -1];
    for (let d = 0; d < 4; d++) {
      const nx = cx + dxs[d], ny = cy + dys[d];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = ny * W + nx;
      if (!land[ni]) continue;
      const o = owner[ni];
      if (o !== 0 && o !== pidA && o !== pidB && !(friendly(o, pidA) && friendly(o, pidB))) continue;

      const nd = dist[curr] + (o === pidA || o === pidB ? 1 : 1.5);
      if (nd < dist[ni]) {
        dist[ni] = nd;
        parent[ni] = curr;
        q.push(ni);
      }
    }
  }

  if (!reached) return null;
  const path = [];
  let s = hubB;
  while (s !== -1) {
    path.push(s);
    s = parent[s];
  }
  path.reverse();
  return path;
}

function getTradeHub(pid) {
  for (let i = 0; i < N; i++) if (owner[i] === pid && building[i] === 1) return i;
  const p = players[pid];
  if (!p) return -1;
  const startTile = p.sy * W + p.sx;
  if (owner[startTile] === pid && land[startTile]) return startTile;
  for (let i = 0; i < N; i++) if (owner[i] === pid && land[i]) return i;
  return -1;
}

function getTradePort(pid) {
  for (let i = 0; i < N; i++) if (owner[i] === pid && building[i] === 2) return i;
  for (let i = 0; i < N; i++) if (owner[i] === pid && isCoast(i)) return i;
  return -1;
}

function isTrading(a, b) {
  return tradeAgreements.some(t => (t.a === a && t.b === b) || (t.a === b && t.b === a));
}

function getTrade(a, b) {
  return tradeAgreements.find(t => (t.a === a && t.b === b) || (t.a === b && t.b === a));
}

function cancelTrade(a, b, reason) {
  const ex = getTrade(a, b);
  if (!ex) return;
  tradeAgreements = tradeAgreements.filter(t => t !== ex);
  if (a === HUMAN || b === HUMAN) {
    const other = a === HUMAN ? players[b] : players[a];
    const otherName = other ? other.name : 'partner';
    showToast('Trade agreement with ' + otherName + ' ended' + (reason ? ' (' + reason + ')' : '.') );
  }
}

function setupTradeRoute(pidA, pidB) {
  if (pidA === pidB || isTrading(pidA, pidB)) return { ok: false, reason: 'Already trading or invalid.' };
  const pa = players[pidA], pb = players[pidB];
  if (!pa || !pb || !pa.alive || !pb.alive) return { ok: false, reason: 'Nation unavailable.' };

  // 1. Try land connection (railroads)
  const hubA = getTradeHub(pidA), hubB = getTradeHub(pidB);
  let railPath = null;
  if (hubA !== -1 && hubB !== -1) {
    railPath = findLandTradePath(hubA, hubB, pidA, pidB);
  }

  if (railPath && railPath.length >= 3) {
    const duration = Math.max(30, railPath.length * 4);
    const trade = {
      a: pidA,
      b: pidB,
      type: 'rail',
      path: railPath,
      train: { progress: 0, duration },
      goldBonus: 2.2
    };
    tradeAgreements.push(trade);
    return { ok: true, trade, type: 'rail' };
  }

  // 2. If disconnected by sea, try port-to-port sea trade
  const portA = getTradePort(pidA), portB = getTradePort(pidB);
  if (portA === -1 || portB === -1) {
    return { ok: false, reason: 'Overseas trade requires a coastal port in both nations.' };
  }

  const seaPath = getSeaPath(portA, portB);
  if (!seaPath || seaPath.length < 3) {
    return { ok: false, reason: 'No navigable sea route between ports.' };
  }

  const duration = Math.max(40, seaPath.length * 4);
  const trade = {
    a: pidA,
    b: pidB,
    type: 'sea',
    path: seaPath,
    portA,
    portB,
    tradeShips: [
      { id: 1, progress: 0, duration, dir: 1, sunk: false, sinkAnim: 0, respawnTimer: 0, x: seaPath[0] % W + 0.5, y: ((seaPath[0] / W) | 0) + 0.5 },
      { id: 2, progress: Math.floor(duration / 2), duration, dir: -1, sunk: false, sinkAnim: 0, respawnTimer: 0, x: seaPath[seaPath.length - 1] % W + 0.5, y: ((seaPath[seaPath.length - 1] / W) | 0) + 0.5 }
    ],
    goldBonus: 2.2
  };
  tradeAgreements.push(trade);
  return { ok: true, trade, type: 'sea' };
}

function botAnswerTrade(bot, pid) {
  const r = relation(bot.id, pid);
  if (r !== 'peace' && r !== 'alliance') return false;
  return rnd() < 0.85;
}

function getAttackShipPos(na) {
  if (na.path && na.path.length) return getWarshipCoord(na);
  const sea = nbrs(na.ship.dock).find(j => !land[j]);
  const dockX = sea === undefined ? na.ship.dock % W + .5 : sea % W + .5;
  const dockY = sea === undefined ? ((na.ship.dock / W) | 0) + .5 : ((sea / W) | 0) + .5;
  return {
    x: dockX + (na.target % W + .5 - dockX) * na.progress / na.duration,
    y: dockY + (((na.target / W) | 0) + .5 - dockY) * na.progress / na.duration
  };
}

function getShipPos(s) {
  const attack = navalAttacks.find(a => a.ship === s);
  if (attack) return getAttackShipPos(attack);
  const sea = nbrs(s.dock).find(j => !land[j]);
  return {
    x: sea === undefined ? s.dock % W + .5 : sea % W + .5,
    y: sea === undefined ? ((s.dock / W) | 0) + .5 : ((sea / W) | 0) + .5
  };
}

let botOffset = 0;
function newGame() {
  BOTS = Math.max(1, Math.min(BOTS, 40));
  const R = SETTINGS.start;
  botOffset = (rnd() * COUNTRIES.length) | 0;
  owner.fill(0); building.fill(0); attacks = []; ships = []; navalAttacks = []; tick = 0; over = false; players = [null]; mode = null; rel = {};
  pendingOffers = []; activeOffer = null; humanOfferCooldown = 0; if ($('offer')) $('offer').hidden = true;
  tradeAgreements = []; sinkingEffects = []; cannonEffects = [];
  diploEvents = []; renderDiploFeed();
  updateCoastTiles();
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

function count(p, b) { let c = 0; for (let i = 0; i < N; i++) if (owner[i] === p.id && building[i] === b) c++; return c; }
function cap(p, cities) { return 150 + p.tiles * 8 + cities * 400; }
function economy() {
  const cities = new Array(players.length).fill(0), ports = cities.slice(), tiles = cities.slice(), posts = cities.slice();
  for (let i = 0; i < N; i++) if (owner[i]) {
    tiles[owner[i]]++; if (building[i] === 1) cities[owner[i]]++; else if (building[i] === 2) ports[owner[i]]++; else if (building[i] === 3) posts[owner[i]]++;
  }
  for (const p of players) {
    if (!p) continue;
    p.tiles = tiles[p.id]; p.cities = cities[p.id]; p.ports = ports[p.id]; p.posts = posts[p.id];
    if (!p.tiles) {
      if (p.alive) p.alive = false;
      attacks = attacks.filter(a => a.p !== p.id);
      ships = ships.filter(s => s.p !== p.id);
      navalAttacks = navalAttacks.filter(a => a.p !== p.id);
      continue;
    }
    const c = cap(p, p.cities);
    if (p.troops < c) p.troops = Math.min(c, p.troops + (0.6 + Math.min(p.tiles, 500) * .025 * (1 - p.troops / c) + 0.12 * p.cities) * (p.bot ? DIFFS[difficulty].grow : 1));
    else p.troops = Math.max(c, p.troops - (p.troops - c) * .02);
    p.gold += (p.tiles * .015 + p.cities * 0.7 + p.ports * 1.1 + .4) * (TICK / 1000) * 1.6;
  }
  for (let tIdx = tradeAgreements.length - 1; tIdx >= 0; tIdx--) {
    const tr = tradeAgreements[tIdx];
    const pa = players[tr.a], pb = players[tr.b];
    if (!pa || !pb || !pa.alive || !pb.alive || !friendly(tr.a, tr.b)) {
      tradeAgreements.splice(tIdx, 1);
      continue;
    }
    let rate = 0;
    if (tr.type === 'rail') rate = tr.goldBonus;
    else if (tr.type === 'sea') rate = tr.tradeShips.filter(s => !s.sunk).length * 1.1;
    const perTick = rate * (TICK / 1000) * 1.6;
    pa.gold += perTick;
    pb.gold += perTick;
  }
}

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
   cancelTrade(pid, target, 'War declared');
   const msg = 'You declared war on ' + bot.name + '.';
   showToast(msg);
   addDiploEvent('war', msg, bot);
   playSfx('war');
   return;
 }
 if (kind === 'break') {
   setRelation(pid, target, 'neutral');
   cancelTrade(pid, target, 'Treaty ended');
   const msg = 'Treaty with ' + bot.name + ' ended.';
   showToast(msg);
   addDiploEvent('break', msg, bot);
   return;
 }
 if (kind === 'cancel-trade') {
   cancelTrade(pid, target, 'Trade cancelled');
   const msg = 'Trade route with ' + bot.name + ' cancelled.';
   showToast(msg);
   addDiploEvent('break', msg, bot);
   return;
 }
 if (kind === 'trade') {
   if (isTrading(pid, target)) {
     showToast('You already have an active trade route with ' + bot.name + '.');
     return;
   }
   if (botAnswerTrade(bot, pid)) {
     const res = setupTradeRoute(pid, target);
     if (res.ok) {
       const msg = bot.name + ' accepted trade! ' + (res.type === 'rail' ? 'Railroads established.' : 'Merchant fleet launched.');
       showToast(msg);
       addDiploEvent('trade-accept', msg, bot);
       playSfx('trade');
     } else {
       const msg = bot.name + ' agreed to trade, but: ' + res.reason;
       showToast(msg);
       addDiploEvent('trade-reject', msg, bot);
     }
   } else {
     const msg = bot.name + ' rejected your trade proposal.';
     showToast(msg);
     addDiploEvent('trade-reject', msg, bot);
   }
   return;
 }
 if (botAnswer(bot, pid, kind)) {
   setRelation(pid, target, kind);
   const msg = bot.name + ' accepted your ' + (kind === 'peace' ? 'peace offer.' : 'alliance request.');
   showToast(msg);
   addDiploEvent(kind === 'peace' ? 'peace-accept' : 'alliance-accept', msg, bot);
   playSfx('treaty');
 } else {
   const msg = bot.name + ' rejected your ' + (kind === 'peace' ? 'peace offer.' : 'alliance request.');
   showToast(msg);
   addDiploEvent(kind === 'peace' ? 'peace-reject' : 'alliance-reject', msg, bot);
 }
}
function showNextOffer() {
 if (activeOffer || !pendingOffers.length) {
   if (!activeOffer && $('offer')) $('offer').hidden = true;
   return;
 }
 activeOffer = pendingOffers.shift();
 const bot = players[activeOffer.bot];
 if (!bot || !bot.alive || relation(HUMAN, bot.id) !== activeOffer.relation) {
   activeOffer = null; showNextOffer(); return;
 }
 const isAlliance = activeOffer.kind === 'alliance';
 const isTrade = activeOffer.kind === 'trade';
 const offerTitle = isAlliance ? 'Alliance Request' : isTrade ? 'Trade Proposal' : 'Peace Offer';
 const offerMsg = bot.name + (isAlliance ? ' has requested an alliance with your nation.' : isTrade ? ' has proposed a trade route (+gold income).' : ' has sent a peace treaty offer.');
 if ($('offerTitle')) $('offerTitle').textContent = offerTitle;
 if ($('offerText')) $('offerText').textContent = offerMsg;
 if ($('offer')) $('offer').hidden = false;
 addDiploEvent(isAlliance ? 'alliance-request' : isTrade ? 'trade-request' : 'peace-offer', bot.name + (isAlliance ? ' requested an alliance.' : isTrade ? ' proposed a trade route.' : ' sent a peace offer.'), bot);
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
 activeOffer = null; if ($('offer')) $('offer').hidden = true;
 const bot = offer && players[offer.bot];
 if (bot && bot.alive && relation(HUMAN, bot.id) === offer.relation) {
   if (accept) {
     if (offer.kind === 'trade') {
       const res = setupTradeRoute(HUMAN, bot.id);
       if (res.ok) {
         const msg = 'Trade established with ' + bot.name + '! ' + (res.type === 'rail' ? 'Railroads connected.' : 'Merchant fleet sailing.');
         showToast(msg);
         addDiploEvent('trade-accept', msg, bot);
         playSfx('trade');
       } else {
         showToast('Could not establish route: ' + res.reason);
       }
     } else {
       setRelation(HUMAN, bot.id, offer.kind);
       const msg = bot.name + ' is now ' + (offer.kind === 'peace' ? 'at peace with you.' : 'your ally.');
       showToast(msg);
       addDiploEvent(offer.kind === 'peace' ? 'peace-accept' : 'alliance-accept', 'You accepted ' + bot.name + '\'s ' + (offer.kind === 'peace' ? 'peace offer.' : 'alliance request.'), bot);
       playSfx('treaty');
     }
   } else {
     const msg = 'You rejected ' + bot.name + '\'s ' + (offer.kind === 'peace' ? 'peace offer.' : offer.kind === 'alliance' ? 'alliance request.' : 'trade proposal.');
     showToast(msg);
     addDiploEvent('reject', msg, bot);
   }
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
      const baseCost = def ? (1.5 + def.troops / Math.max(1, def.tiles) * .75) : 1.6;
      const cost = baseCost * sprawl * (building[j] === 3 ? 3 : 1);
      if (a.troops < cost) { att.troops += a.troops; a.troops = 0; break; }
      a.troops -= cost; done.add(j);
      if (def) { def.troops = Math.max(0, def.troops - cost * .8); def.tiles--; }
      owner[j] = a.p; att.tiles++; dirty = true;
    }
  }
  attacks = attacks.filter(a => a.troops > 0);
}

function botThink(b) {
  botBuildThink(b);
  botNavalThink(b);
  if (b.troops < 35 || attacks.some(a => a.p === b.id)) return;
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
function botBuildThink(b) {
  const pDefense = costOf('defense', b);
  const pCity = costOf('city', b);
  const pPort = costOf('port', b);
  const pShip = costOf('ship', b);

  const myCities = b.cities || 0;
  const myPorts = b.ports || 0;
  const myPosts = b.posts || 0;
  const myShips = ships.filter(s => s.p === b.id).length;

  let hasCoast = false;
  for (let i = 0; i < N; i++) {
    if (owner[i] === b.id && isCoast(i)) {
      hasCoast = true;
      break;
    }
  }

  if (hasCoast && myPorts === 0 && b.gold >= pPort) {
    const tile = findBestPortTile(b);
    if (tile !== -1 && tryBuild(b.id, 2, tile)) return;
  }

  const atWar = players.some(p => p && p.alive && p.id !== b.id && relation(b.id, p.id) === 'war');

  if (atWar && myPosts < Math.min(5, Math.max(1, Math.floor(b.tiles / 15))) && b.gold >= pDefense) {
    const tile = findBestDefenseTile(b);
    if (tile !== -1 && tryBuild(b.id, 3, tile)) return;
  }

  // Check if isolated on island (no land neighbors)
  let hasLandBorders = false;
  for (let i = 0; i < N; i++) {
    if (owner[i] === b.id) {
      for (const j of nbrs(i)) {
        if (land[j] && owner[j] !== b.id) { hasLandBorders = true; break; }
      }
      if (hasLandBorders) break;
    }
  }

  // 3. Ships: If has ports, maintain fleet of 1-3 ships
  const desiredShips = !hasCoast ? 0 : (!hasLandBorders ? Math.min(3, Math.max(1, myPorts)) : (b.tiles < 50 ? 1 : Math.min(3, 1 + Math.floor(myPorts / 2))));
  if (myPorts > 0 && myShips < desiredShips && b.gold >= pShip) {
    const dock = findPortForShip(b);
    if (dock !== -1 && tryBuildShip(b.id, dock)) return;
  }

  // If isolated island nation with no ships, save up for a ship first
  if (!hasLandBorders && hasCoast && myPorts > 0 && myShips === 0 && b.gold < pShip) {
    return;
  }

  // 4. Cities: Economic core development in safe interior
  const maxCities = Math.max(1, Math.floor(b.tiles / 20));
  if (b.tiles >= 12 && myCities < maxCities && b.gold >= pCity) {
    const tile = findBestCityTile(b);
    if (tile !== -1 && tryBuild(b.id, 1, tile)) return;
  }

  // 5. Peacetime border defense
  if (!atWar && myPosts < Math.min(3, Math.floor(b.tiles / 25)) && b.gold >= pDefense + 30) {
    const tile = findBestDefenseTile(b);
    if (tile !== -1 && tryBuild(b.id, 3, tile)) return;
  }

  // 6. Additional ports for large coastal nations
  if (hasCoast && myPorts < Math.min(3, Math.floor(b.tiles / 40)) && b.gold >= pPort + 40) {
    const tile = findBestPortTile(b);
    if (tile !== -1 && tryBuild(b.id, 2, tile)) return;
  }
}
function findBestDefenseTile(b) {
  let bestTile = -1, bestScore = -1e9;
  const existingPosts = [];
  for (let i = 0; i < N; i++) if (owner[i] === b.id && building[i] === 3) existingPosts.push(i);

  for (let i = 0; i < N; i++) {
    if (owner[i] !== b.id || building[i]) continue;
    const x = i % W, y = (i / W) | 0;

    let tooClose = false;
    for (const ep of existingPosts) {
      const ex = ep % W, ey = (ep / W) | 0;
      if (Math.hypot(x - ex, y - ey) < 3.5) { tooClose = true; break; }
    }
    if (tooClose) continue;

    let threat = 0, hasEnemyNeighbor = false;
    for (const j of nbrs(i)) {
      if (!land[j]) continue;
      const o = owner[j];
      if (o && o !== b.id) {
        hasEnemyNeighbor = true;
        const r = relation(b.id, o);
        if (r === 'war') threat += 10;
        else if (r === 'neutral') threat += 4;
        else if (r === 'peace') threat += 1;
        const enemy = players[o];
        if (enemy && enemy.troops > b.troops) threat += 3;
      }
    }
    if (!hasEnemyNeighbor) continue;
    if (isCoast(i)) threat += 2;

    if (threat > bestScore) {
      bestScore = threat;
      bestTile = i;
    }
  }
  return bestTile;
}
function findBestCityTile(b) {
  let bestTile = -1, bestScore = -1e9;
  const existingCities = [];
  for (let i = 0; i < N; i++) if (owner[i] === b.id && building[i] === 1) existingCities.push(i);

  const cx = b.cx !== undefined ? b.cx : b.sx;
  const cy = b.cy !== undefined ? b.cy : b.sy;

  for (let i = 0; i < N; i++) {
    if (owner[i] !== b.id || building[i]) continue;
    const x = i % W, y = (i / W) | 0;

    let tooClose = false;
    for (const ec of existingCities) {
      const ex = ec % W, ey = (ec / W) | 0;
      if (Math.hypot(x - ex, y - ey) < 4.5) { tooClose = true; break; }
    }
    if (tooClose) continue;

    let hostileNeighbors = 0, friendlyNeighbors = 0;
    for (const j of nbrs(i)) {
      if (!land[j]) continue;
      const o = owner[j];
      if (o && o !== b.id) {
        if (!friendly(b.id, o)) hostileNeighbors++;
      } else if (o === b.id) {
        friendlyNeighbors++;
      }
    }
    if (hostileNeighbors > 0) continue;

    const distFromCenter = Math.hypot(x - cx, y - cy);
    const score = friendlyNeighbors * 5 - distFromCenter * 0.4 + (rnd() * 2);
    if (score > bestScore) {
      bestScore = score;
      bestTile = i;
    }
  }
  return bestTile;
}
function findBestPortTile(b) {
  let bestTile = -1, bestScore = -1e9;
  const existingPorts = [];
  for (let i = 0; i < N; i++) if (owner[i] === b.id && building[i] === 2) existingPorts.push(i);

  for (let i = 0; i < N; i++) {
    if (owner[i] !== b.id || building[i] || !isCoast(i)) continue;
    const x = i % W, y = (i / W) | 0;

    let tooClose = false;
    for (const ep of existingPorts) {
      const ex = ep % W, ey = (ep / W) | 0;
      if (Math.hypot(x - ex, y - ey) < 6) { tooClose = true; break; }
    }
    if (tooClose) continue;

    const seaNeighbors = nbrs(i).filter(j => !land[j]).length;
    if (seaNeighbors === 0) continue;

    let hostileNeighbors = 0;
    for (const j of nbrs(i)) {
      if (land[j] && owner[j] && owner[j] !== b.id && !friendly(b.id, owner[j])) hostileNeighbors++;
    }

    const score = seaNeighbors * 3 - hostileNeighbors * 5 + (rnd() * 2);
    if (score > bestScore) {
      bestScore = score;
      bestTile = i;
    }
  }
  return bestTile;
}
function findPortForShip(b) {
  const ownPorts = [];
  for (let i = 0; i < N; i++) if (owner[i] === b.id && building[i] === 2) ownPorts.push(i);
  if (!ownPorts.length) return -1;
  const emptyPorts = ownPorts.filter(p => !ships.some(s => s.dock === p && !s.busy));
  if (emptyPorts.length) return emptyPorts[(rnd() * emptyPorts.length) | 0];
  return ownPorts[(rnd() * ownPorts.length) | 0];
}
function botNavalThink(b) {
  if (b.troops < 35) return;
  const idleShip = ships.find(s => s.p === b.id && !s.busy);
  if (!idleShip) return;
  if (navalAttacks.filter(a => a.p === b.id).length >= 2) return;

  const dockWater = nbrs(idleShip.dock).find(j => !land[j]);
  if (dockWater === undefined) return;
  const dockComp = waterComp[dockWater];

  let hasLandTargets = false;
  for (let i = 0; i < N; i++) {
    if (owner[i] === b.id) {
      for (const j of nbrs(i)) {
        if (land[j] && owner[j] !== b.id && !friendly(b.id, owner[j])) {
          hasLandTargets = true;
          break;
        }
      }
      if (hasLandTargets) break;
    }
  }

  if (hasLandTargets && rnd() > 0.35) return;

  const dockX = idleShip.dock % W, dockY = (idleShip.dock / W) | 0;
  let bestTarget = -1, bestScore = -1e9;

  for (const t of coastTiles) {
    const o = owner[t];
    if (o === b.id || (o && friendly(b.id, o))) continue;
    const tWater = nbrs(t).find(j => !land[j]);
    if (tWater === undefined || waterComp[tWater] !== dockComp) continue;

    const tx = t % W, ty = (t / W) | 0;
    const dist = Math.hypot(dockX - tx, dockY - ty);
    let score = 0;
    if (!o) {
      score = (hasLandTargets ? 40 : 80) - dist * 0.35 + (rnd() * 15);
    } else {
      const enemy = players[o];
      if (!enemy || !enemy.alive) continue;
      const atWar = relation(b.id, o) === 'war';
      const strengthAdv = (b.troops - enemy.troops) / Math.max(1, enemy.troops);
      score = (atWar ? 70 : 30) + strengthAdv * 20 - dist * 0.35 + (rnd() * 15);
    }
    if (score > bestScore) {
      bestScore = score;
      bestTarget = t;
    }
  }

  if (bestTarget !== -1 && bestScore > 0) {
    const targetOwner = owner[bestTarget];
    let frac = 0.3;
    if (!targetOwner) {
      frac = Math.min(0.35, Math.max(0.15, 12 / b.troops));
    } else {
      const def = players[targetOwner];
      const garrison = def ? def.troops / Math.max(1, def.tiles) : 1;
      frac = Math.min(0.55, Math.max(0.25, (garrison * 2 + 10) / b.troops));
    }
    startNavalAttack(b.id, bestTarget, frac);
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
  else if ((state === 'peace' || state === 'alliance') && !isTrading(bot.id, targetId) && rnd() < 0.1) kind = 'trade';
  else if ((state === 'peace' || state === 'alliance') && strength > rivalStrength * 1.4 && rnd() < (state === 'alliance' ? .025 : .06)) {
    setRelation(bot.id, targetId, 'neutral');
    cancelTrade(bot.id, targetId, 'Treaty broken');
    if (targetId === HUMAN) {
      const msg = bot.name + ' broke its treaty with you.';
      showToast(msg);
      addDiploEvent('break', msg, bot);
    }
    return true;
  }
  if (!kind) return false;
  if (targetId === HUMAN) {
    if (tick < humanOfferCooldown) return false;
    humanOfferCooldown = tick + 600;
    return queueBotOffer(bot, kind);
  }
  if (kind === 'trade') {
    if (botAnswerTrade(target, bot.id)) setupTradeRoute(bot.id, targetId);
    return true;
  }
  if (botAnswer(target, bot.id, kind)) setRelation(bot.id, targetId, kind);
  return true;
}
function randomTile(pid) {
  const own = []; for (let i = 0; i < N; i++) if (owner[i] === pid) own.push(i);
  return own.length ? own[(rnd() * own.length) | 0] : -1;
}
function tryBuild(pid, type, i) {
  const p = players[pid];
  if (!p) return false;
  const cost = costOf(type, p);
  if (i < 0 || owner[i] !== pid || building[i] || p.gold < cost) return false;
  if (type === 2 && !isCoast(i)) return false;
  p.gold -= cost; building[i] = type;
  if (type === 1) p.cities = (p.cities || 0) + 1;
  else if (type === 2) p.ports = (p.ports || 0) + 1;
  else if (type === 3) p.posts = (p.posts || 0) + 1;
  dirty = true; return true;
}
function tryBuildShip(pid, i) {
  const p = players[pid];
  if (!p) return false;
  const cost = costOf('ship', p);
  if (i < 0 || owner[i] !== pid || building[i] !== 2 || p.gold < cost || ships.filter(s => s.p === pid).length >= 8) return false;
  p.gold -= cost; ships.push({ p: pid, dock: i, busy: false }); dirty = true; return true;
}
function canReach(pid, i) { return nbrs(i).some(j => owner[j] === pid); }
function startNavalAttack(pid, target, frac) {
  const p = players[pid], ship = ships.find(s => s.p === pid && !s.busy);
  if (!ship) { if (pid === HUMAN) showToast('Build a ship at one of your ports first.'); return false; }
  if (!land[target] || !isCoast(target)) { if (pid === HUMAN) showToast('Ships can only land on coastal territory.'); return false; }
  if (owner[target] === pid) return false;
  if (owner[target] && friendly(pid, owner[target])) { if (pid === HUMAN) showToast('You have a treaty with that nation.'); return false; }
  const send = Math.floor(p.troops * frac);
  if (send < 5) { if (pid === HUMAN) showToast('You need at least 5 troops for an attack.'); return false; }

  const seaPath = getSeaPath(ship.dock, target);
  if (!seaPath || seaPath.length < 2) {
    if (pid === HUMAN) showToast('No navigable sea passage to that coast (land/islands block the way).');
    return false;
  }

  if (owner[target]) {
    const wasWar = relation(pid, owner[target]) === 'war';
    setRelation(pid, owner[target], 'war');
    cancelTrade(pid, owner[target], 'War declared');
    if (!wasWar) {
      if (owner[target] === HUMAN) {
        const msg = p.name + ' declared war and launched a naval invasion!';
        showToast(msg);
        addDiploEvent('war', msg, p);
        playSfx('war');
      } else if (pid === HUMAN) {
        const msg = 'You declared war on ' + players[owner[target]].name + ' with a naval invasion!';
        showToast(msg);
        addDiploEvent('war', msg, players[owner[target]]);
        playSfx('war');
      }
    }
  }
  p.troops -= send; ship.busy = true;
  const duration = Math.max(16, Math.ceil(seaPath.length * 2.4));
  navalAttacks.push({ p: pid, target, troops: send, ship, path: seaPath, progress: 0, duration });
  if (pid === HUMAN) {
    showToast('Fleet dispatched, navigating around islands.');
    playSfx('splash');
  }
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
    const baseCost = def ? (2 + def.troops / Math.max(1, def.tiles) * .8) : 2;
    const cost = baseCost * (building[a.target] === 3 ? 3 : 1);
    if (a.troops >= cost) {
      const prevOwner = owner[a.target];
      if (def) { def.troops = Math.max(0, def.troops - cost * .8); def.tiles--; }
      owner[a.target] = a.p; attacker.tiles++;
      attacker.troops += a.troops - cost; dirty = true;
      a.ship.busy = false;
      playSfx('cannon');
      if (a.p === HUMAN) {
        showToast('Naval landing secured!');
        playSfx('treaty');
      } else if (prevOwner === HUMAN) {
        showToast(attacker.name + ' secured a naval landing on your coast!');
        addDiploEvent('war', attacker.name + ' landed troops on your coast!', attacker);
        playSfx('war');
      }
    } else {
      const prevOwner = owner[a.target];
      a.ship.busy = false; ships = ships.filter(s => s !== a.ship);
      playSfx('splash');
      if (a.p === HUMAN) showToast('The landing failed and your ship was lost.');
      else if (prevOwner === HUMAN) {
        showToast('Your coastal defenses repelled a naval landing from ' + attacker.name + '!');
      }
    }
  }
  navalAttacks = active;
}

let cannonShots = [];
let explosions = [];
let smokeParticles = [];

function getWarshipCoord(target) {
  if (!target) return { x: 0, y: 0 };
  const attack = (target.path && target.progress !== undefined) ? target : navalAttacks.find(a => a.ship === target);
  if (attack && attack.path && attack.path.length >= 2) {
    const totalSegs = attack.path.length - 1;
    const t = Math.max(0, Math.min(1, attack.progress / attack.duration));
    const pos = t * totalSegs;
    const idx = Math.min(totalSegs - 1, Math.floor(pos));
    const frac = pos - idx;
    const p1 = attack.path[idx], p2 = attack.path[Math.min(totalSegs, idx + 1)];
    return {
      x: (p1 % W) * (1 - frac) + (p2 % W) * frac + 0.5,
      y: ((p1 / W) | 0) * (1 - frac) + (((p2 / W) | 0)) * frac + 0.5
    };
  }
  if (target.dock !== undefined) {
    const sea = nbrs(target.dock).find(j => !land[j]);
    const tile = sea === undefined ? target.dock : sea;
    return { x: tile % W + 0.5, y: ((tile / W) | 0) + 0.5 };
  }
  return { x: 0, y: 0 };
}

function stepNavalCombat() {
  if (tick % 5 !== 0) return;
  for (let i = 0; i < navalAttacks.length; i++) {
    const a1 = navalAttacks[i];
    const c1 = getWarshipCoord(a1);
    for (let j = i + 1; j < navalAttacks.length; j++) {
      const a2 = navalAttacks[j];
      if (relation(a1.p, a2.p) !== 'war') continue;
      const c2 = getWarshipCoord(a2);
      const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
      if (dist < 4.5) {
        cannonShots.push({ x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, progress: 0, duration: 6, color: '#ffec3d' });
        explosions.push({ x: c2.x + (rnd() - 0.5) * 0.5, y: c2.y + (rnd() - 0.5) * 0.5, r: 0.2, maxR: 1.4, life: 10, maxLife: 10, kind: 'splash' });
        playSfx('cannon');
        playSfx('splash');
        const dmg1 = Math.min(a1.troops - 1, Math.ceil(rnd() * 3 + 2));
        const dmg2 = Math.min(a2.troops - 1, Math.ceil(rnd() * 3 + 2));
        a1.troops -= dmg1;
        a2.troops -= dmg2;
        if (a1.p === HUMAN || a2.p === HUMAN) {
          showToast('Naval skirmish at sea between war fleets!');
        }
      }
    }
  }
}

function stepTrade() {
  cannonShots = cannonShots.filter(c => ++c.progress < c.duration);
  explosions = explosions.filter(e => { e.r += (e.maxR - e.r) * 0.25; return --e.life > 0; });
  smokeParticles = smokeParticles.filter(p => { p.x += p.vx; p.y += p.vy; p.r += 0.04; return --p.life > 0; });

  for (let tIdx = tradeAgreements.length - 1; tIdx >= 0; tIdx--) {
    const tr = tradeAgreements[tIdx];
    const pa = players[tr.a], pb = players[tr.b];
    if (!pa || !pb || !pa.alive || !pb.alive || !friendly(tr.a, tr.b)) {
      tradeAgreements.splice(tIdx, 1);
      continue;
    }

    if (tr.type === 'rail') {
      tr.train.progress = (tr.train.progress + 1) % tr.train.duration;
      if (tr.train.progress % 4 === 0 && tr.path.length >= 2) {
        const segs = tr.path.length - 1;
        const pos = (tr.train.progress / tr.train.duration) * segs;
        const idx = Math.min(segs - 1, Math.floor(pos));
        const frac = pos - idx;
        const p1 = tr.path[idx], p2 = tr.path[Math.min(segs, idx + 1)];
        const tx = (p1 % W) * (1 - frac) + (p2 % W) * frac + 0.5;
        const ty = ((p1 / W) | 0) * (1 - frac) + (((p2 / W) | 0)) * frac + 0.5;
        smokeParticles.push({ x: tx, y: ty, vx: (rnd() - 0.5) * 0.04, vy: -0.06 - rnd() * 0.04, life: 16, maxLife: 16, r: 0.2 });
      }
    } else if (tr.type === 'sea') {
      const enemyShips = [];
      for (const s of ships) {
        if (!s || !players[s.p] || !players[s.p].alive) continue;
        if (relation(tr.a, s.p) === 'war' || relation(tr.b, s.p) === 'war') {
          const coord = getWarshipCoord(s);
          enemyShips.push({ p: s.p, ship: s, x: coord.x, y: coord.y });
        }
      }

      for (const ship of tr.tradeShips) {
        if (ship.sunk) {
          if (ship.sinkAnim > 0) ship.sinkAnim = Math.max(0, ship.sinkAnim - 0.03);
          ship.respawnTimer--;
          if (ship.respawnTimer <= 0) {
            ship.sunk = false;
            ship.sinkAnim = 0;
            ship.progress = ship.dir === 1 ? 0 : ship.duration;
          }
          continue;
        }

        ship.progress += ship.dir;
        if (ship.progress >= ship.duration) {
          ship.progress = ship.duration;
          ship.dir = -1;
        } else if (ship.progress <= 0) {
          ship.progress = 0;
          ship.dir = 1;
        }

        const totalSegs = tr.path.length - 1;
        const tFrac = ship.progress / ship.duration;
        const seg = tFrac * totalSegs;
        const sIdx = Math.min(totalSegs - 1, Math.floor(seg));
        const sFrac = seg - sIdx;
        const p1 = tr.path[sIdx], p2 = tr.path[Math.min(totalSegs, sIdx + 1)];
        const sx = (p1 % W) * (1 - sFrac) + (p2 % W) * sFrac + 0.5;
        const sy = ((p1 / W) | 0) * (1 - sFrac) + (((p2 / W) | 0)) * sFrac + 0.5;
        ship.x = sx;
        ship.y = sy;

        // Check proximity to enemy warships
        for (const es of enemyShips) {
          const d = Math.hypot(sx - es.x, sy - es.y);
          if (d <= 4.2) {
            ship.sunk = true;
            ship.sinkAnim = 1.0;
            ship.respawnTimer = 160;
            cannonShots.push({ x1: es.x, y1: es.y, x2: sx, y2: sy, progress: 0, duration: 6, color: '#ffb300' });
            explosions.push({ x: sx, y: sy, r: 0.3, maxR: 1.6, life: 14, maxLife: 14, kind: 'splash' });
            playSfx('cannon');
            playSfx('splash');
            if (tr.a === HUMAN || tr.b === HUMAN) {
              showToast('⚠️ A merchant trade ship was intercepted and sunk by enemy warships!');
              addDiploEvent('war', 'Trade vessel intercepted and sunk near enemy fleet!', players[es.p]);
            }
            break;
          }
        }
      }
    }
  }
}

// ---------- loop ----------
function step() {
  if (!started || paused || over) return;
  tick++; stepAttacks(); stepNavalAttacks(); stepNavalCombat(); stepTrade();
  for (const s of ships.slice()) {
    if (!s.busy && (owner[s.dock] !== s.p || building[s.dock] !== 2)) {
      const altPorts = [];
      for (let i = 0; i < N; i++) if (owner[i] === s.p && building[i] === 2) altPorts.push(i);
      if (altPorts.length) s.dock = altPorts[0];
      else ships = ships.filter(item => item !== s);
    }
  }
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
  pendingOffers = []; activeOffer = null; if ($('offer')) $('offer').hidden = true;
  const me = players[HUMAN], earned = Math.floor(me.tiles / 8) + (t === 'Victory!' ? 100 : 0) + 10;
  save.coins += earned; persist(); updateCoins(); updateControls();
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
    const depth = Math.max(0, Math.min(1, (sea - h) / .3));
    const wr = 20 - depth * 12, wg = 137 - depth * 70, wb = 194 - depth * 70;
    const t = Math.min(1, Math.max(0, h - sea) * 3), lv = h < sea + .015 ? 250 : 235 - t * 60;
    // antialiased shoreline: blend land/water across a thin band around the sea level
    let m = Math.max(0, Math.min(1, (h - sea) / .004 + .5)); m = m * m * (3 - 2 * m);
    r = wr + (lv - wr) * m; g = wg + (lv - wg) * m; b = wb + (lv - wb) * m;
    const o = (py * W * SS + px) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
}
let terrImg, terrData;
function drawOwners() {
  ter.width = W; ter.height = H;
  const img = ictx.createImageData(W, H), d = img.data, pat = save.eq.pattern;
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
  ictx.putImageData(img, 0, 0);
  terr.width = W * SS; terr.height = H * SS;
  octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
  if ('filter' in octx) octx.filter = 'blur(' + (SS * 0.5) + 'px)';
  octx.drawImage(ter, 0, 0, W * SS, H * SS);
  octx.filter = 'none';
  dirty = false;
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
  ctx.fillStyle = '#075b91'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(cam.z, cam.z);
  ctx.drawImage(terrain, 0, 0, W, H);
  ctx.drawImage(terr, 0, 0, W, H);
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

  // Railroads & Trains
  for (const tr of tradeAgreements) {
    if (tr.type === 'rail' && tr.path.length >= 2) {
      // Rails
      ctx.save();
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.32;
      ctx.beginPath();
      for (let k = 0; k < tr.path.length; k++) {
        const pt = tr.path[k], px = pt % W + 0.5, py = ((pt / W) | 0) + 0.5;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Wooden cross-ties
      ctx.strokeStyle = '#6b4f2c';
      ctx.lineWidth = 0.2;
      for (let k = 0; k < tr.path.length - 1; k++) {
        const p1 = tr.path[k], p2 = tr.path[k + 1];
        const x1 = p1 % W + 0.5, y1 = ((p1 / W) | 0) + 0.5;
        const x2 = p2 % W + 0.5, y2 = ((p2 / W) | 0) + 0.5;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len > 0.001) {
          const nx = -dy / len * 0.32, ny = dx / len * 0.32;
          ctx.beginPath();
          ctx.moveTo(x1 + nx, y1 + ny);
          ctx.lineTo(x1 - nx, y1 - ny);
          ctx.stroke();
        }
      }

      // Train engine & cars
      const segs = tr.path.length - 1;
      const pos = (tr.train.progress / tr.train.duration) * segs;
      const idx = Math.min(segs - 1, Math.floor(pos));
      const frac = pos - idx;
      const p1 = tr.path[idx], p2 = tr.path[Math.min(segs, idx + 1)];
      const tx = (p1 % W) * (1 - frac) + (p2 % W) * frac + 0.5;
      const ty = ((p1 / W) | 0) * (1 - frac) + (((p2 / W) | 0)) * frac + 0.5;
      const angle = Math.atan2(((p2 / W) | 0) - ((p1 / W) | 0), (p2 % W) - (p1 % W));
      ctx.translate(tx, ty);
      ctx.rotate(angle);
      // Locomotive body
      ctx.fillStyle = '#222';
      ctx.fillRect(-0.55, -0.22, 1.1, 0.44);
      // Cab
      ctx.fillStyle = '#8b0000';
      ctx.fillRect(-0.55, -0.24, 0.4, 0.48);
      // Chimney & Headlight
      ctx.fillStyle = '#111';
      ctx.fillRect(0.2, -0.15, 0.2, 0.3);
      ctx.fillStyle = '#ffec3d';
      ctx.beginPath(); ctx.arc(0.55, 0, 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // Sea Trade Routes & Tiny Trade Ships
  for (const tr of tradeAgreements) {
    if (tr.type === 'sea' && tr.path.length >= 2) {
      // Dashed trade lane
      ctx.save();
      ctx.setLineDash([0.6, 0.9]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      for (let k = 0; k < tr.path.length; k++) {
        const pt = tr.path[k], px = pt % W + 0.5, py = ((pt / W) | 0) + 0.5;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Tiny sailing trade ships
      for (const ship of tr.tradeShips) {
        if (ship.sinkAnim > 0) {
          const sa = ship.sinkAnim;
          ctx.save();
          ctx.globalAlpha = sa;
          ctx.translate(ship.x, ship.y);
          ctx.rotate(0.6 * (1 - sa));
          ctx.scale(0.7 * sa, 0.7 * sa);
          ctx.fillStyle = '#4a2c11';
          ctx.fillRect(-0.6, -0.2, 1.2, 0.4);
          ctx.fillStyle = '#d4a373';
          ctx.fillRect(-0.2, -0.5, 0.4, 0.3);
          ctx.restore();
          // Ripples
          ctx.save();
          ctx.strokeStyle = `rgba(255, 255, 255, ${sa * 0.75})`;
          ctx.lineWidth = 0.15;
          ctx.beginPath();
          ctx.arc(ship.x, ship.y, (1 - sa) * 1.6 + 0.3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (!ship.sunk) {
          const totalSegs = tr.path.length - 1;
          const tFrac = ship.progress / ship.duration;
          const seg = tFrac * totalSegs;
          const sIdx = Math.min(totalSegs - 1, Math.floor(seg));
          const p1 = tr.path[sIdx], p2 = tr.path[Math.min(totalSegs, sIdx + 1)];
          const angle = ship.dir === 1
            ? Math.atan2(((p2 / W) | 0) - ((p1 / W) | 0), (p2 % W) - (p1 % W))
            : Math.atan2(((p1 / W) | 0) - ((p2 / W) | 0), (p1 % W) - (p2 % W));

          ctx.save();
          ctx.translate(ship.x, ship.y);
          ctx.rotate(angle);
          ctx.scale(0.85, 0.85);
          // Hull
          ctx.fillStyle = '#8b5a2b';
          ctx.strokeStyle = '#3d2006';
          ctx.lineWidth = 0.15;
          ctx.beginPath();
          ctx.moveTo(-0.65, 0.22);
          ctx.lineTo(0.65, 0.22);
          ctx.lineTo(0.85, 0);
          ctx.lineTo(0.65, -0.22);
          ctx.lineTo(-0.65, -0.22);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Cargo crates
          ctx.fillStyle = '#d4a373';
          ctx.fillRect(-0.35, -0.16, 0.3, 0.32);
          ctx.fillStyle = '#b7b7a4';
          ctx.fillRect(0.05, -0.16, 0.3, 0.32);
          // Sail
          const pa = players[tr.a];
          ctx.fillStyle = pa ? 'rgba(' + pa.color.join(',') + ', 0.92)' : '#fff';
          ctx.beginPath();
          ctx.moveTo(-0.1, -0.7);
          ctx.lineTo(-0.1, 0.05);
          ctx.lineTo(0.45, -0.3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  // Warships
  for (const ship of ships) {
    const attack = navalAttacks.find(a => a.ship === ship);
    let x, y, angle = 0;
    if (attack && attack.path && attack.path.length >= 2) {
      const totalSegs = attack.path.length - 1;
      const t = Math.max(0, Math.min(1, attack.progress / attack.duration));
      const pos = t * totalSegs;
      const idx = Math.min(totalSegs - 1, Math.floor(pos));
      const frac = pos - idx;
      const p1 = attack.path[idx], p2 = attack.path[Math.min(totalSegs, idx + 1)];
      x = (p1 % W) * (1 - frac) + (p2 % W) * frac + 0.5;
      y = ((p1 / W) | 0) * (1 - frac) + (((p2 / W) | 0)) * frac + 0.5;
      angle = Math.atan2(((p2 / W) | 0) - ((p1 / W) | 0), (p2 % W) - (p1 % W));
    } else {
      const sea = nbrs(ship.dock).find(j => !land[j]);
      const dockX = sea === undefined ? ship.dock % W + .5 : sea % W + .5;
      const dockY = sea === undefined ? ((ship.dock / W) | 0) + .5 : ((sea / W) | 0) + .5;
      x = dockX;
      y = dockY;
    }
    ctx.save(); ctx.translate(x, y);
    if (attack) ctx.rotate(angle);
    ctx.scale(1.2, 1.2);
    const sk = ship.p === HUMAN ? eqItem('ship') : CATALOG.ship.items[0];
    ctx.fillStyle = sk.hull; ctx.strokeStyle = sk.line; ctx.lineWidth = .2;
    ctx.beginPath(); ctx.moveTo(-.9, .1); ctx.lineTo(.9, .1); ctx.lineTo(.55, .55); ctx.lineTo(-.55, .55); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (sk.hull === '#444') {
      ctx.fillStyle = '#222';
      ctx.fillRect(-0.25, -0.45, 0.22, 0.55);
      ctx.fillStyle = '#666';
      ctx.fillRect(0.1, 0.12, 0.45, 0.18);
    } else {
      ctx.fillStyle = ship.p === HUMAN ? sk.sail : (players[ship.p] ? 'rgb(' + players[ship.p].color.join(',') + ')' : sk.sail);
      ctx.beginPath(); ctx.moveTo(-.05, -.9); ctx.lineTo(-.05, .05); ctx.lineTo(.62, .05); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // Cannon projectile shots
  for (const c of cannonShots) {
    const t = c.progress / c.duration;
    const cx = c.x1 + (c.x2 - c.x1) * t;
    const cy = c.y1 + (c.y2 - c.y1) * t;
    ctx.save();
    ctx.strokeStyle = c.color || '#ffec3d';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(c.x1 + (c.x2 - c.x1) * Math.max(0, t - 0.25), c.y1 + (c.y2 - c.y1) * Math.max(0, t - 0.25));
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.restore();
  }

  // Explosions / splashes
  for (const e of explosions) {
    ctx.save();
    const alpha = e.life / e.maxLife;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = 'rgba(255, 230, 150, 0.6)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Smoke particles
  for (const sm of smokeParticles) {
    ctx.save();
    const alpha = sm.life / sm.maxLife;
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.arc(sm.x, sm.y, sm.r, 0, Math.PI * 2);
    ctx.fill();
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
  if (!me) return;
  const fleet = ships.filter(s => s.p === HUMAN).length, sailing = navalAttacks.filter(a => a.p === HUMAN).length;
  const c = cap(me, me.cities || 0);

  const activeTradeCount = tradeAgreements.filter(tr => tr.a === HUMAN || tr.b === HUMAN).length;
  let tradeIncome = 0;
  for (const tr of tradeAgreements) {
    if (tr.a === HUMAN || tr.b === HUMAN) {
      if (tr.type === 'rail') tradeIncome += tr.goldBonus;
      else if (tr.type === 'sea') tradeIncome += tr.tradeShips.filter(s => !s.sunk).length * 1.1;
    }
  }
  const tradeRate = (tradeIncome * 1.6).toFixed(1);

  const goldRate = ((me.tiles * 0.015 + (me.cities || 0) * 0.7 + (me.ports || 0) * 1.1 + 0.4 + tradeIncome) * 1.6).toFixed(1);
  const troopRate = me.troops < c ? ((0.6 + Math.min(me.tiles, 500) * 0.025 * (1 - me.troops / c) + 0.12 * (me.cities || 0)) * 10).toFixed(1) : '0.0';

  if ($('stats')) {
    $('stats').innerHTML =
      '<div class="stats-pills">' +
        '<div class="stat-pill stat-gold" title="Current gold and gold income per second">' +
          '<img class="stat-icon" src="Assets/Hotbar Assets/Gold.png" alt="">' +
          '<span class="stat-label">Gold</span>' +
          '<b class="stat-val">' + Math.floor(me.gold) + '</b>' +
          '<span class="stat-rate">(+' + goldRate + '/s)</span>' +
        '</div>' +
        '<div class="stat-pill stat-troops" title="Troop count, troop capacity, and growth per second">' +
          '<img class="stat-icon" src="Assets/Hotbar Assets/Troops.png" alt="">' +
          '<span class="stat-label">Troops</span>' +
          '<b class="stat-val">' + Math.floor(me.troops) + '/' + c + '</b>' +
          '<span class="stat-rate">(+' + troopRate + '/s)</span>' +
        '</div>' +
        '<div class="stat-pill stat-land" title="Territory tiles">' +
          '<img class="stat-icon" src="Assets/Hotbar Assets/Land.png" alt="">' +
          '<span class="stat-label">Land</span>' +
          '<b class="stat-val">' + me.tiles + '</b>' +
        '</div>' +
      '</div>' +
      '<div class="stats-assets">' +
        '<span class="stat-asset" title="Cities (boosts troops & gold)"><span class="asset-icon">🏛️</span> Cities: <b>' + (me.cities || 0) + '</b></span>' +
        '<span class="stat-asset" title="Ports (boosts gold)"><span class="asset-icon">⚓</span> Ports: <b>' + (me.ports || 0) + '</b></span>' +
        '<span class="stat-asset" title="Defense Posts (triples defense)"><span class="asset-icon">🛡️</span> Posts: <b>' + (me.posts || 0) + '</b></span>' +
        '<span class="stat-asset" title="Fleet"><span class="asset-icon">⛵</span> Ships: <b>' + fleet + '</b>' + (sailing ? ' <small class="stat-sailing">(' + sailing + ' sailing)</small>' : '') + '</span>' +
        '<span class="stat-asset" title="Active trade agreements"><span class="asset-icon">🤝</span> Trade: <b>' + activeTradeCount + '</b>' + (activeTradeCount > 0 ? ' <small style="color:#2ecc40">(+' + tradeRate + 'g/s)</small>' : '') + '</span>' +
      '</div>';
  }

  const cCity = costOf('city', me), cPort = costOf('port', me), cDef = costOf('defense', me), cShip = costOf('ship', me);
  $('cCity').textContent = cCity; $('cPort').textContent = cPort;
  $('cDef').textContent = cDef; $('cShip').textContent = cShip;
  $('bCity').disabled = me.gold < cCity; $('bPort').disabled = me.gold < cPort;
  $('bDef').disabled = me.gold < cDef; $('bShip').disabled = me.gold < cShip || fleet >= 8;
  $('board').innerHTML = '<div class="board-header"><b>Leaderboard</b></div>' + players.filter(p => p && p.alive).sort((a, b) => b.tiles - a.tiles).slice(0, 8)
    .map(p => '<div class="board-row"><span class="board-color" style="background:rgb(' + p.color + ')"></span> ' + (p.flag ? '<i class="fl" style="background:' + flagCss(p.flag) + '"></i>' : '') + '<span class="board-name">' + p.name + '</span> <span class="board-tiles">' + p.tiles + '</span></div>').join('');
}
function showToast(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
function toTile(e) { return { x: Math.floor((e.offsetX - cam.x) / cam.z), y: Math.floor((e.offsetY - cam.y) / cam.z) }; }
let drag = null, hover = null;
cv.onmouseleave = () => { hover = null; };
function buildCheck(type, i) {
  const me = players[HUMAN];
  if (!me || i < 0 || owner[i] !== HUMAN || !land[i]) return false;
  const cost = costOf(type, me);
  if (type === 'ship') return building[i] === 2 && me.gold >= cost && ships.filter(s => s.p === HUMAN).length < 8;
  if (building[i]) return false;
  if (type === 'port' && !isCoast(i)) return false;
  return me.gold >= cost;
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
  const trading = isTrading(HUMAN, o);
  const label = { neutral: 'Neutral', war: 'At war', peace: 'At peace', alliance: 'Allied' }[r];
  ctxMenu.innerHTML = '<b>' + p.name + '</b><small>' + label + (trading ? ' · Trading 🤝' : '') + ' · Troops ' + Math.floor(p.troops) + ' · Land ' + p.tiles + '</small>';
  const add = (text, kind) => { const b = document.createElement('button'); b.textContent = text; b.onclick = () => { hideCtx(); diplomacy(HUMAN, o, kind); }; ctxMenu.appendChild(b); };
  if (r !== 'war') add('Declare war', 'war');
  if (r === 'neutral' || r === 'war') add('Propose peace', 'peace');
  if (r === 'peace') add('Request alliance', 'alliance');
  if ((r === 'peace' || r === 'alliance') && !trading) add('Request trade', 'trade');
  if (trading) add('Cancel trade', 'cancel-trade');
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
  if ($('help')) $('help').textContent = mode === 'city' ? 'City mode: click your empty land to build.' : mode === 'port' ? 'Port mode: click empty coastal land to build.' : mode === 'defense' ? 'Defense mode: click your empty land to build a post.' : mode === 'ship' ? 'Ship mode: click one of your ports to commission a ship.' : 'Click land to attack · Build on your territory · Build ships at ports';
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
$('cCity').textContent = costOf('city'); $('cPort').textContent = costOf('port'); $('cShip').textContent = costOf('ship'); $('cDef').textContent = costOf('defense');
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
const setting = (id, key, min, max, redo, display = value => value, parse = value => value) => {
  const input = $(id), sync = () => { input.value = display(SETTINGS[key]); };
  sync();
  input.onchange = () => {
    const entered = Number(input.value);
    SETTINGS[key] = parse(Number.isFinite(entered) ? Math.max(min, Math.min(max, entered)) : display(SETTINGS[key]));
    sync();
    if (!started) { if (redo) genMap(); newGame(); drawTerrain(); updateHud(); }
  };
};
setting('startSelect', 'start', 1, 3, false, Math.round, Math.round);
setting('winSelect', 'winPct', 1, 99, false, Math.round, Math.round);
setting('troopSelect', 'troops', 0, 1000000, false, Math.floor, Math.floor);
setting('goldSelect', 'gold', 0, 1000000000, false, Math.floor, Math.floor);
setting('seaSelect', 'sea', -0.2, 0.2, true, value => Math.round(-value * 100), value => -Math.round(value) / 100);
$('botSelect').onchange = () => {
  const entered = Number($('botSelect').value);
  BOTS = Number.isFinite(entered) ? Math.max(1, Math.min(40, Math.floor(entered))) : BOTS;
  $('botSelect').value = BOTS;
  if (!started) { newGame(); updateHud(); }
};
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
function updateControls() {
  const pBtn = $('bPause'), uBtn = $('bUnpause'), lBtn = $('bLeave');
  if (!pBtn || !uBtn || !lBtn) return;
  const inGame = started && !over;
  pBtn.disabled = !inGame || paused;
  uBtn.disabled = !inGame || !paused;
  lBtn.disabled = !started;
  pBtn.classList.toggle('active', inGame && !paused);
  uBtn.classList.toggle('active', inGame && paused);
}
function showMenu() {
  $('mapSelect').value = mapKind; $('diffSelect').value = difficulty; $('botSelect').value = BOTS;
  $('startSelect').value = SETTINGS.start; $('winSelect').value = SETTINGS.winPct;
  $('troopSelect').value = SETTINGS.troops; $('goldSelect').value = SETTINGS.gold;
  $('seaSelect').value = Math.round(-SETTINGS.sea * 100); updateCoins();
  paused = true; $('menu').hidden = false; if ($('menuStart')) $('menuStart').hidden = started; $('menuResume').hidden = !started;
  updateControls();
}
function beginGame(reset) {
  if (reset) { genMap(); newGame(); drawTerrain(); fit(); }
  started = true; paused = false; $('menu').hidden = true; $('msg').hidden = true; updateHud(); setMode(null);
  updateControls();
}
if ($('menuStart')) $('menuStart').onclick = () => beginGame(true);
$('menuResume').onclick = () => { paused = false; $('menu').hidden = true; updateControls(); };
$('menuNew').onclick = () => beginGame(true);
if ($('bMenu')) $('bMenu').onclick = showMenu;
if ($('bPause')) $('bPause').onclick = () => {
  if (!started || over || paused) return;
  paused = true;
  updateControls();
  showToast('Game paused');
};
if ($('bUnpause')) $('bUnpause').onclick = () => {
  if (!started || over || !paused) return;
  paused = false;
  $('menu').hidden = true;
  updateControls();
  showToast('Game resumed');
};
if ($('bLeave')) $('bLeave').onclick = () => {
  if (!started) return;
  paused = true;
  started = false;
  showMenu();
};
if ($('bSound')) {
  $('bSound').onclick = () => {
    soundEnabled = !soundEnabled;
    $('bSound').textContent = soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
    $('bSound').classList.toggle('off', !soundEnabled);
  };
}
addEventListener('keydown', e => { if (e.key === 'Escape' && started && !over) { if ($('menu').hidden) showMenu(); else { paused = false; $('menu').hidden = true; updateControls(); } } });
addEventListener('resize', () => { resize(); fit(); });

genMap(); newGame(); drawTerrain(); resize(); fit(); updateHud(); updateCoins(); updateControls(); renderDiploFeed();
setInterval(step, TICK); requestAnimationFrame(render);
