/* ============================================================
   Cashcoil — the island.
   A hand-laid, seeded open world: nine regions around a central
   Nest, ringed by ocean. Everything here is deterministic, so the
   map is the same on every device and every boot.
   ============================================================ */

export const HALF = 6000;             // world spans [-HALF, HALF]
export const SCALE = 10;              // world units per baked texel
export const N = (2 * HALF / SCALE) | 0;
export const ISLAND_R = 5000;
export const T_LAND = 0, T_SHALLOW = 1, T_DEEP = 2, T_LAVA = 3;
const TAU = Math.PI * 2;

/* w = Voronoi weight (bigger = larger region) */
export const REGIONS = [
  { key:'nest',   name:'The Nest',         x:0,     y:0,     w:.72, a:[20,44,36], b:[30,60,48], icon:'◎',
    food:{ hues:[150,172,96,52,196], v:[1.5,3.5], d:1.3 }, weather:'pollen',
    desc:'Where every coil begins. Calm, crowded, cheap food.' },
  { key:'tundra', name:'Frostbite Tundra', x:0,     y:-3500, w:1,   a:[32,52,76], b:[54,80,108], icon:'❄',
    food:{ hues:[190,200,210], v:[3,6], d:.9 }, weather:'snow',
    desc:'Ice under your belly — turns drift wide. Frost orbs are fat.' },
  { key:'caves',  name:'Crystal Caves',    x:2550,  y:-2550, w:1,   a:[22,14,40], b:[34,22,60], icon:'◆',
    food:{ hues:[280,300,190], v:[2,4], d:.95 }, weather:'sparkle',
    desc:'Pitch dark. Crystals glow — and so do the eyes watching you.' },
  { key:'neon',   name:'Neon Strip',       x:3550,  y:0,     w:1,   a:[14,14,32], b:[22,18,46], icon:'★',
    food:{ hues:[320,190,52], v:[2,4], d:1.1 }, weather:'glint',
    desc:'Speed rails and jackpot machines. Bright lights, big bank.' },
  { key:'magma',  name:'Magma Wastes',     x:2550,  y:2550,  w:1,   a:[42,17,12], b:[60,24,14], icon:'▲',
    food:{ hues:[12,24,36], v:[4,7], d:.85 }, weather:'embers',
    desc:'Lava kills. Geysers spit ember orbs worth the risk.' },
  { key:'ruins',  name:'Sunken Ruins',     x:0,     y:3550,  w:1,   a:[48,42,28], b:[64,56,36], icon:'⬡',
    food:{ hues:[44,52,34], v:[2,4], d:1 }, weather:'dust',
    desc:'The Vault opens every few minutes. Everyone comes running.' },
  { key:'wild',   name:'Wildwood',         x:-2550, y:2550,  w:1,   a:[12,36,18], b:[22,52,26], icon:'♣',
    food:{ hues:[96,120,60], v:[2,4.5], d:1.1 }, weather:'fireflies',
    desc:'Hide under the canopy. Ambush from the leaves.' },
  { key:'marsh',  name:'Mirewater Marsh',  x:-3550, y:0,     w:1,   a:[16,40,40], b:[24,54,50], icon:'≈',
    food:{ hues:[172,160,196], v:[2,4], d:1 }, weather:'rain',
    desc:'Shallow water slows you down. Fish orbs swim away.' },
  { key:'desert', name:'Bone Desert',      x:-2550, y:-2550, w:1,   a:[64,50,28], b:[82,64,36], icon:'☠',
    food:{ hues:[34,44,12], v:[3,5], d:.8 }, weather:'sand',
    desc:'Something huge moves under the sand.' },
];
export const REG = Object.fromEntries(REGIONS.map((r, i) => [r.key, Object.assign(r, { idx: i })]));

/* ============================================================
   Noise + seeded random
   ============================================================ */
const SEED = 7331;
function hash2(x, y){
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(SEED, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y){
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 3){
  let s = 0, a = .5, f = 1, n = 0;
  for (let i = 0; i < oct; i++){ s += a * vnoise(x * f, y * f); n += a; a *= .5; f *= 2.03; }
  return s / n;
}
function mulberry(seed){
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   Lookups
   ============================================================ */
let flags = null;                          // per texel: terrain << 4 | region
const COAST = new Float32Array(1024);
function coastAt(x, y){
  const k = ((Math.atan2(y, x) / TAU + 1) % 1) * 1024, i = k | 0, f = k - i;
  return COAST[i] * (1 - f) + COAST[(i + 1) & 1023] * f;
}
function texel(x, y){
  const px = ((x + HALF) / SCALE) | 0, py = ((y + HALF) / SCALE) | 0;
  if (px < 0 || py < 0 || px >= N || py >= N) return T_DEEP << 4;
  return flags[py * N + px];
}
export const terrainAt = (x, y) => texel(x, y) >> 4;
export const regionAt  = (x, y) => REGIONS[texel(x, y) & 15] || REGIONS[0];

function distSeg(px, py, x1, y1, x2, y2){
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
  let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
export function roadDist(x, y){
  let m = Infinity;
  for (const r of world.roads) m = Math.min(m, distSeg(x, y, r.x1, r.y1, r.x2, r.y2));
  return m;
}
export const onRoad = (x, y) => roadDist(x, y) < 42;

/* static spatial hash for things that never move */
class Grid {
  constructor(cell){ this.cell = cell; this.cols = Math.ceil(2 * HALF / cell); this.c = new Map(); }
  key(x, y){ return (((y + HALF) / this.cell) | 0) * this.cols + (((x + HALF) / this.cell) | 0); }
  add(o){ const k = this.key(o.x, o.y); (this.c.get(k) || this.c.set(k, []).get(k)).push(o); }
  query(L, T, R, B, fn){
    const c = this.cell, x0 = ((L + HALF) / c) | 0, x1 = ((R + HALF) / c) | 0, y0 = ((T + HALF) / c) | 0, y1 = ((B + HALF) / c) | 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){
      const a = this.c.get(y * this.cols + x);
      if (a) for (const o of a) fn(o);
    }
  }
}

export const world = {
  bake: null, mini: null, grain: null,
  roads: [], pads: [], banks: [], portals: [], jackpots: [], chests: [], geysers: [], lava: [], rocks: [],
  vault: null, bossHome: REG.desert,
  gDecor: new Grid(500), gGlow: new Grid(500), gRocks: new Grid(400), gCanopy: new Grid(400),
};

export function nearestBank(x, y){
  let best = null, bd = Infinity;
  for (const b of world.banks){ const d = Math.hypot(b.x - x, b.y - y); if (d < bd){ bd = d; best = b; } }
  return { bank: best, dist: bd };
}
export function rockHit(x, y, r){
  let hit = null;
  world.gRocks.query(x - 200, y - 200, x + 200, y + 200, k => {
    const d = Math.hypot(k.x - x, k.y - y);
    if (d < k.r + r && (!hit || d - k.r < hit.d)) hit = { rock: k, d };
  });
  return hit;
}
export function canopyAt(x, y){
  let hit = false;
  world.gCanopy.query(x - 180, y - 180, x + 180, y + 180, c => { if (!hit && Math.hypot(c.x - x, c.y - y) < c.r * .8) hit = true; });
  return hit;
}
/** random point on dry, safe land; optionally inside one region */
export function randomLand(rand = Math.random, region = null, pad = 0){
  for (let i = 0; i < 200; i++){
    let x, y;
    if (region){ const a = rand() * TAU, d = Math.sqrt(rand()) * 1800; x = region.x + Math.cos(a) * d; y = region.y + Math.sin(a) * d; }
    else { const a = rand() * TAU, d = Math.sqrt(rand()) * (ISLAND_R - 200); x = Math.cos(a) * d; y = Math.sin(a) * d; }
    if (terrainAt(x, y) !== T_LAND) continue;
    if (region && regionAt(x, y) !== region) continue;
    if (pad && (rockHit(x, y, pad) || terrainAt(x + pad, y) !== T_LAND || terrainAt(x - pad, y) !== T_LAND
                || terrainAt(x, y + pad) !== T_LAND || terrainAt(x, y - pad) !== T_LAND)) continue;
    return { x, y };
  }
  return { x: 0, y: 0 };
}

/* ============================================================
   Build
   ============================================================ */
const lerp = (a, b, t) => a + (b - a) * t;

export function buildWorld(){
  const t0 = performance.now();
  for (let i = 0; i < 1024; i++){
    const a = i / 1024 * TAU;
    COAST[i] = ISLAND_R + (fbm(Math.cos(a) * 2.2 + 5, Math.sin(a) * 2.2 + 5, 4) - .5) * 1500;
  }
  flags = new Uint8Array(N * N);
  const bake = document.createElement('canvas');
  bake.width = bake.height = N;
  const g = bake.getContext('2d');
  const img = g.createImageData(N, N), d = img.data;
  const RN = REGIONS.length;

  for (let py = 0; py < N; py++){
    const y = py * SCALE - HALF + SCALE / 2;
    for (let px = 0; px < N; px++){
      const x = px * SCALE - HALF + SCALE / 2;
      const i = py * N + px, o = i * 4;

      // warped weighted voronoi → region
      const wx = x + (fbm(x * .00035 + 11, y * .00035 + 3, 2) - .5) * 1300;
      const wy = y + (fbm(x * .00035 + 71, y * .00035 + 29, 2) - .5) * 1300;
      let d1 = Infinity, d2 = Infinity, reg = 0;
      for (let k = 0; k < RN; k++){
        const R = REGIONS[k], dd = Math.hypot(wx - R.x, wy - R.y) / R.w;
        if (dd < d1){ d2 = d1; d1 = dd; reg = k; } else if (dd < d2) d2 = dd;
      }

      const r = Math.hypot(x, y), c = coastAt(x, y);
      const grain = 1 + (hash2(px, py) - .5) * .12;
      let cr, cg, cb, ter = T_LAND;

      if (r > c + 340){
        ter = T_DEEP;
        const k = fbm(x * .0012, y * .0012, 2), depth = Math.min(1, (r - c - 340) / 600);
        cr = 6 + k * 6; cg = 22 + k * 14 - depth * 6; cb = 40 + k * 18 - depth * 10;
      } else if (r > c){
        ter = T_SHALLOW;
        const k = (r - c) / 340;
        cr = lerp(20, 8, k); cg = lerp(70, 34, k); cb = lerp(84, 54, k);
      } else {
        const R = REGIONS[reg];
        const t = fbm(x * .0011, y * .0011, 3);
        cr = lerp(R.a[0], R.b[0], t); cg = lerp(R.a[1], R.b[1], t); cb = lerp(R.a[2], R.b[2], t);
        switch (R.key){
          case 'tundra': { const n = fbm(x * .0009 + 40, y * .0009 + 9, 2); if (n > .6){ const k = Math.min(1, (n - .6) * 8); cr = lerp(cr, 96, k); cg = lerp(cg, 130, k); cb = lerp(cb, 160, k); } break; }
          case 'marsh': { const n = fbm(x * .0016 + 17, y * .0016 + 5, 3); if (n > .57){ ter = T_SHALLOW; cr = 18; cg = 60 + n * 10; cb = 64 + n * 12; } break; }
          case 'desert': { const s = Math.sin((x * .7 + y) * .011 + fbm(x * .0007, y * .0007, 2) * 9) * .09; cr *= 1 + s; cg *= 1 + s; cb *= 1 + s; break; }
          case 'magma': { const n = Math.abs(fbm(x * .0014 + 3, y * .0014 + 8, 3) - .5); if (n < .018){ cr = 120; cg = 38; cb = 16; } break; }
          case 'neon': { if ((((x % 420) + 420) % 420) < 14 || (((y % 420) + 420) % 420) < 14){ cr = 46; cg = 26; cb = 78; } break; }
          case 'ruins': { if (((((x / 240) | 0) + ((y / 240) | 0)) & 1) === 0){ cr *= 1.07; cg *= 1.07; cb *= 1.05; } break; }
          case 'caves': { const n = fbm(x * .002 + 1, y * .002 + 2, 2); cr *= .8 + n * .5; cg *= .8 + n * .5; cb *= .8 + n * .5; break; }
        }
        // seams between regions
        if (d2 - d1 < 70){ const k = 1 - (d2 - d1) / 70; cr *= 1 - .28 * k; cg *= 1 - .28 * k; cb *= 1 - .28 * k; }
        // beach
        if (r > c - 150){ const k = (r - (c - 150)) / 150; cr = lerp(cr, 86, k); cg = lerp(cg, 76, k); cb = lerp(cb, 52, k); }
      }
      d[o] = cr * grain; d[o + 1] = cg * grain; d[o + 2] = cb * grain; d[o + 3] = 255;
      flags[i] = ter << 4 | reg;
    }
  }
  g.putImageData(img, 0, 0);
  world.bake = bake;

  const rnd = mulberry(SEED);
  buildRoads(g);
  buildLandmarks(rnd, g);
  buildScatter(rnd);
  world.mini = makeMini();
  world.grain = makeGrain();
  world.buildMs = Math.round(performance.now() - t0);
}

/* ---------- roads + speed pads ---------- */
function buildRoads(g){
  const toTex = v => (v + HALF) / SCALE;
  for (const R of REGIONS){
    if (R.key === 'nest') continue;
    const px = -R.y, py = R.x, l = Math.hypot(px, py) || 1;
    const off = (hash2(R.x, R.y) - .5) * 1100;
    const pts = [{ x: 0, y: 0 },
                 { x: R.x * .45 + px / l * off, y: R.y * .45 + py / l * off },
                 { x: R.x * .85, y: R.y * .85 }];
    for (let i = 0; i < pts.length - 1; i++) world.roads.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of [[9, 'rgba(0,0,0,.22)'], [7, 'rgba(210,220,255,.10)'], [1, 'rgba(255,255,255,.16)']]){
    g.lineWidth = pass[0]; g.strokeStyle = pass[1];
    if (pass[0] === 1) g.setLineDash([6, 8]);
    g.beginPath();
    for (const r of world.roads){ g.moveTo(toTex(r.x1), toTex(r.y1)); g.lineTo(toTex(r.x2), toTex(r.y2)); }
    g.stroke(); g.setLineDash([]);
  }
  for (const r of world.roads){
    const len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1), a = Math.atan2(r.y2 - r.y1, r.x2 - r.x1);
    for (let s = 420; s < len - 200; s += 640){
      const x = r.x1 + Math.cos(a) * s, y = r.y1 + Math.sin(a) * s;
      if (Math.hypot(x, y) < 600 || terrainAt(x, y) !== T_LAND) continue;
      world.pads.push({ x, y, a, r: 46 });
    }
  }
}

/* ---------- landmarks ---------- */
function snap(p, pad = 120){
  for (let k = 0; k < 40; k++){
    const x = p.x * (1 - k * .02), y = p.y * (1 - k * .02);
    if (terrainAt(x, y) === T_LAND && terrainAt(x + pad, y) === T_LAND && terrainAt(x - pad, y) === T_LAND
        && terrainAt(x, y + pad) === T_LAND && terrainAt(x, y - pad) === T_LAND) return { x, y };
  }
  return p;
}
const blockers = [];
const free = (x, y, r) => blockers.every(b => Math.hypot(b.x - x, b.y - y) > b.r + r);

function buildLandmarks(rnd, g){
  const toTex = v => (v + HALF) / SCALE;

  // the Vault + its ring of pillars
  const v = snap({ x: 0, y: 3500 }, 400);
  world.vault = { x: v.x, y: v.y, r: 240, state: 'closed', t: 70, name: 'The Vault' };
  blockers.push({ x: v.x, y: v.y, r: 420 });
  g.fillStyle = 'rgba(120,104,70,.55)';
  g.beginPath(); g.arc(toTex(v.x), toTex(v.y), 38, 0, TAU); g.fill();
  for (let i = 0; i < 10; i++){
    const a = i / 10 * TAU + .15;
    addRock(v.x + Math.cos(a) * 360, v.y + Math.sin(a) * 360, 38, 'pillar');
  }

  [['Neon Bank', 3100, 450], ['Glacier Bank', -450, -3050], ['Dockside Bank', -3050, -550],
   ['Old Bank', 650, 3000], ['Bone Bank', -2050, -2150]].forEach(([name, x, y]) => {
    const p = snap({ x, y }, 200);
    world.banks.push({ name, x: p.x, y: p.y, r: 165 });
    blockers.push({ x: p.x, y: p.y, r: 260 });
  });

  [[{ x: -700, y: -3700 }, { x: 2800, y: 3000 }, 190],
   [{ x: -3800, y: 500 }, { x: 3850, y: -500 }, 300],
   [{ x: -2800, y: 2250 }, { x: 2350, y: -2850 }, 100]].forEach(([a, b, hue]) => {
    const A = snap(a, 160), B = snap(b, 160);
    const pa = { x: A.x, y: A.y, r: 72, hue }, pb = { x: B.x, y: B.y, r: 72, hue };
    pa.to = pb; pb.to = pa;
    pa.region = regionAt(B.x, B.y).name; pb.region = regionAt(A.x, A.y).name;
    world.portals.push(pa, pb);
    blockers.push({ x: A.x, y: A.y, r: 200 }, { x: B.x, y: B.y, r: 200 });
  });

  const n = REG.neon;
  [[-280, -330], [300, -300], [-300, 320], [280, 340]].forEach(([dx, dy]) => {
    const p = snap({ x: n.x + dx, y: n.y + dy }, 80);
    world.jackpots.push({ x: p.x, y: p.y, cd: 0, spin: 0, reels: [0, 1, 2] });
    blockers.push({ x: p.x, y: p.y, r: 110 });
  });

  // lava pools (painted into terrain so everything can see them)
  const m = REG.magma;
  for (let tries = 0; world.lava.length < 16 && tries < 600; tries++){
    const a = rnd() * TAU, dd = Math.sqrt(rnd()) * 1700;
    const x = m.x + Math.cos(a) * dd, y = m.y + Math.sin(a) * dd, r = 90 + rnd() * 150;
    if (regionAt(x, y) !== m || terrainAt(x, y) !== T_LAND || roadDist(x, y) < r + 160 || !free(x, y, r + 80)) continue;
    addLava(x, y, r, rnd, g);
    blockers.push({ x, y, r });
  }
  for (let tries = 0; world.geysers.length < 7 && tries < 400; tries++){
    const p = randomLand(rnd, m, 60);
    if (!free(p.x, p.y, 120)) continue;
    world.geysers.push({ x: p.x, y: p.y, t: 6 + rnd() * 20, warn: 0 });
    blockers.push({ x: p.x, y: p.y, r: 60 });
  }

  // coil chests
  const CH = { nest: [4, 0], tundra: [4, 1], caves: [6, 2], neon: [3, 1], magma: [4, 1], ruins: [7, 2], wild: [4, 0], marsh: [3, 0], desert: [4, 1] };
  for (const [key, [count, tier]] of Object.entries(CH)){
    let placed = 0;
    for (let tries = 0; placed < count && tries < 400; tries++){
      const p = randomLand(rnd, REG[key], 80);
      if (!free(p.x, p.y, 160) || roadDist(p.x, p.y) < 90) continue;
      const t = tier === 2 ? (rnd() < .45 ? 2 : 1) : tier === 1 ? (rnd() < .5 ? 1 : 0) : 0;
      world.chests.push({ x: p.x, y: p.y, r: 24, tier: t, open: false, respawn: 0, coil: 0 });
      blockers.push({ x: p.x, y: p.y, r: 60 });
      placed++;
    }
  }
}

function addRock(x, y, r, kind){
  const k = { x, y, r, kind, rot: hash2(x, y) * TAU };
  world.rocks.push(k); world.gRocks.add(k);
  blockers.push({ x, y, r: r + 30 });
  return k;
}

function addLava(x, y, r, rnd, g){
  const pts = [];
  for (let i = 0; i < 18; i++){
    const a = i / 18 * TAU, rr = r * (.8 + rnd() * .35);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  const outer = new Path2D(), inner = new Path2D();
  pts.forEach(([px, py], i) => { i ? outer.lineTo(px, py) : outer.moveTo(px, py); });
  outer.closePath();
  pts.forEach(([px, py], i) => { const ix = x + (px - x) * .7, iy = y + (py - y) * .7; i ? inner.lineTo(ix, iy) : inner.moveTo(ix, iy); });
  inner.closePath();
  world.lava.push({ x, y, r, outer, inner, ph: rnd() * TAU });

  // bake a dark scorch + mark texels as lava
  const toTex = v => (v + HALF) / SCALE;
  g.fillStyle = 'rgba(20,4,2,.9)';
  g.beginPath(); pts.forEach(([px, py], i) => { const X = toTex(px), Y = toTex(py); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fill();
  const x0 = ((x - r * 1.2 + HALF) / SCALE) | 0, x1 = ((x + r * 1.2 + HALF) / SCALE) | 0;
  const y0 = ((y - r * 1.2 + HALF) / SCALE) | 0, y1 = ((y + r * 1.2 + HALF) / SCALE) | 0;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++){
    const wx = tx * SCALE - HALF + SCALE / 2, wy = ty * SCALE - HALF + SCALE / 2;
    const a = Math.atan2(wy - y, wx - x), k = ((a / TAU + 1) % 1) * 18, i0 = k | 0, f = k - i0;
    const p0 = pts[i0 % 18], p1 = pts[(i0 + 1) % 18];
    const rr = Math.hypot(p0[0] - x, p0[1] - y) * (1 - f) + Math.hypot(p1[0] - x, p1[1] - y) * f;
    if (Math.hypot(wx - x, wy - y) < rr * .9) flags[ty * N + tx] = T_LAVA << 4 | (flags[ty * N + tx] & 15);
  }
}

/* ---------- decor, rocks, canopy ---------- */
function buildScatter(rnd){
  const put = (key, kind, n, smin, smax, glow = false) => {
    for (let i = 0; i < n; i++){
      const p = randomLand(rnd, REG[key]);
      if (roadDist(p.x, p.y) < 50) continue;
      const o = { x: p.x, y: p.y, kind, s: smin + rnd() * (smax - smin), rot: rnd() * TAU, ph: rnd() * TAU };
      (glow ? world.gGlow : world.gDecor).add(o);
    }
  };
  const rocks = (key, kind, n, rmin, rmax) => {
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 30; tries++){
      const p = randomLand(rnd, REG[key]), r = rmin + rnd() * (rmax - rmin);
      if (!free(p.x, p.y, r + 60) || roadDist(p.x, p.y) < r + 90) continue;
      addRock(p.x, p.y, r, kind); placed++;
    }
  };

  put('nest', 'grass', 130, 26, 44); put('nest', 'flower', 70, 14, 22);
  rocks('nest', 'boulder', 5, 34, 56);
  put('tundra', 'pine', 90, 50, 90); put('tundra', 'shard', 40, 26, 44);
  rocks('tundra', 'ice', 14, 40, 80);
  put('caves', 'crystal', 110, 24, 50, true); put('caves', 'shroom', 40, 16, 28, true);
  rocks('caves', 'crystalRock', 16, 40, 70);
  put('neon', 'neonRing', 45, 40, 80, true); put('neon', 'neonBar', 35, 50, 90, true);
  put('magma', 'obsidian', 60, 26, 50); put('magma', 'ember', 50, 30, 60, true);
  rocks('magma', 'obsidianRock', 8, 40, 70);
  put('ruins', 'rubble', 90, 22, 44);
  rocks('ruins', 'pillar', 16, 30, 44);
  put('wild', 'fern', 110, 30, 56);
  put('marsh', 'reed', 110, 24, 40); put('marsh', 'lily', 70, 18, 30);
  put('desert', 'bones', 30, 44, 80); put('desert', 'ripple', 70, 60, 110);
  rocks('desert', 'boulder', 16, 40, 80);

  // Wildwood canopy — drawn above snakes, hides whoever's underneath
  for (let tries = 0, placed = 0; placed < 70 && tries < 2000; tries++){
    const p = randomLand(rnd, REG.wild), r = 80 + rnd() * 90;
    if (roadDist(p.x, p.y) < r * .6 || !free(p.x, p.y, 10)) continue;
    world.gCanopy.add({ x: p.x, y: p.y, r, rot: rnd() * TAU, hue: 100 + rnd() * 40 });
    placed++;
  }
}

function makeMini(){
  const c = document.createElement('canvas'); c.width = c.height = 240;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.drawImage(world.bake, 0, 0, 240, 240);
  return c;
}
function makeGrain(){
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 700; i++){
    g.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.09)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  return c;
}

/* ============================================================
   Sprites (drawn once, stamped many times)
   ============================================================ */
const sprites = new Map();
function sprite(kind){
  let c = sprites.get(kind);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  const circ = (x, y, r, f) => { g.fillStyle = f; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const glow = (col, r = 60) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-64, -64, 128, 128); };
  switch (kind){
    case 'grass':
      g.strokeStyle = 'rgba(90,190,120,.55)'; g.lineWidth = 4; g.lineCap = 'round';
      for (let i = 0; i < 7; i++){ const a = -Math.PI / 2 + (i - 3) * .28; g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(Math.cos(a) * 20, 0, Math.cos(a) * 34, Math.sin(a) * 44 + 20); g.stroke(); }
      break;
    case 'flower':
      for (let i = 0; i < 5; i++){ const a = i / 5 * TAU; circ(Math.cos(a) * 18, Math.sin(a) * 18, 16, 'rgba(255,170,200,.75)'); }
      circ(0, 0, 13, '#ffd76a'); break;
    case 'pine':
      circ(6, 8, 56, 'rgba(0,0,0,.25)');
      circ(0, 0, 54, '#1f4a52'); circ(-4, -4, 40, '#2e6670'); circ(-8, -8, 24, '#d8eef7'); circ(-10, -10, 12, '#ffffff'); break;
    case 'shard':
      g.fillStyle = 'rgba(190,235,255,.7)';
      g.beginPath(); g.moveTo(0, -56); g.lineTo(22, 10); g.lineTo(0, 50); g.lineTo(-18, 6); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(0, -56); g.lineTo(6, 8); g.lineTo(-18, 6); g.closePath(); g.fill(); break;
    case 'crystal':
      glow('rgba(120,90,255,.45)');
      for (const [a, l, col] of [[-.5, 52, '#b58cff'], [.3, 44, '#5fe3ff'], [-1.4, 36, '#ff7ae0'], [1.2, 30, '#b58cff']]){
        g.save(); g.rotate(a); g.fillStyle = col;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-9, -l * .7); g.lineTo(0, -l); g.lineTo(9, -l * .7); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -l); g.lineTo(9, -l * .7); g.closePath(); g.fill();
        g.restore();
      }
      break;
    case 'shroom':
      glow('rgba(80,255,200,.4)', 50); circ(0, 0, 26, '#2fd6a0'); circ(-6, -6, 8, '#c8fff0'); circ(10, 4, 5, '#c8fff0'); break;
    case 'neonRing':
      glow('rgba(255,60,200,.25)');
      g.strokeStyle = '#ff4fd8'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.stroke(); break;
    case 'neonBar':
      glow('rgba(60,220,255,.25)');
      g.strokeStyle = '#38e1ff'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(-48, 0); g.lineTo(48, 0); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-48, 0); g.lineTo(48, 0); g.stroke(); break;
    case 'obsidian':
      g.fillStyle = '#140a10';
      for (let i = 0; i < 4; i++){ g.save(); g.rotate(i * 1.6); g.beginPath(); g.moveTo(-10, 0); g.lineTo(0, -50); g.lineTo(10, 0); g.closePath(); g.fill(); g.restore(); }
      circ(0, 0, 14, '#2a1420'); break;
    case 'ember':
      glow('rgba(255,110,30,.4)');
      g.strokeStyle = '#ff8a2a'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-44, -10); g.lineTo(-14, 6); g.lineTo(8, -8); g.lineTo(40, 12); g.moveTo(-14, 6); g.lineTo(-8, 34); g.stroke(); break;
    case 'rubble':
      for (const [x, y, w, h] of [[-24, -10, 30, 22], [4, -22, 26, 18], [0, 8, 34, 24]]){
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 4, y + 4, w, h);
        g.fillStyle = '#8a7a58'; g.fillRect(x, y, w, h); g.fillStyle = '#a8966c'; g.fillRect(x, y, w, 6);
      }
      break;
    case 'fern':
      g.strokeStyle = '#3f9a4a'; g.lineWidth = 6; g.lineCap = 'round';
      for (let i = 0; i < 6; i++){ const a = i / 6 * TAU; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + .4) * 30, Math.sin(a + .4) * 30, Math.cos(a) * 54, Math.sin(a) * 54); g.stroke(); }
      break;
    case 'reed':
      g.strokeStyle = '#6f8a4a'; g.lineWidth = 4; g.lineCap = 'round';
      for (let i = 0; i < 5; i++){ const x = (i - 2) * 9; g.beginPath(); g.moveTo(x, 40); g.lineTo(x + (i - 2) * 5, -40); g.stroke(); circ(x + (i - 2) * 5, -40, 5, '#8a5a2a'); }
      break;
    case 'lily':
      g.fillStyle = '#2f7a4a'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 44, .3, TAU - .1); g.closePath(); g.fill();
      circ(10, -8, 10, '#ffd0e8'); break;
    case 'bones':
      g.strokeStyle = '#e6dcc4'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-50, 0); g.lineTo(50, 0); g.stroke();
      for (let i = -3; i <= 3; i++){ g.beginPath(); g.moveTo(i * 12, 0); g.quadraticCurveTo(i * 12 + 14, -22, i * 12 + 4, -38); g.moveTo(i * 12, 0); g.quadraticCurveTo(i * 12 + 14, 22, i * 12 + 4, 38); g.stroke(); }
      circ(54, 0, 12, '#e6dcc4'); break;
    case 'ripple':
      g.strokeStyle = 'rgba(255,230,180,.16)'; g.lineWidth = 4;
      for (let i = 0; i < 3; i++){ g.beginPath(); g.moveTo(-56, i * 16 - 16); g.quadraticCurveTo(0, i * 16 - 34, 56, i * 16 - 16); g.stroke(); }
      break;
  }
  sprites.set(kind, c);
  return c;
}

/* ============================================================
   Drawing
   ============================================================ */
export function drawGround(ctx, L, T, R, B){
  ctx.fillStyle = '#061626';
  ctx.fillRect(L, T, R - L, B - T);
  let sx = (L + HALF) / SCALE, sy = (T + HALF) / SCALE, sw = (R - L) / SCALE, sh = (B - T) / SCALE;
  let dx = L, dy = T, dw = R - L, dh = B - T;
  if (sx < 0){ dx -= sx * SCALE; dw += sx * SCALE; sw += sx; sx = 0; }
  if (sy < 0){ dy -= sy * SCALE; dh += sy * SCALE; sh += sy; sy = 0; }
  if (sx + sw > N){ const e = sx + sw - N; sw -= e; dw -= e * SCALE; }
  if (sy + sh > N){ const e = sy + sh - N; sh -= e; dh -= e * SCALE; }
  if (sw > 0 && sh > 0){
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(world.bake, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  if (!world.grainPat){
    world.grainPat = ctx.createPattern(world.grain, 'repeat');
    try { world.grainPat.setTransform(new DOMMatrix().scale(2.4)); } catch {}
  }
  ctx.fillStyle = world.grainPat;
  ctx.fillRect(L, T, R - L, B - T);
}

export function drawDecor(ctx, L, T, R, B, t){
  world.gDecor.query(L - 120, T - 120, R + 120, B + 120, o => {
    const s = o.s * 2;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.kind === 'pine' || o.kind === 'reed' || o.kind === 'grass' ? 0 : o.rot);
    ctx.drawImage(sprite(o.kind), -s / 2, -s / 2, s, s);
    ctx.restore();
  });
  world.gRocks.query(L - 120, T - 120, R + 120, B + 120, k => drawRock(ctx, k));
  // speed pads
  for (const p of world.pads){
    if (p.x < L - 60 || p.x > R + 60 || p.y < T - 60 || p.y > B + 60) continue;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
    ctx.fillStyle = 'rgba(56,225,255,.08)'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++){
      const a = .25 + .75 * ((Math.sin(t * 8 - i * 1.1) + 1) / 2);
      ctx.strokeStyle = `rgba(56,225,255,${a})`; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const x = (i - 1) * 16;
      ctx.beginPath(); ctx.moveTo(x - 8, -16); ctx.lineTo(x + 8, 0); ctx.lineTo(x - 8, 16); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawRock(ctx, k){
  const { x, y, r } = k;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.arc(x + r * .18, y + r * .22, r, 0, TAU); ctx.fill();
  switch (k.kind){
    case 'pillar':
      ctx.fillStyle = '#6e6246'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9c8c64'; ctx.beginPath(); ctx.arc(x, y, r * .78, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++){ const a = k.rot + i / 6 * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * .78, y + Math.sin(a) * r * .78); ctx.stroke(); }
      break;
    case 'ice':
      ctx.fillStyle = '#7fb3d0'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c6e8f7'; ctx.beginPath(); ctx.arc(x - r * .2, y - r * .2, r * .62, 0, TAU); ctx.fill(); break;
    case 'obsidianRock':
      ctx.fillStyle = '#1a0e14'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,40,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * .7, k.rot, k.rot + 2); ctx.stroke(); break;
    case 'crystalRock': break;   // drawn in the glow pass
    default: {
      const R = regionAt(x, y);
      ctx.fillStyle = `rgb(${R.b[0] * 1.6 | 0},${R.b[1] * 1.6 | 0},${R.b[2] * 1.6 | 0})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,.12)`; ctx.beginPath(); ctx.arc(x - r * .25, y - r * .25, r * .55, 0, TAU); ctx.fill();
    }
  }
}

/* things that should stay visible at night / in the caves */
export function drawGlow(ctx, L, T, R, B, t){
  world.gGlow.query(L - 120, T - 120, R + 120, B + 120, o => {
    const s = o.s * 2 * (1 + Math.sin(t * 2 + o.ph) * .06);
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot);
    ctx.drawImage(sprite(o.kind), -s / 2, -s / 2, s, s);
    ctx.restore();
  });
  world.gRocks.query(L - 120, T - 120, R + 120, B + 120, k => {
    if (k.kind !== 'crystalRock') return;
    const s = k.r * 3.2;
    ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.rot);
    ctx.drawImage(sprite('crystal'), -s / 2, -s / 2, s, s);
    ctx.restore();
  });
  for (const p of world.lava){
    if (p.x + p.r < L || p.x - p.r > R || p.y + p.r < T || p.y - p.r > B) continue;
    ctx.strokeStyle = 'rgba(255,90,20,.18)'; ctx.lineWidth = 36; ctx.stroke(p.outer);
    ctx.fillStyle = '#b22a0c'; ctx.fill(p.outer);
    ctx.globalAlpha = .65 + .3 * Math.sin(t * 1.6 + p.ph);
    ctx.fillStyle = '#ff7a1a'; ctx.fill(p.inner);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++){
      const a = p.ph + i * 1.7 + t * .3, rr = p.r * .35 * Math.sin(t * .7 + i);
      const k = (Math.sin(t * 3 + i * 2 + p.ph) + 1) / 2;
      ctx.fillStyle = `rgba(255,220,120,${.35 + k * .4})`;
      ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 6 + k * 10, 0, TAU); ctx.fill();
    }
  }
}

export function drawCanopy(ctx, L, T, R, B, px, py){
  world.gCanopy.query(L - 200, T - 200, R + 200, B + 200, c => {
    const near = px !== null && Math.hypot(c.x - px, c.y - py) < c.r + 40;
    ctx.globalAlpha = near ? .35 : .93;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(c.x + 14, c.y + 18, c.r, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++){
      const a = c.rot + i / 5 * TAU, rr = c.r * .42;
      ctx.fillStyle = `hsl(${c.hue} 45% ${18 + i * 2}%)`;
      ctx.beginPath(); ctx.arc(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, c.r * .62, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = `hsl(${c.hue} 50% 30%)`; ctx.beginPath(); ctx.arc(c.x - c.r * .15, c.y - c.r * .15, c.r * .5, 0, TAU); ctx.fill();
    ctx.fillStyle = `hsla(${c.hue} 60% 50% / .25)`; ctx.beginPath(); ctx.arc(c.x - c.r * .25, c.y - c.r * .25, c.r * .25, 0, TAU); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* ============================================================
   Map rendering (minimap + full map)
   ============================================================ */
export function drawMap(ctx, size, opts = {}){
  const k = size / (2 * HALF), tx = v => (v + HALF) * k;
  ctx.drawImage(world.mini, 0, 0, size, size);
  const disc = opts.discovered;
  if (disc){
    // soft fog over undiscovered regions
    const F = 120, fog = document.createElement('canvas'); fog.width = fog.height = F;
    const fg = fog.getContext('2d'), img = fg.createImageData(F, F), st = N / F;
    for (let y = 0; y < F; y++) for (let x = 0; x < F; x++){
      const f = flags[((y * st) | 0) * N + ((x * st) | 0)];
      if ((f >> 4) !== T_DEEP && !disc.includes(REGIONS[f & 15].key)){ const o = (y * F + x) * 4; img.data[o] = 4; img.data[o + 1] = 6; img.data[o + 2] = 14; img.data[o + 3] = 225; }
    }
    fg.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fog, 0, 0, size, size);
  }
  if (opts.labels){
    ctx.textAlign = 'center';
    for (const R of REGIONS){
      const known = !disc || disc.includes(R.key);
      ctx.font = `700 ${Math.max(10, size / 42)}px "Space Grotesk",system-ui,sans-serif`;
      ctx.fillStyle = known ? 'rgba(255,255,255,.85)' : 'rgba(160,170,200,.5)';
      ctx.fillText(known ? R.name : '???', tx(R.x), tx(R.y));
    }
  }
  const dot = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(tx(x), tx(y), r, 0, TAU); ctx.fill(); };
  const s = size / 240;
  for (const b of world.banks){
    ctx.fillStyle = '#f7c14b'; const X = tx(b.x), Y = tx(b.y), r = 3.2 * s + 1;
    ctx.fillRect(X - r, Y - r, r * 2, r * 2);
    ctx.fillStyle = '#1a1204'; ctx.fillRect(X - r * .35, Y - r * .6, r * .7, r * 1.2);
  }
  for (const p of world.portals) dot(p.x, p.y, 2.4 * s + .5, `hsl(${p.hue} 90% 65%)`);
  const v = world.vault;
  dot(v.x, v.y, (v.state === 'open' ? 4 : 3) * s + .5, v.state === 'open' ? '#5df2c0' : '#b8a878');
  if (opts.extra) opts.extra(tx, s);
}

/* ============================================================
   Weather — screen-space particles that follow your region
   ============================================================ */
const WX = [];
export function drawWeather(ctx, Wd, Hd, dt, kind, t){
  const target = { snow: 70, rain: 90, embers: 40, fireflies: 26, sand: 50, sparkle: 30, glint: 24, dust: 26, pollen: 20 }[kind] || 0;
  for (let i = WX.length - 1; i >= 0; i--){
    const p = WX[i];
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.age > p.life || p.x < -40 || p.x > Wd + 40 || p.y < -40 || p.y > Hd + 40 || p.kind !== kind) WX.splice(i, 1);
  }
  while (WX.length < target){
    const p = { kind, age: 0, x: Math.random() * Wd, y: Math.random() * Hd, vx: 0, vy: 0, life: 3 + Math.random() * 4, s: 1 + Math.random() * 2, ph: Math.random() * TAU };
    if (kind === 'snow'){ p.vx = -20 + Math.random() * 30; p.vy = 30 + Math.random() * 40; }
    if (kind === 'rain'){ p.vx = -60; p.vy = 520 + Math.random() * 200; p.life = .6; }
    if (kind === 'embers'){ p.vx = -10 + Math.random() * 20; p.vy = -30 - Math.random() * 50; }
    if (kind === 'sand' || kind === 'dust'){ p.vx = 120 + Math.random() * 120; p.vy = 10 + Math.random() * 20; p.life = 2; }
    if (kind === 'fireflies' || kind === 'sparkle' || kind === 'glint' || kind === 'pollen'){ p.vx = -8 + Math.random() * 16; p.vy = -8 + Math.random() * 16; }
    WX.push(p);
  }
  for (const p of WX){
    const fade = Math.min(1, p.age * 2, (p.life - p.age) * 2);
    switch (p.kind){
      case 'snow': ctx.fillStyle = `rgba(235,245,255,${.7 * fade})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 1.3, 0, TAU); ctx.fill(); break;
      case 'rain': ctx.strokeStyle = `rgba(160,200,230,${.35 * fade})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 6, p.y - 22); ctx.stroke(); break;
      case 'embers': ctx.fillStyle = `rgba(255,${120 + p.s * 40 | 0},40,${.8 * fade})`; ctx.fillRect(p.x, p.y, p.s * 1.5, p.s * 1.5); break;
      case 'sand': case 'dust': ctx.fillStyle = `rgba(230,200,150,${.3 * fade})`; ctx.fillRect(p.x, p.y, p.s * 4, 1.2); break;
      case 'fireflies': case 'pollen': {
        const k = (Math.sin(t * 4 + p.ph) + 1) / 2;
        ctx.fillStyle = p.kind === 'fireflies' ? `rgba(220,255,120,${(.2 + .7 * k) * fade})` : `rgba(255,250,210,${.35 * fade})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (p.kind === 'fireflies' ? 1.4 : 1), 0, TAU); ctx.fill(); break;
      }
      case 'sparkle': case 'glint': {
        const k = Math.max(0, Math.sin(t * 5 + p.ph));
        ctx.fillStyle = p.kind === 'sparkle' ? `rgba(200,160,255,${k * fade})` : `rgba(255,120,230,${k * .8 * fade})`;
        ctx.fillRect(p.x - p.s, p.y - .5, p.s * 2, 1); ctx.fillRect(p.x - .5, p.y - p.s, 1, p.s * 2); break;
      }
    }
  }
}
