'use strict';
// Original real-time territory conquest game. Simulation runs on a hidden
// grid; rendering is resolution-independent and smoothed (no visible tiles).
const W = 192, H = 120, N = W * H, BOTS = 14, TICK = 100;
const COST = { city: 150, port: 100, ship: 220 };
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
function genMap() {
  const n1 = makeNoise(), n2 = makeNoise();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x / W - .5, dy = y / H - .5;
    const h = n1(x, y, .5) * .6 + n2(x, y, 1) * .4 - Math.hypot(dx, dy) * .5;
    height[y * W + x] = h; land[y * W + x] = h > .36 ? 1 : 0;
  }
}

// ---------- state ----------
const owner = new Uint8Array(N);          // 0 = unclaimed
const building = new Uint8Array(N);       // 0 none, 1 city, 2 port
let players = [], attacks = [], ships = [], navalAttacks = [], tick = 0, over = false, mode = null;
let started = false, paused = true, toastTimer;
const HUMAN = 1;
const nbrs = i => {
  const x = i % W, r = [];
  if (x > 0) r.push(i - 1); if (x < W - 1) r.push(i + 1);
  if (i >= W) r.push(i - W); if (i < N - W) r.push(i + W);
  return r;
};
const isCoast = i => nbrs(i).some(j => !land[j]);

function newGame() {
  owner.fill(0); building.fill(0); attacks = []; ships = []; navalAttacks = []; tick = 0; over = false; players = [null]; mode = null;
  const spots = [];
  for (let i = 0; i < N; i++) if (land[i]) spots.push(i);
  const hues = [];
  for (let p = 1; p <= BOTS + 1; p++) {
    let s, tries = 0;
    do { s = spots[(rnd() * spots.length) | 0]; tries++; }
    while (tries < 400 && players.some(q => q && Math.hypot(q.sx - s % W, q.sy - ((s / W) | 0)) < 18));
    const hue = p === 1 ? 210 : (p * 137) % 360;
    const pl = { id: p, name: p === 1 ? 'You' : 'Bot ' + (p - 1), bot: p !== 1, sx: s % W, sy: (s / W) | 0,
      troops: 100, gold: 100, tiles: 0, alive: true, color: hsl(hue, p === 1 ? 90 : 65, 52), think: (rnd() * 20) | 0 };
    players.push(pl);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
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
  const cities = new Array(players.length).fill(0), ports = cities.slice(), tiles = cities.slice();
  for (let i = 0; i < N; i++) if (owner[i]) {
    tiles[owner[i]]++; if (building[i] === 1) cities[owner[i]]++; else if (building[i] === 2) ports[owner[i]]++;
  }
  for (const p of players) {
    if (!p) continue;
    p.tiles = tiles[p.id]; p.cities = cities[p.id]; p.ports = ports[p.id];
    if (!p.tiles) { if (p.alive) p.alive = false; attacks = attacks.filter(a => a.p !== p.id); continue; }
    const c = cap(p, p.cities);
    if (p.troops < c) p.troops = Math.min(c, p.troops + 1 + p.tiles * .05 * (1 - p.troops / c) + 0.2 * p.cities);
    else p.troops = Math.max(c, p.troops - (p.troops - c) * .02);
    p.gold += (p.tiles * .02 + p.cities * 1 + p.ports * 1.5 + .5) * (TICK / 1000) * 2;
  }
}

// ---------- combat ----------
function startAttack(pid, target, frac) {
  const p = players[pid];
  if (!p.alive || target === pid) return false;
  const send = Math.floor(p.troops * frac);
  if (send < 5) return false;
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
    const att = players[a.p], def = a.t ? players[a.t] : null, list = cand.get(a);
    let n = Math.min(list.length, Math.max(2, Math.ceil(Math.sqrt(att.tiles) * 1.2)));
    if (!list.length || (def && !def.alive)) { att.troops += a.troops; a.troops = 0; }
    const done = new Set();
    while (n-- > 0 && a.troops > 0 && list.length) {
      const k = (rnd() * list.length) | 0, j = list.splice(k, 1)[0];
      if (done.has(j) || owner[j] !== a.t) continue;
      const cost = def ? 1.5 + def.troops / Math.max(1, def.tiles) * 1.5 : 1;
      if (a.troops < cost) { att.troops += a.troops; a.troops = 0; break; }
      a.troops -= cost; done.add(j);
      if (def) { def.troops = Math.max(0, def.troops - cost * .8); def.tiles--; }
      owner[j] = a.p; att.tiles++; dirty = true;
      if (building[j] && a.t) { building[j] = building[j]; }
    }
  }
  attacks = attacks.filter(a => a.troops > 0);
}

// ---------- bots ----------
function botThink(b) {
  if (b.gold > COST.city + 50 && rnd() < .5) tryBuild(b.id, 1, randomTile(b.id));
  else if (b.gold > COST.port + 50 && rnd() < .3) tryBuild(b.id, 2, randomTile(b.id));
  if (b.troops < 40 || attacks.some(a => a.p === b.id)) return;
  const targets = new Map(); let free = false;
  for (let i = 0; i < N; i++) if (owner[i] === b.id) for (const j of nbrs(i)) if (land[j] && owner[j] !== b.id) {
    if (!owner[j]) free = true; else targets.set(owner[j], 1);
  }
  let best = 0, bestT = 1e9;
  for (const t of targets.keys()) { const d = players[t].troops / Math.max(1, players[t].tiles); if (d < bestT) { bestT = d; best = t; } }
  if (free && (rnd() < .6 || !best)) startAttack(b.id, 0, .3);
  else if (best && b.troops > players[best].troops * .5) startAttack(b.id, best, .5);
}
function randomTile(pid) {
  const own = []; for (let i = 0; i < N; i++) if (owner[i] === pid) own.push(i);
  return own.length ? own[(rnd() * own.length) | 0] : -1;
}
function tryBuild(pid, type, i) {
  const p = players[pid], cost = COST[type === 1 ? 'city' : 'port'];
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
  const send = Math.floor(p.troops * frac);
  if (send < 5) { showToast('You need at least 5 troops for an attack.'); return false; }
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
    const cost = def ? 1.5 + def.troops / Math.max(1, def.tiles) * 1.5 : 1;
    if (a.troops >= cost) {
      if (def) { def.troops = Math.max(0, def.troops - cost * .8); def.tiles--; }
      owner[a.target] = a.p; attacker.tiles++; building[a.target] = 0;
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
  for (const b of players) if (b && b.bot && b.alive && ++b.think % 15 === 0) botThink(b);
  economy(); checkEnd(); updateHud();
}
function checkEnd() {
  const alive = players.filter(p => p && p.alive);
  const me = players[HUMAN];
  if (!me.alive) end('Defeated');
  else if (alive.length === 1 || me.tiles > count_land() * .7) end('Victory!');
}
let landCount = 0; const count_land = () => landCount || (landCount = land.reduce((a, b) => a + b, 0));
function end(t) { over = true; const m = document.getElementById('msg'); m.hidden = false; m.innerHTML = t + '<br><button onclick="location.reload()">Play again</button>'; }

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
    if (h > .36) { const t = Math.min(1, (h - .36) * 3); r = 110 + t * 60; g = 150 - t * 30; b = 85 + t * 30; if (h < .375) { r = 215; g = 205; b = 150; } }
    else { const t = Math.max(0, (h - .15) / .21); r = 15 + t * 35; g = 60 + t * 80; b = 110 + t * 70; }
    const o = (py * W * SS + px) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
}
let terrImg, terrData;
function drawOwners() {
  terr.width = W; terr.height = H;
  const img = octx.createImageData(W, H), d = img.data;
  for (let i = 0; i < N; i++) {
    const o = owner[i]; if (!o) continue;
    const c = players[o].color; let edge = false;
    for (const j of nbrs(i)) if (owner[j] !== o) { edge = true; break; }
    d[i * 4] = edge ? c[0] * .6 : c[0]; d[i * 4 + 1] = edge ? c[1] * .6 : c[1]; d[i * 4 + 2] = edge ? c[2] * .6 : c[2];
    d[i * 4 + 3] = edge ? 255 : 170;
  }
  octx.putImageData(img, 0, 0); dirty = false;
}
function resize() { cv.width = innerWidth; cv.height = innerHeight; }
function fit() { cam.z = Math.min(cv.width / W, cv.height / H); cam.x = (cv.width - W * cam.z) / 2; cam.y = (cv.height - H * cam.z) / 2; }
function render() {
  if (dirty) drawOwners();
  ctx.fillStyle = '#0b2a4a'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(cam.z, cam.z);
  ctx.drawImage(terrain, 0, 0, W, H);
  // smooth territory: blur the low-res ownership layer (falls back to bilinear scaling)
  if ('filter' in ctx) ctx.filter = 'blur(' + (0.6 * 1) + 'px)';
  ctx.drawImage(terr, 0, 0, W, H);
  ctx.filter = 'none';
  for (let i = 0; i < N; i++) if (building[i]) {
    const x = i % W + .5, y = ((i / W) | 0) + .5;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = .2;
    ctx.beginPath();
    if (building[i] === 1) ctx.rect(x - 1, y - 1, 2, 2); else { ctx.moveTo(x, y - 1.2); ctx.lineTo(x + 1.1, y + 1); ctx.lineTo(x - 1.1, y + 1); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
  }
  for (const ship of ships) {
    const attack = navalAttacks.find(a => a.ship === ship);
    const dockX = ship.dock % W + .5, dockY = ((ship.dock / W) | 0) + .5;
    const x = attack ? dockX + (attack.target % W + .5 - dockX) * attack.progress / attack.duration : dockX;
    const y = attack ? dockY + (((attack.target / W) | 0) + .5 - dockY) * attack.progress / attack.duration : dockY;
    ctx.save(); ctx.translate(x, y); ctx.scale(1.2, 1.2);
    ctx.fillStyle = '#f4f4e8'; ctx.strokeStyle = '#14324a'; ctx.lineWidth = .2;
    ctx.beginPath(); ctx.moveTo(-.9, .1); ctx.lineTo(.9, .1); ctx.lineTo(.55, .55); ctx.lineTo(-.55, .55); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-.05, -.9); ctx.lineTo(-.05, .05); ctx.lineTo(.62, .05); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  for (const p of players) if (p && p.alive && p.tiles > 20) { // labels at centroid
    if (p.cx === undefined || tick % 20 === 0) { let sx = 0, sy = 0, c = 0; for (let i = 0; i < N; i++) if (owner[i] === p.id) { sx += i % W; sy += (i / W) | 0; c++; } p.cx = sx / c; p.cy = sy / c; }
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = .4; ctx.font = 'bold ' + Math.min(6, 2 + Math.sqrt(p.tiles) / 6) + 'px sans-serif'; ctx.textAlign = 'center';
    ctx.strokeText(p.name + ' ' + Math.floor(p.troops), p.cx, p.cy); ctx.fillText(p.name + ' ' + Math.floor(p.troops), p.cx, p.cy);
  }
  ctx.restore();
  requestAnimationFrame(render);
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
function updateHud() {
  const me = players[HUMAN];
  const fleet = ships.filter(s => s.p === HUMAN).length, sailing = navalAttacks.filter(a => a.p === HUMAN).length;
  $('stats').textContent = 'Troops ' + Math.floor(me.troops) + '/' + cap(me, me.cities || 0) + ' · Gold ' + Math.floor(me.gold) + ' · Land ' + me.tiles + ' · Cities ' + (me.cities || 0) + ' · Ports ' + (me.ports || 0) + ' · Ships ' + fleet + (sailing ? ' (' + sailing + ' sailing)' : '');
  $('bCity').disabled = me.gold < COST.city; $('bPort').disabled = me.gold < COST.port;
  $('bShip').disabled = me.gold < COST.ship || fleet >= 8;
  $('board').innerHTML = '<b>Leaderboard</b><br>' + players.filter(p => p && p.alive).sort((a, b) => b.tiles - a.tiles).slice(0, 8)
    .map(p => '<span style="color:rgb(' + p.color + ')">■</span> ' + p.name + ' ' + p.tiles).join('<br>');
}
function showToast(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
function toTile(e) { return { x: Math.floor((e.offsetX - cam.x) / cam.z), y: Math.floor((e.offsetY - cam.y) / cam.z) }; }
let drag = null;
cv.onmousedown = e => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; };
cv.onmousemove = e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { cam.x = drag.cx + dx; cam.y = drag.cy + dy; } };
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
    const type = mode === 'city' ? 1 : 2;
    if (tryBuild(HUMAN, type, i)) { showToast(type === 1 ? 'City built: troop growth increased.' : 'Port built: gold income increased.'); setMode(null); }
    else if (owner[i] !== HUMAN) showToast('Buildings can only be placed on your own territory.');
    else if (building[i]) showToast('That territory already has a building.');
    else if (type === 2 && !isCoast(i)) showToast('Ports must be placed on the coast.');
    else showToast('Not enough gold to build here.');
    return;
  }
  if (!land[i]) return;
  if (owner[i] === HUMAN) return;
  if (canReach(HUMAN, i)) startAttack(HUMAN, owner[i], $('pct').value / 100);
  else if (isCoast(i)) startNavalAttack(HUMAN, i, $('pct').value / 100);
  else showToast('That territory is out of reach. Build a ship to strike the coast.');
};
cv.onwheel = e => { e.preventDefault(); const k = e.deltaY < 0 ? 1.15 : 1 / 1.15, nz = Math.max(2, Math.min(40, cam.z * k));
  cam.x = e.offsetX - (e.offsetX - cam.x) * nz / cam.z; cam.y = e.offsetY - (e.offsetY - cam.y) * nz / cam.z; cam.z = nz; };
function setMode(m) {
  mode = mode === m ? null : m;
  $('bCity').classList.toggle('on', mode === 'city'); $('bPort').classList.toggle('on', mode === 'port'); $('bShip').classList.toggle('on', mode === 'ship');
  $('help').textContent = mode === 'city' ? 'City mode: click your empty land to build.' : mode === 'port' ? 'Port mode: click empty coastal land to build.' : mode === 'ship' ? 'Ship mode: click one of your ports to commission a ship.' : 'Click land to attack · Build on your territory · Build ships at ports';
}
$('bCity').onclick = () => setMode('city'); $('bPort').onclick = () => setMode('port'); $('bShip').onclick = () => setMode('ship');
$('bCancel').onclick = () => { const me = players[HUMAN]; attacks = attacks.filter(a => { if (a.p === HUMAN) { me.troops += a.troops * .8; return false; } return true; }); };
$('pct').oninput = () => $('pctv').textContent = $('pct').value + '%';
$('cCity').textContent = COST.city; $('cPort').textContent = COST.port; $('cShip').textContent = COST.ship;
function showMenu() {
  paused = true; $('menu').hidden = false; $('menuStart').hidden = started; $('menuResume').hidden = !started;
}
function beginGame(reset) {
  if (reset) newGame();
  started = true; paused = false; $('menu').hidden = true; $('msg').hidden = true; updateHud(); setMode(null);
}
$('menuStart').onclick = () => beginGame(false);
$('menuResume').onclick = () => { paused = false; $('menu').hidden = true; };
$('menuNew').onclick = () => beginGame(true);
$('bMenu').onclick = showMenu;
addEventListener('keydown', e => { if (e.key === 'Escape' && started && !over) showMenu(); });
addEventListener('resize', () => { resize(); fit(); });

genMap(); newGame(); drawTerrain(); resize(); fit(); updateHud();
setInterval(step, TICK); requestAnimationFrame(render);
