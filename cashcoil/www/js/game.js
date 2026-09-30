/* ============================================================
   Cashcoil — open-world engine
   Money model (unchanged):
     • cash = stake coins. Enters only as a stake, leaves only through
              a BANK cash-out (95% to the player, 5% house). Never minted.
     • mass = free food. Length + sprint fuel. Worth nothing.
     • gems = XP only. The world's generosity (vault, chests, jackpots)
              pays in mass and gems — never in cash.
   ============================================================ */
import { TARGET_FOOD, BOT_COUNT, RAKE, CASHOUT_TIME, VAULT_CLOSED, VAULT_OPEN, DAY_LENGTH,
         BOT_NAMES, HUES, COMBO_WORDS } from './config.js';
import { world, REGIONS, REG, HALF, T_LAND, T_SHALLOW, T_DEEP, T_LAVA, buildWorld, terrainAt, regionAt,
         onRoad, rockHit, canopyAt, nearestBank, randomLand, drawGround, drawDecor, drawGlow, drawCanopy,
         drawWeather } from './world.js';
import { sfx, buzz } from './fx.js';

const TAU = Math.PI * 2;
export const rand  = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[(Math.random() * a.length) | 0];
const normAngle = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const fmt = v => Math.floor(Math.max(0, v)).toLocaleString('en-US');
export const meters = d => { const m = d / 10; return m >= 1000 ? (m / 1000).toFixed(1) + 'km' : Math.round(m) + 'm'; };

let cv, ctx, DPR = 1, W = 0, H = 0, vignette = null;

export const G = {
  state: 'menu',            // menu | playing | ending | over
  snakes: [], orbs: [], particles: [], floats: [],
  player: null, boss: null, king: null, run: null, result: null,
  cam: { x: 0, y: 0 }, zoom: .5, shake: 0, flash: 0, t: 0,
  input: { angle: null, boost: false, cash: false },
  cashT: 0, endT: 0, eventT: 45, event: null, danger: 0,
  bankIn: null, bankNear: null, bankDist: 0, night: 0, dark: 0, cavesF: 0, viewRegion: REGIONS[0],
  tableStake: 50, showChestTip: false,
  // journey (story) mode
  mode: 'arena', paused: false, objects: [], quest: null, bossAggro: false, forceJackpot: 0,
  huntPlayer: true, claimed: new Set(), ouro: null,
  hooks: {},
};

/* ============================================================
   Names + skins
   ============================================================ */
let namePool = [];
function nextBotName(){
  if (!namePool.length) namePool = [...BOT_NAMES].sort(() => Math.random() - .5);
  return namePool.pop();
}
function botSkin(){
  const h = pick(HUES), striped = Math.random() < .35;
  return {
    kind: striped ? 'stripe' : 'solid',
    a: `hsl(${h} 85% 60%)`,
    b: striped ? `hsl(${(h + 25) % 360} 70% 40%)` : `hsl(${h} 80% 54%)`,
    dark: `hsl(${h} 65% 24%)`, hue: h,
  };
}
const BOSS_SKIN = { kind: 'stripe', a: '#d2ae72', b: '#8f6d3c', dark: '#3a2912', hue: 36 };

export function segColor(sk, i, t){
  switch (sk.kind){
    case 'stripe':  return ((i / 3) | 0) % 2 ? sk.b : sk.a;
    case 'rainbow': return `hsl(${((i * 14 - t * 140) % 360 + 360) % 360} 92% 63%)`;
    case 'shine': {
      const k = ((i - t * 22) % 18 + 18) % 18;
      return k < 1.5 ? '#fff6d6' : k < 3 ? '#ffe08a' : i % 2 ? sk.a : sk.b;
    }
    default: return i % 2 ? sk.b : sk.a;
  }
}

/* ============================================================
   Snake
   ============================================================ */
class Snake {
  constructor(x, y, cash, name, skin, isPlayer){
    this.name = name; this.skin = skin; this.isPlayer = !!isPlayer;
    this.cash = cash; this.entry = cash; this.mass = 12;
    this.alive = true; this.shield = isPlayer ? 4 : 2;
    this.angle = rand(-Math.PI, Math.PI); this.targetAngle = this.angle;
    this.boosting = false; this.boostDrop = 0; this.slow = 1;
    this.thinkT = 0; this.dodge = Math.random() < .5 ? 1 : -1;
    this.aggr = Math.random(); this.prey = null; this.preyT = 0;
    this.padT = 0; this.portalCD = 0; this.envT = 0; this.road = false; this.hidden = false;
    this.ter = T_LAND; this.region = regionAt(x, y); this.bankT = 0;
    this.vaultFan = Math.random() < .55;
    this.path = []; this.segs = [];
    for (let i = 14; i >= 0; i--)
      this.path.push({ x: x - Math.cos(this.angle) * i * 3, y: y - Math.sin(this.angle) * i * 3 });
  }
  get value(){ return this.cash * 0.1 + this.mass * 0.35; }
  get radius(){ return this.bossR || 8 + 6.2 * Math.pow(this.value + 1, 0.30); }
  get length(){ return this.bossLen || this.radius * 9 + Math.min(this.value, 600) * 2.4; }
  head(){ return this.path[this.path.length - 1]; }
  speed(){
    if (this.isBoss) return this.phase === 'under' ? 185 : this.phase === 'rising' ? 25 : 116;
    return Math.max(96, 156 - this.radius * 0.42);
  }
  turnRate(){
    if (this.isBoss) return this.phase === 'under' ? 2.6 : 1.7;
    return Math.max(4.2, 8.2 - this.radius * 0.028);
  }

  update(dt){
    if (this.shield > 0) this.shield = Math.max(0, this.shield - dt);
    if (this.padT > 0) this.padT -= dt;
    if (this.portalCD > 0) this.portalCD -= dt;
    const h = this.head();

    this.ter = terrainAt(h.x, h.y);
    this.region = regionAt(h.x, h.y);
    this.envT -= dt;
    if (this.envT <= 0){
      this.envT = .22;
      this.road = onRoad(h.x, h.y);
      this.hidden = this.region.key === 'wild' && canopyAt(h.x, h.y);
    }
    const icy = !this.isBoss && this.region.key === 'tundra' && this.ter === T_LAND && !this.road;

    const d = normAngle(this.targetAngle - this.angle);
    const maxTurn = this.turnRate() * (icy ? .5 : 1) * dt;
    this.angle += clamp(d * Math.min(1, (icy ? 7 : 18) * dt), -maxTurn, maxTurn);

    let sp = this.speed() * this.slow;
    if (!this.isBoss){
      if (this.ter === T_SHALLOW) sp *= .66;
      if (this.road) sp *= 1.15;
      if (icy) sp *= 1.07;
      if (this.padT > 0) sp *= 1.65;
      if (this.boosting && this.mass > 6){
        sp *= 1.8;
        this.mass -= 11 * dt;
        this.boostDrop += 11 * dt;
        if (this.boostDrop > 3.5){
          this.boostDrop = 0;
          const tail = this.segs[this.segs.length - 1] || h;
          G.orbs.push(makeOrb(tail.x + rand(-6, 6), tail.y + rand(-6, 6), 3, 'food', this.skin.hue));
        }
      } else this.boosting = false;
    }

    let nx = h.x + Math.cos(this.angle) * sp * dt, ny = h.y + Math.sin(this.angle) * sp * dt;
    if (!this.isBoss){
      // rocks are solid — slide along them instead of dying
      const hit = rockHit(nx, ny, this.radius * .7);
      if (hit){
        const k = hit.rock, a = Math.atan2(ny - k.y, nx - k.x), md = k.r + this.radius * .7;
        nx = k.x + Math.cos(a) * md; ny = k.y + Math.sin(a) * md;
        const t1 = a + Math.PI / 2, t2 = a - Math.PI / 2;
        this.angle = Math.abs(normAngle(t1 - this.angle)) < Math.abs(normAngle(t2 - this.angle)) ? t1 : t2;
        if (!this.isPlayer) this.dodge = -this.dodge;
      }
    }
    this.path.push({ x: nx, y: ny });
    this.trim();
    this.segs = this.body(Math.max(4, this.radius * 0.55));
  }

  trim(){
    const need = this.length;
    let acc = 0, cut = 0;
    for (let i = this.path.length - 1; i > 0; i--){
      const a = this.path[i], b = this.path[i - 1];
      acc += Math.hypot(a.x - b.x, a.y - b.y);
      if (acc >= need){ cut = i - 1; break; }
    }
    if (cut > 0) this.path.splice(0, cut);
  }

  body(spacing){
    const p = this.path, out = [];
    if (!p.length) return out;
    out.push(p[p.length - 1]);
    let acc = 0, next = spacing;
    for (let i = p.length - 1; i > 0; i--){
      const a = p[i], b = p[i - 1];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d === 0) continue;
      while (acc + d >= next){
        const t = (next - acc) / d;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        next += spacing;
      }
      acc += d;
    }
    return out;
  }

  /* --- bot brain --- */
  think(dt){
    if (this.isBoss) return bossThink(this, dt);
    if (this.npc) return npcThink(this, dt);
    const h = this.head();
    let steer = null;
    this.slow = 1;
    this.thinkT -= dt; this.preyT -= dt;

    // 1. terrain: deep water, lava, rocks
    const look = this.radius * 4 + 90;
    for (const k of [.5, 1]){
      const ax = h.x + Math.cos(this.angle) * look * k, ay = h.y + Math.sin(this.angle) * look * k;
      const t = terrainAt(ax, ay);
      if (t === T_DEEP){ steer = Math.atan2(-h.y, -h.x); break; }
      if (t === T_LAVA || rockHit(ax, ay, this.radius * .8)){ steer = this.angle + this.dodge * 1.5; break; }
    }

    // 2. bodies ahead
    if (steer === null){
      const ax = h.x + Math.cos(this.angle) * look, ay = h.y + Math.sin(this.angle) * look;
      let threat = null;
      for (const s of G.snakes){
        if (s === this || !s.alive || (s.isBoss && s.phase !== 'surface')) continue;
        const sh = s.head();
        if (Math.abs(sh.x - h.x) > s.length + look + 200 || Math.abs(sh.y - h.y) > s.length + look + 200) continue;
        const lim = (s.radius + this.radius + 26) ** 2;
        for (const g of s.segs){
          const dx = g.x - ax, dy = g.y - ay;
          if (dx * dx + dy * dy < lim){ threat = g; break; }
        }
        if (threat) break;
      }
      if (threat) steer = Math.atan2(threat.y - h.y, threat.x - h.x) + this.dodge * Math.PI / 2;
    }
    if (steer !== null){ this.targetAngle = steer; return; }

    // 3. rich? head to a bank and cash out
    if (this.entry > 0 && this.cash >= this.entry * 1.8){
      if (!this.bank) this.bank = nearestBank(h.x, h.y).bank;
      const b = this.bank, d = Math.hypot(b.x - h.x, b.y - h.y);
      if (d < b.r * .75){
        this.bankT += dt; this.slow = .55;
        if (this.bankT >= CASHOUT_TIME){ cashOut(this, b); return; }
      } else this.bankT = 0;
      this.targetAngle = Math.atan2(b.y - h.y, b.x - h.x) + (d < b.r * .75 ? 1.2 : 0);
      this.boosting = d > 700 && this.mass > 40 && Math.random() < .03;
      return;
    }

    // 4. hunters cut across a smaller snake's nose
    if (this.aggr > .6){
      if ((!this.prey || !this.prey.alive || this.preyT <= 0) && this.thinkT <= 0){
        this.prey = null;
        let best = null, bd = 760;
        for (const s of G.snakes){
          if (s === this || !s.alive || s.shield > 0 || s.hidden || s.isBoss || s.npc || (s.isPlayer && !G.huntPlayer)) continue;
          if (s.radius > this.radius * 1.25) continue;
          const sh = s.head(), d = Math.hypot(sh.x - h.x, sh.y - h.y) * (s.isPlayer ? .7 : 1) * (s === G.king ? .7 : 1);
          if (d < bd){ bd = d; best = s; }
        }
        if (best && Math.random() < .55){ this.prey = best; this.preyT = rand(2.5, 4.5); }
      }
      if (this.prey && this.prey.alive && !this.prey.hidden){
        const ph = this.prey.head(), lead = this.prey.radius * 6 + 70;
        const tx = ph.x + Math.cos(this.prey.angle) * lead, ty = ph.y + Math.sin(this.prey.angle) * lead;
        const d = Math.hypot(tx - h.x, ty - h.y);
        this.targetAngle = Math.atan2(ty - h.y, tx - h.x);
        this.boosting = this.mass > 30 && d < 320 && d > 60;
        if (this.thinkT <= 0) this.thinkT = .4;
        return;
      }
    }

    // 5. the Vault is open — everybody goes
    const v = world.vault;
    if (v.state === 'open' && this.vaultFan && Math.hypot(v.x - h.x, v.y - h.y) < 3400){
      this.targetAngle = Math.atan2(v.y - h.y, v.x - h.x) + Math.sin(G.t + this.dodge) * .4;
      this.boosting = this.mass > 50 && Math.random() < .02;
      return;
    }

    // 6. shopping
    if (this.thinkT <= 0 || !this.goal){
      this.thinkT = 0.45;
      let best = null, bs = Infinity;
      forOrbs(h.x - 700, h.y - 700, h.x + 700, h.y + 700, o => {
        const d = Math.hypot(o.x - h.x, o.y - h.y);
        const worth = o.kind === 'cash' ? o.value * 6 : o.kind === 'gem' ? 4 : o.value;
        const sc = d / (1 + worth);
        if (sc < bs){ bs = sc; best = o; }
      });
      if (best) this.goal = { x: best.x, y: best.y };
      else if (!this.goal || Math.hypot(this.goal.x - h.x, this.goal.y - h.y) < 150 || Math.random() < .02)
        this.goal = randomLand(Math.random, Math.random() < .7 ? this.region : null);
    }
    this.targetAngle = Math.atan2(this.goal.y - h.y, this.goal.x - h.x);
    this.boosting = this.mass > 40 && Math.random() < 0.012;
  }
}

/* ============================================================
   The Dune Leviathan — invincible, lives in the desert, burrows
   ============================================================ */
function makeBoss(){
  const p = randomLand(Math.random, REG.desert, 120);
  const b = new Snake(p.x, p.y, 0, 'Dune Leviathan', BOSS_SKIN, false);
  Object.assign(b, { isBoss: true, bossR: 44, bossLen: 1500, shield: 0, phase: 'surface', phaseT: rand(12, 20) });
  // grow a full body immediately
  for (let i = 0; i < 400; i++){ const h = b.head(); b.path.push({ x: h.x + Math.cos(b.angle) * 4, y: h.y + Math.sin(b.angle) * 4 }); b.angle += .01; }
  b.trim(); b.segs = b.body(24);
  return b;
}
function bossThink(b, dt){
  const h = b.head(), p = G.player;
  const pp = p && p.alive && G.state === 'playing' ? p.head() : null;
  const chase = pp && regionAt(pp.x, pp.y) === REG.desert && Math.hypot(pp.x - h.x, pp.y - h.y) < (G.bossAggro ? 2600 : 1500);
  b.thinkT -= dt;
  let tx, ty;
  if (chase){
    tx = pp.x + Math.cos(p.angle) * 160; ty = pp.y + Math.sin(p.angle) * 160;
  } else {
    if (!b.goal || b.thinkT <= 0 || Math.hypot(b.goal.x - h.x, b.goal.y - h.y) < 200){
      b.goal = randomLand(Math.random, REG.desert); b.thinkT = 9;
    }
    tx = b.goal.x; ty = b.goal.y;
  }
  const ahead = { x: h.x + Math.cos(b.angle) * 220, y: h.y + Math.sin(b.angle) * 220 };
  if (regionAt(h.x, h.y) !== REG.desert || terrainAt(ahead.x, ahead.y) === T_DEEP || regionAt(ahead.x, ahead.y) !== REG.desert){
    tx = REG.desert.x; ty = REG.desert.y;
  }
  b.targetAngle = Math.atan2(ty - h.y, tx - h.x);

  b.phaseT -= dt;
  const near = pp && Math.hypot(pp.x - h.x, pp.y - h.y) < 1200;
  if (b.phase === 'surface' && b.phaseT <= 0){
    if (chase){ b.phase = 'under'; b.phaseT = 4.5; dust(h.x, h.y, 30); if (near) sfx.rumble(); }
    else b.phaseT = 5;
  } else if (b.phase === 'under' && b.phaseT <= 0){
    b.phase = 'rising'; b.phaseT = 1.2;
    if (near){ sfx.rumble(); G.shake = Math.max(G.shake, 5); buzz([30, 60, 30]); }
  } else if (b.phase === 'rising' && b.phaseT <= 0){
    b.phase = 'surface'; b.phaseT = rand(12, 20);
    dust(h.x, h.y, 60);
    if (near){ sfx.emerge(); G.shake = Math.max(G.shake, 12); buzz(120); }
  }
}
/* ============================================================
   Story NPCs — they run from you and stay in their home region
   ============================================================ */
export function spawnNPC({ name, skin, region, near, mass = 60 }){
  let p = null;
  for (let k = 0; k < 40 && !p; k++){
    const q = near ? { x: near.x + rand(-700, 700), y: near.y + rand(-700, 700) } : randomLand(Math.random, region, 60);
    if (terrainAt(q.x, q.y) === T_LAND && regionAt(q.x, q.y) === region && !rockHit(q.x, q.y, 60)
        && (!G.player || dist(q, G.player.head()) > 450)) p = q;
  }
  p = p || randomLand(Math.random, region, 60);
  const s = new Snake(p.x, p.y, 0, name, skin, false);
  Object.assign(s, { npc: true, home: region, mass, shield: 1, born: G.t });
  for (let i = 0; i < 40; i++) s.update(1 / 60);
  G.snakes.push(s);
  return s;
}
function npcThink(s, dt){
  const h = s.head(), p = G.player && G.player.alive ? G.player : null;
  s.thinkT -= dt;
  s.slow = G.t - s.born > 80 ? .78 : 1;          // he tires out eventually
  if (s.mass < 40) s.mass = 40;
  let steer = null;
  const look = s.radius * 4 + 80;
  for (const k of [.5, 1]){
    const ax = h.x + Math.cos(s.angle) * look * k, ay = h.y + Math.sin(s.angle) * look * k;
    const t = terrainAt(ax, ay);
    if (t === T_DEEP || t === T_LAVA || rockHit(ax, ay, s.radius * .8) || regionAt(ax, ay) !== s.home){
      steer = Math.atan2(s.home.y - h.y, s.home.x - h.x) + s.dodge * .6; break;
    }
  }
  if (steer === null && Math.random() < .45){      // clumsy: only half-watches for bodies
    const ax = h.x + Math.cos(s.angle) * look, ay = h.y + Math.sin(s.angle) * look;
    for (const o of G.snakes){
      if (o === s || !o.alive || o.isPlayer) continue;
      if (o.segs.some(g => (g.x - ax) ** 2 + (g.y - ay) ** 2 < (o.radius + s.radius + 20) ** 2)){ steer = s.angle + s.dodge * 1.4; break; }
    }
  }
  if (steer === null && p){
    const ph = p.head(), d = dist(ph, h);
    if (d < 850){
      steer = Math.atan2(h.y - ph.y, h.x - ph.x) + Math.sin(G.t * 1.7 + s.dodge) * .7;
      s.boosting = d < 380 && G.t - s.born < 80;
    } else {
      s.boosting = false;
      if (!s.goal || s.thinkT <= 0){ s.goal = randomLand(Math.random, s.home); s.thinkT = 4; }
      steer = Math.atan2(s.goal.y - h.y, s.goal.x - h.x); s.slow *= .6;
    }
  }
  if (steer !== null) s.targetAngle = steer;
}

function dust(x, y, n){
  for (let i = 0; i < n; i++){
    const a = rand(0, TAU), sp = rand(60, 320);
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(.5, 1.1), age: 0, r: rand(3, 7), hue: 36, sand: true });
  }
}

/* ============================================================
   Orbs + spatial grid
   ============================================================ */
const OC = 256, OCOLS = Math.ceil(2 * HALF / OC);
const ogrid = Array.from({ length: OCOLS * OCOLS }, () => []);
const ocell = v => clamp(((v + HALF) / OC) | 0, 0, OCOLS - 1);
function rebuildGrid(){
  for (const c of ogrid) c.length = 0;
  for (const o of G.orbs) if (!o.dead) ogrid[ocell(o.y) * OCOLS + ocell(o.x)].push(o);
}
function forOrbs(L, T, R, B, fn){
  const x0 = ocell(L), x1 = ocell(R), y0 = ocell(T), y1 = ocell(B);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){
    const c = ogrid[y * OCOLS + x];
    for (let i = 0; i < c.length; i++) if (!c[i].dead) fn(c[i]);
  }
}

function makeOrb(x, y, value, kind, hue){
  const r = kind === 'cash' ? 4 + 5 * Math.sqrt(value * 0.1)
          : kind === 'frenzy' ? 7 : kind === 'gem' ? 6 : 3 + value * 0.35;
  return { x, y, value, kind, r, hue: hue !== undefined ? hue : pick(HUES), ph: rand(0, TAU) };
}
function seedFood(n){
  for (let i = 0; i < n; i++){
    const p = randomLand(Math.random);
    const R = regionAt(p.x, p.y);
    if (Math.random() > R.food.d / 1.3) continue;
    const o = makeOrb(p.x, p.y, rand(R.food.v[0], R.food.v[1]), 'food', pick(R.food.hues));
    if (R.key === 'marsh' && Math.random() < .35) o.fish = rand(0, TAU);
    G.orbs.push(o);
  }
}
function scatterOrbs(x, y, n, rmin, rmax, kind, value, hue, extra){
  for (let i = 0; i < n; i++){
    const a = rand(0, TAU), r = rand(rmin, rmax);
    const ox = x + Math.cos(a) * r, oy = y + Math.sin(a) * r;
    const t = terrainAt(ox, oy);
    if (t === T_DEEP || t === T_LAVA) continue;
    const o = makeOrb(ox, oy, value, kind, hue);
    if (extra) Object.assign(o, extra);
    G.orbs.push(o);
  }
}
function spillCash(s){
  const segs = s.segs.length ? s.segs : [s.head()];
  const n = clamp(Math.round(s.cash * 0.22), 7, 80);
  for (let i = 0; i < n; i++){
    const g = segs[(i / n * segs.length) | 0] || segs[0];
    let x = g.x + rand(-14, 14), y = g.y + rand(-14, 14);
    const t = terrainAt(x, y);
    if (t === T_DEEP || t === T_LAVA){ const p = randomLand(Math.random, regionAt(x, y)); x = p.x; y = p.y; }   // never lose money to terrain
    G.orbs.push(makeOrb(x, y, s.cash / n, 'cash'));
  }
  s.cash = 0;
}
function spillMass(s){
  const segs = s.segs.length ? s.segs : [s.head()];
  const m = clamp(Math.round(s.mass / 6), 4, 60);
  for (let i = 0; i < m; i++){
    const g = segs[(i / m * segs.length) | 0] || segs[0];
    G.orbs.push(makeOrb(g.x + rand(-18, 18), g.y + rand(-18, 18), 5, 'food', s.skin.hue));
  }
}

function burst(x, y, n, hue, gold, spread){
  for (let i = 0; i < n; i++){
    const a = rand(0, TAU), sp = rand(40, spread || 260);
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(.35, .85), age: 0, r: gold ? rand(2, 4.5) : rand(1.5, 3.5),
      hue: hue !== undefined ? hue : rand(0, 360), gold: !!gold });
  }
}
function floatText(x, y, text, color, size = 16, life = 1){
  const f = { x, y, text, color, size, age: 0, life, vy: -46 };
  G.floats.push(f);
  return f;
}
let cashFloat = null;
function cashPickupFloat(h, v){
  if (cashFloat && cashFloat.age < .45 && G.floats.includes(cashFloat)){
    cashFloat.v += v; cashFloat.age = 0;
    cashFloat.x = h.x; cashFloat.y = h.y - 30;
    cashFloat.text = '+' + fmt(cashFloat.v);
    cashFloat.size = Math.min(26, 15 + Math.sqrt(cashFloat.v) * .8);
  } else {
    cashFloat = floatText(h.x, h.y - 30, '+' + fmt(v), '#f7c14b', 15, 1.1);
    cashFloat.v = v;
  }
}

/* ============================================================
   Population
   ============================================================ */
function spawnPoint(nearPlayer){
  const ph = G.player && G.player.alive ? G.player.head() : null;
  for (let k = 0; k < 30; k++){
    let p;
    if (ph && nearPlayer){
      const a = rand(0, TAU), r = rand(1100, 2600);
      p = { x: ph.x + Math.cos(a) * r, y: ph.y + Math.sin(a) * r };
      if (terrainAt(p.x, p.y) !== T_LAND || rockHit(p.x, p.y, 60)) continue;
    } else p = randomLand(Math.random, null, 60);
    if (ph && dist(p, ph) < 900) continue;
    let ok = true;
    for (const s of G.snakes){ if (s.alive && dist(s.head(), p) < 500){ ok = false; break; } }
    if (ok) return p;
  }
  return randomLand(Math.random, null, 60);
}
function addBot(){
  const p = spawnPoint(G.state === 'playing' && Math.random() < .5);
  const b = new Snake(p.x, p.y, G.tableStake, nextBotName(), botSkin(), false);
  b.mass = rand(10, 60);
  G.snakes.push(b);
  return b;
}
const botCount = () => { let n = 0; for (const s of G.snakes) if (s.alive && !s.isPlayer && !s.isBoss) n++; return n; };

export function startRun(stake, skin){
  // a fresh table: everyone buys in at your stake, no loose cash anywhere
  G.tableStake = stake;
  G.mode = 'arena'; G.objects = []; G.quest = null; G.bossAggro = false; G.huntPlayer = true; G.forceJackpot = 0;
  G.snakes = G.snakes.filter(s => s.isBoss && s.alive);
  G.orbs = G.orbs.filter(o => o.kind !== 'cash');
  G.particles = []; G.floats = [];
  const nest = REG.nest;
  let p = randomLand(Math.random, nest, 80);
  for (let k = 0; k < 20 && Math.hypot(p.x - nest.x, p.y - nest.y) > 900; k++) p = randomLand(Math.random, nest, 80);
  const pl = new Snake(p.x, p.y, stake, 'You', skin, true);
  G.player = pl; G.snakes.push(pl);
  while (botCount() < BOT_COUNT) addBot();
  G.run = { stake, t0: G.t, kills: 0, eaten: 0, frenzy: 0, boostT: 0, peak: stake,
            combo: 0, lastKill: -99, wasKing: 0, kingNow: false, bestCombo: 0,
            gems: 0, vault: 0, chests: 0, portals: 0, jackpots: 0, region: null, regions: new Set(),
            nightSeen: false, vaultWarn: false };
  G.cashT = 0; G.shake = 0;
  G.input.boost = G.input.cash = false; G.input.angle = null;
  G.cam.x = p.x; G.cam.y = p.y;
  G.state = 'playing';
}

/** story mode: no stakes, no money — just you, the island and the Scales */
export function startJourney(skin, at, mass){
  G.mode = 'journey'; G.tableStake = 0;
  G.snakes = G.snakes.filter(s => s.isBoss && s.alive);
  G.orbs = G.orbs.filter(o => o.kind !== 'cash');
  G.particles = []; G.floats = [];
  let p = at;
  for (let k = 0; k < 30 && (terrainAt(p.x, p.y) !== T_LAND || rockHit(p.x, p.y, 60)); k++) p = { x: at.x + rand(-160, 160), y: at.y + rand(-160, 160) };
  const pl = new Snake(p.x, p.y, 0, 'You', skin, true);
  pl.mass = Math.max(12, mass || 12);
  for (let i = 0; i < 60; i++){ pl.update(1 / 60); }
  G.player = pl; G.snakes.push(pl);
  while (botCount() < BOT_COUNT - 8) addBot();
  G.run = { stake: 0, t0: G.t, kills: 0, eaten: 0, frenzy: 0, boostT: 0, peak: 0,
            combo: 0, lastKill: -99, wasKing: 0, kingNow: false, bestCombo: 0,
            gems: 0, vault: 0, chests: 0, portals: 0, jackpots: 0, region: null, regions: new Set(),
            nightSeen: false, vaultWarn: false };
  G.cashT = 0; G.shake = 0; G.paused = false;
  G.input.boost = G.input.cash = false; G.input.angle = null;
  G.cam.x = p.x; G.cam.y = p.y;
  G.state = 'playing';
}
export const runSnapshot = () => G.run ? runSummary(false, {}) : null;

function runSummary(win, extra){
  const r = G.run, t = G.t - r.t0;
  return { win, stake: r.stake, kills: r.kills, eaten: r.eaten, frenzy: r.frenzy,
           boostT: r.boostT, time: t, peak: r.peak, king: r.wasKing, bestCombo: r.bestCombo,
           gems: r.gems, vault: r.vault, chests: r.chests, portals: r.portals, jackpots: r.jackpots,
           regions: r.regions.size, ...extra };
}

function kill(s, killer, cause){
  if (!s.alive || s.isBoss) return;
  s.alive = false;
  const h = s.head();
  burst(h.x, h.y, 24, s.skin.hue, false, 360);
  const cash = s.cash, wasKing = s === G.king;
  if (cash > 0.5) burst(h.x, h.y, 20, undefined, true, 280);
  if (s.cash > 0) spillCash(s);
  spillMass(s);
  G.hooks.died && G.hooks.died(s, killer, cause, h);

  if (killer && killer.isPlayer && !s.isPlayer && G.run) creditKill(s, cash, wasKing);
  if (s.isPlayer){
    G.state = 'ending'; G.endT = 1.1;
    G.result = runSummary(false, { killer: killer ? killer.name : null, cause, nearMiss: G.cashT });
    G.shake = 16; G.flash = .35;
    sfx.death(); buzz([60, 40, 180]);
  } else if (G.state === 'playing' && G.mode === 'arena' && G.hooks.feed && G.player && dist(h, G.player.head()) < 1400){
    G.hooks.feed(killer ? `${killer.isPlayer ? 'You' : killer.name} ${killer.isBoss ? 'swallowed' : 'cut off'} ${s.name}`
                        : `${s.name} ${cause === 'the lava' ? 'melted in lava' : cause === 'the deep water' ? 'drowned' : 'died'}`, cash);
  }
}

function creditKill(victim, cash, wasKing){
  const r = G.run;
  r.kills++;
  r.combo = G.t - r.lastKill < 8 ? r.combo + 1 : 1;
  r.lastKill = G.t;
  r.bestCombo = Math.max(r.bestCombo, r.combo);
  const h = victim.head();
  floatText(h.x, h.y - 20, victim.name, '#ffffff', 14, 1.3);
  G.shake = Math.min(G.shake + 7, 12); G.flash = .12;
  sfx.kill(r.combo); buzz([25, 30, 45]);
  G.hooks.kill && G.hooks.kill({ name: victim.name, cash, combo: r.combo,
    word: COMBO_WORDS[Math.min(r.combo, COMBO_WORDS.length - 1)], king: wasKing });
}

export function cashOut(s, bank){
  if (!s.alive) return;
  const gross = s.cash, fee = gross * RAKE, net = gross - fee;
  s.alive = false;
  const h = s.head();
  if (s.isPlayer){
    burst(h.x, h.y, 60, undefined, true, 420);
    G.state = 'ending'; G.endT = .8;
    G.result = runSummary(true, { gross, fee, net, bank: bank ? bank.name : '' });
    sfx.cashout(); buzz([20, 40, 20, 40, 80]);
  } else if (G.state === 'playing' && G.hooks.feed && gross > 1){
    G.hooks.feed(`${s.name} banked ${fmt(net)} at ${bank ? bank.name : 'a bank'}`, 0, true);
  }
  s.cash = 0;
  spillMass(s);
}

/* ============================================================
   Collisions + eating
   ============================================================ */
function collide(){
  for (const a of G.snakes){
    if (!a.alive || a.isBoss) continue;
    const h = a.head(), ar = a.radius;
    const t = terrainAt(h.x, h.y);
    if (t === T_DEEP){ kill(a, null, 'the deep water'); continue; }
    if (t === T_LAVA){ kill(a, null, 'the lava'); continue; }

    for (const b of G.snakes){
      if (b === a || !b.alive) continue;
      if (b.isBoss && b.phase !== 'surface') continue;
      if (a.shield > 0 || (b.shield > 0 && !b.isBoss)) continue;   // spawn protection works both ways
      const bh = b.head();
      const dh = Math.hypot(bh.x - h.x, bh.y - h.y);
      if (dh > b.length + ar + 60) continue;
      if (dh < ar + b.radius){ kill(a, b, b.isBoss ? 'the Dune Leviathan' : null); if (!b.isBoss) kill(b, a); break; }
      let hit = false;
      const lim = (ar * 0.55 + b.radius) ** 2;
      for (let i = 2; i < b.segs.length; i++){
        const g = b.segs[i], dx = g.x - h.x, dy = g.y - h.y;
        if (dx * dx + dy * dy < lim){ hit = true; break; }
      }
      if (hit){ kill(a, b, b.isBoss ? 'the Dune Leviathan' : null); break; }
    }
  }
}

function feed(dt){
  for (const s of G.snakes){
    if (!s.alive || s.isBoss) continue;
    const h = s.head(), pull = s.radius + 34, sr = s.radius;
    forOrbs(h.x - pull, h.y - pull, h.x + pull, h.y + pull, o => {
      const dx = h.x - o.x, dy = h.y - o.y, d2 = dx * dx + dy * dy;
      if (d2 > pull * pull) return;
      const d = Math.sqrt(d2) || 1;
      if (d < sr + o.r * .5){ eat(s, o); o.dead = true; }
      else { const f = 280 * dt / d; o.x += dx * f; o.y += dy * f; }
    });
  }
  let j = 0;
  for (let i = 0; i < G.orbs.length; i++) if (!G.orbs[i].dead) G.orbs[j++] = G.orbs[i];
  G.orbs.length = j;
}

function eat(s, o){
  if (s.isPlayer && G.hooks.eat) G.hooks.eat(o);
  if (o.kind === 'cash'){
    s.cash += o.value;
    burst(o.x, o.y, 6, undefined, true, 130);
    if (s.isPlayer){
      cashPickupFloat(s.head(), o.value);
      G.shake = Math.min(G.shake + 1.5, 6);
      sfx.coin(o.value > 20); buzz(12);
      G.run.peak = Math.max(G.run.peak, s.cash);
    }
  } else if (o.kind === 'gem'){
    s.mass += 1;
    if (s.isPlayer){
      G.run.gems++;
      if (o.vault) G.run.vault++;
      burst(o.x, o.y, 5, 160, false, 110);
      sfx.gem();
    }
  } else {
    s.mass += o.value;
    if (s.isPlayer){
      G.run.eaten++;
      if (o.kind === 'frenzy'){ G.run.frenzy++; burst(o.x, o.y, 5, 190, false, 120); }
      else burst(o.x, o.y, 2, o.hue, false, 80);
      sfx.eat();
    }
  }
}

/* ============================================================
   World systems: pads, portals, chests, jackpots, vault, geysers, frenzy, day/night
   ============================================================ */
function stepFeatures(dt){
  // speed pads + portals (everyone)
  for (const s of G.snakes){
    if (!s.alive || s.isBoss) continue;
    const h = s.head();
    for (const p of world.pads){
      if (Math.abs(p.x - h.x) < p.r && Math.abs(p.y - h.y) < p.r && s.padT < 1){
        if (s.isPlayer && s.padT <= 0){ sfx.pad(); buzz(10); floatText(h.x, h.y - 30, 'BOOST', '#38e1ff', 13, .8); }
        s.padT = 1.4;
      }
    }
    if (s.portalCD <= 0) for (const p of world.portals){
      if (Math.hypot(p.x - h.x, p.y - h.y) < p.r){ teleport(s, p); break; }
    }
  }

  // chests
  const pl = G.state === 'playing' && G.player && G.player.alive ? G.player : null;
  for (const c of world.chests){
    if (c.open){ c.respawn -= dt; if (c.respawn <= 0){ c.open = false; c.coil = 0; } continue; }
    c.coil = pl ? coilAround(pl, c) : 0;
    if (c.coil >= .9) crackChest(c);
  }

  // story objects
  if (pl) for (const o of G.objects){
    if (o.done) continue;
    const ph = pl.head(), d = dist(o, ph);
    if (o.type === 'shrine'){
      if (o.active === false){ o.coil = 0; continue; }
      o.coil = coilAround(pl, o);
      if (o.coil >= .9){
        o.done = true; o.coil = 1;
        burst(o.x, o.y, 60, 44, true, 420); burst(o.x, o.y, 40, 160, false, 360);
        G.shake = 10; G.flash = .4; sfx.discover(); buzz([30, 40, 30, 40, 90]);
        G.hooks.story && G.hooks.story('coil', o);
      }
    } else if (o.type === 'gate'){
      if (o.next && d < o.r){ o.done = true; burst(o.x, o.y, 26, 196, false, 260); sfx.pad(); buzz(15); G.hooks.story && G.hooks.story('gate', o); }
    } else if (d < o.r + pl.radius){
      o.done = true;
      burst(o.x, o.y, 36, o.type === 'beacon' ? 280 : 44, o.type !== 'beacon', 320);
      floatText(o.x, o.y - 40, o.label || 'GOT IT', '#ffe08a', 17, 1.3);
      G.shake = Math.max(G.shake, 5); sfx.chest(); buzz([20, 30, 40]);
      G.hooks.story && G.hooks.story('touch', o);
    }
  }

  // jackpot machines (Neon Strip)
  for (const m of world.jackpots){
    m.cd -= dt;
    if (m.spin > 0){
      m.spin -= dt;
      if (Math.floor((m.spin + dt) * 12) !== Math.floor(m.spin * 12)){ m.reels = m.reels.map(() => (Math.random() * 4) | 0); if (pl && dist(m, pl.head()) < 900) sfx.tick(); }
      if (m.spin <= 0) payJackpot(m);
    } else if (pl && m.cd <= 0 && dist(m, pl.head()) < 80){
      m.spin = 1.4; m.cd = 22; sfx.spin(); buzz(15);
    }
  }

  // the Vault
  const v = world.vault;
  v.t -= dt;
  if (v.state === 'closed'){
    if (v.t <= 30 && G.run && !G.run.vaultWarn && G.state === 'playing'){
      G.run.vaultWarn = true;
      G.hooks.banner && G.hooks.banner('THE VAULT OPENS IN 30s', 'Sunken Ruins · XP gems and mass pour out', 'mint');
    }
    if (v.t <= 0){
      v.state = 'open'; v.t = VAULT_OPEN; v.drip = 0;
      G.hooks.vault && G.hooks.vault('open');
      if (G.state === 'playing'){ sfx.vault(); G.hooks.banner && G.hooks.banner('THE VAULT IS OPEN', 'Get to the Sunken Ruins — follow the green arrow', 'mint'); }
    }
  } else {
    v.drip -= dt;
    if (v.drip <= 0){
      v.drip = .2;
      scatterOrbs(v.x, v.y, 2, 40, 280, 'food', 6, 44);
      scatterOrbs(v.x, v.y, 1, 40, 260, 'gem', 1, 160, { vault: true });
    }
    if (v.t <= 0){ v.state = 'closed'; v.t = VAULT_CLOSED; if (G.run) G.run.vaultWarn = false; }
  }

  // geysers (Magma Wastes)
  for (const g of world.geysers){
    g.t -= dt;
    if (g.t <= 0){
      g.t = rand(16, 26);
      scatterOrbs(g.x, g.y, 14, 50, 220, 'food', 6, 24);
      if (pl && dist(g, pl.head()) < 1400){
        burst(g.x, g.y, 40, 20, false, 400);
        sfx.geyser();
        if (dist(g, pl.head()) < 500) G.shake = Math.max(G.shake, 4);
      }
    }
  }

  // frenzy surges
  G.eventT -= dt;
  if (G.eventT <= 0){
    G.eventT = rand(55, 80);
    const R = pick(REGIONS.filter(r => r.key !== 'nest'));
    const p = randomLand(Math.random, R, 100);
    scatterOrbs(p.x, p.y, 70, 0, 260, 'frenzy', 7, 190);
    G.event = { x: p.x, y: p.y, t: 25, region: R };
    if (G.state === 'playing'){ sfx.frenzy(); G.hooks.banner && G.hooks.banner('FRENZY', `Mass surge in ${R.name} — follow the blue arrow`, 'cyan'); }
  }
  if (G.event){ G.event.t -= dt; if (G.event.t <= 0) G.event = null; }

  // marsh fish swim
  for (const o of G.orbs){
    if (o.fish === undefined) continue;
    o.fish += (Math.random() - .5) * dt * 2;
    const nx = o.x + Math.cos(o.fish) * 34 * dt, ny = o.y + Math.sin(o.fish) * 34 * dt;
    const t = terrainAt(nx, ny);
    if (t === T_LAND || t === T_SHALLOW){ o.x = nx; o.y = ny; } else o.fish += Math.PI;
  }

  // day / night
  const tod = (G.t % DAY_LENGTH) / DAY_LENGTH;
  G.night = smooth(.42, .55, tod) * (1 - smooth(.88, .98, tod));
  if (G.run && G.state === 'playing'){
    if (G.night > .5 && !G.run.nightSeen){ G.run.nightSeen = true; G.hooks.banner && G.hooks.banner('NIGHTFALL', 'Hard to see — easy to ambush', 'violet'); }
    if (G.night < .1) G.run.nightSeen = false;
  }
}

function teleport(s, p){
  const out = p.to, h = s.head();
  const nx = out.x + Math.cos(s.angle) * (out.r + 40), ny = out.y + Math.sin(s.angle) * (out.r + 40);
  const dx = nx - h.x, dy = ny - h.y;
  for (const q of s.path){ q.x += dx; q.y += dy; }
  s.segs = s.body(Math.max(4, s.radius * .55));
  s.portalCD = 3;
  burst(p.x, p.y, 24, p.hue, false, 300); burst(nx, ny, 24, p.hue, false, 300);
  if (s.isPlayer){
    G.cam.x = nx; G.cam.y = ny; G.flash = .4;
    G.run.portals++;
    sfx.portal(); buzz([20, 30, 20]);
    G.hooks.banner && G.hooks.banner('WARPED', out.region ? `→ ${regionAt(nx, ny).name}` : '', 'violet');
  }
}

function coilAround(p, c){
  const h = p.head(), L = p.length;
  if ((c.x - h.x) ** 2 + (c.y - h.y) ** 2 > (L * .55) ** 2) return 0;
  const segs = p.segs;
  if (segs.length < 8) return 0;
  let sum = 0, pa = Math.atan2(segs[0].y - c.y, segs[0].x - c.x), minD = Infinity;
  for (let i = 1; i < segs.length; i++){
    const g = segs[i], a = Math.atan2(g.y - c.y, g.x - c.x);
    let d = a - pa; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    sum += d; pa = a;
    const dd = Math.hypot(g.x - c.x, g.y - c.y); if (dd < minD) minD = dd;
  }
  if (minD < c.r) return 0;
  return Math.min(1, Math.abs(sum) / TAU);
}

function crackChest(c){
  c.open = true; c.respawn = rand(70, 120); c.coil = 0;
  const gems = [6, 12, 24][c.tier], mass = [8, 12, 18][c.tier];
  scatterOrbs(c.x, c.y, gems, 20, 110, 'gem', 1, 160);
  scatterOrbs(c.x, c.y, mass, 20, 130, 'food', 5, 44);
  burst(c.x, c.y, 40, 160, false, 360); burst(c.x, c.y, 20, undefined, true, 260);
  if (G.run){ G.run.chests++; }
  G.hooks.chest && G.hooks.chest(c);
  floatText(c.x, c.y - 40, ['CHEST CRACKED', 'IRON CHEST!', 'GOLDEN CHEST!'][c.tier], '#5df2c0', 18, 1.4);
  G.shake = Math.max(G.shake, 6);
  sfx.chest(); buzz([20, 30, 20, 30, 60]);
}

const REEL = ['7', '★', '◆', '♥'];
function payJackpot(m){
  let r = Math.random();
  if (G.forceJackpot > 0 && --G.forceJackpot === 0) r = 0;   // the story rigs the third spin
  const pl = G.player;
  G.hooks.jackpot && G.hooks.jackpot(r < .1, m);
  if (G.run) G.run.jackpots++;
  if (r < .1){
    m.reels = [0, 0, 0];
    scatterOrbs(m.x, m.y, 25, 40, 200, 'gem', 1, 160);
    scatterOrbs(m.x, m.y, 40, 40, 220, 'food', 6, 320);
    floatText(m.x, m.y - 60, 'JACKPOT!!', '#ff4fd8', 26, 2);
    G.shake = 10; G.flash = .25; sfx.jackpot(); buzz([30, 30, 30, 30, 120]);
  } else if (r < .4){
    m.reels = [1, 1, 1];
    scatterOrbs(m.x, m.y, 10, 40, 160, 'gem', 1, 160);
    floatText(m.x, m.y - 60, 'TRIPLE STAR', '#5df2c0', 18, 1.4); sfx.chest();
  } else {
    const a = (Math.random() * 4) | 0; m.reels = [a, (a + 1) % 4, (a + 2) % 4];
    scatterOrbs(m.x, m.y, 18, 40, 160, 'food', 5, 190);
    floatText(m.x, m.y - 60, 'SPILL', '#38e1ff', 15, 1.1); sfx.coin(false);
  }
  if (pl) burst(m.x, m.y, 26, 320, false, 300);
}

/* ============================================================
   Step
   ============================================================ */
function stepWorld(dt){
  rebuildGrid();
  for (const s of G.snakes) if (s.alive && !s.isPlayer) s.think(dt);
  for (const s of G.snakes) if (s.alive) s.update(dt);
  collide();
  feed(dt);
  stepFeatures(dt);

  for (let i = G.particles.length - 1; i >= 0; i--){
    const p = G.particles[i];
    p.age += dt;
    if (p.age >= p.life){ G.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= (1 - 3.2 * dt); p.vy *= (1 - 3.2 * dt);
  }
  for (let i = G.floats.length - 1; i >= 0; i--){
    const f = G.floats[i];
    f.age += dt; f.y += f.vy * dt; f.vy *= (1 - 2 * dt);
    if (f.age >= f.life) G.floats.splice(i, 1);
  }

  G.snakes = G.snakes.filter(s => s.alive);
  let n = botCount();
  while (n < BOT_COUNT){ addBot(); n++; }
  if (!G.boss || !G.boss.alive){ G.boss = makeBoss(); G.snakes.push(G.boss); }

  let food = 0;
  for (const o of G.orbs) if (o.kind === 'food') food++;
  if (food < TARGET_FOOD) seedFood(Math.min(12, TARGET_FOOD - food));

  let king = null;
  for (const s of G.snakes) if (s.cash > G.tableStake * 1.05 && (!king || s.cash > king.cash)) king = s;   // nobody's king at an even table
  G.king = king;
}

function stepPlaying(dt){
  const p = G.player, r = G.run;
  if (G.input.angle !== null) p.targetAngle = G.input.angle;
  const h = p.head();

  const nb = nearestBank(h.x, h.y);
  G.bankNear = nb.bank; G.bankDist = nb.dist;
  G.bankIn = G.mode === 'arena' && nb.dist < nb.bank.r ? nb.bank : null;

  if (G.input.cash && p.shield <= 0 && G.bankIn){
    const before = G.cashT;
    G.cashT += dt;
    p.slow = .5; p.boosting = false;
    // while banking, the snake coils around the vault door on its own so it never drifts out
    const b = G.bankIn, a = Math.atan2(h.y - b.y, h.x - b.x);
    if (!G.orbitDir) G.orbitDir = Math.sin(p.angle - a) >= 0 ? 1 : -1;
    const want = b.r * .45, corr = clamp((Math.hypot(h.x - b.x, h.y - b.y) - want) / want, -1, 1) * .9;
    p.targetAngle = a + G.orbitDir * (Math.PI / 2 + corr);
    if (Math.floor(before * 4) !== Math.floor(G.cashT * 4)) sfx.cashTick(G.cashT / CASHOUT_TIME);
    if (G.cashT >= CASHOUT_TIME){ cashOut(p, G.bankIn); }
  } else {
    if (G.mode === 'arena' && G.input.cash && !G.bankIn && (!G.noBankT || G.t - G.noBankT > 3)){
      G.noBankT = G.t; sfx.deny();
      G.hooks.banner && G.hooks.banner('NO BANK HERE', `${nb.bank.name} is ${meters(nb.dist)} away — follow the gold arrow`, 'coral');
    }
    G.cashT = Math.max(0, G.cashT - dt * 2.2);
    G.orbitDir = 0;
    p.slow = 1;
    const was = p.boosting;
    p.boosting = G.input.boost && p.mass > 6;
    if (p.boosting && !was) sfx.boost();
  }
  if (p.boosting) r.boostT += dt;

  stepWorld(dt);
  if (G.state !== 'playing') return;

  const R = regionAt(h.x, h.y);
  if (terrainAt(h.x, h.y) !== T_DEEP && R !== r.region){
    r.region = R; r.regions.add(R.key);
    G.hooks.region && G.hooks.region(R);
  }

  const isKing = G.mode === 'arena' && G.king === p;
  if (isKing && !r.kingNow){
    r.wasKing++;
    sfx.crown(); buzz([15, 30, 15]);
    G.hooks.banner && G.hooks.banner('YOU HOLD THE CROWN', 'Richest snake alive — hunters are coming', 'gold');
  }
  r.kingNow = isKing;

  // danger: water, lava or the worm ahead
  const ax = h.x + Math.cos(p.angle) * 160, ay = h.y + Math.sin(p.angle) * 160;
  const ta = terrainAt(ax, ay), bh = G.boss && G.boss.alive ? G.boss.head() : null;
  const worm = bh && G.boss.phase !== 'under' ? clamp(1 - (dist(bh, h) - 250) / 500, 0, 1) : 0;
  const want = Math.max(ta === T_DEEP || ta === T_LAVA ? 1 : 0, worm);
  G.danger += (want - G.danger) * Math.min(1, dt * 6);
}

function followCam(dt){
  const p = G.player, h = p.head();
  const scale = clamp(Math.sqrt(W * H) / 950, .72, 1.05);
  const tz = G.ouro ? .3 * scale : clamp(30 / (p.radius + 20), 0.36, 1.05) * scale;   // pull back for the finale
  G.zoom += (tz - G.zoom) * Math.min(1, dt * (G.ouro ? .8 : 2.5));
  G.cam.x += (h.x - G.cam.x) * Math.min(1, dt * 9);
  G.cam.y += (h.y - G.cam.y) * Math.min(1, dt * 9);
}

let ambA = Math.random() * TAU;
function driftCam(dt){
  ambA += dt * 0.018;
  const tx = Math.cos(ambA) * 2600, ty = Math.sin(ambA * 1.3) * 2400;
  const k = Math.min(1, dt * .5);
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
  const tz = .55 * clamp(Math.sqrt(W * H) / 950, .75, 1.05);
  G.zoom += (tz - G.zoom) * Math.min(1, dt * .8);
}

/* ============================================================
   Loop
   ============================================================ */
let last = 0;
function frame(now){
  let dt = Math.min(0.034, (now - last) / 1000 || 0);
  last = now;
  if (G.paused){ if (G.ouro && G.player){ G.t += 1 / 60; followCam(1 / 60); } draw(0); if (G.hooks.frame) G.hooks.frame(0); requestAnimationFrame(frame); return; }
  if (G.state === 'ending' && G.result && !G.result.win) dt *= .3;
  G.t += dt;

  if (G.state === 'playing'){ stepPlaying(dt); followCam(dt); }
  else if (G.state === 'ending'){
    stepWorld(dt); followCam(dt);
    G.endT -= dt / (G.result.win ? 1 : .3);
    if (G.endT <= 0){ G.state = 'over'; G.danger = 0; G.bankIn = null; G.hooks.end && G.hooks.end(G.result); }
  } else { stepWorld(dt); driftCam(dt); }

  G.shake = Math.max(0, G.shake - dt * 22);
  G.flash = Math.max(0, G.flash - dt * 1.6);
  draw(dt);
  if (G.hooks.frame) G.hooks.frame(dt);
  requestAnimationFrame(frame);
}

/* ============================================================
   Render
   ============================================================ */
const sprites = new Map();
function sprite(key, make){
  let s = sprites.get(key);
  if (!s){ s = document.createElement('canvas'); s.width = s.height = 64; make(s.getContext('2d')); sprites.set(key, s); }
  return s;
}
function glowSprite(key, core, mid, halo){
  return sprite(key, g => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, core); grd.addColorStop(.22, mid);
    grd.addColorStop(.32, halo); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  });
}
const foodSprite = h => glowSprite('f' + h, `hsl(${h} 100% 88%)`, `hsl(${h} 85% 60%)`, `hsla(${h} 90% 60% / .28)`);
const cashSprite = () => glowSprite('cash', '#fffaf0', '#f7c14b', 'rgba(247,193,75,.35)');
const frenzySprite = () => glowSprite('frz', '#ffffff', '#38e1ff', 'rgba(56,225,255,.4)');
const gemSprite = () => sprite('gem', g => {
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(93,242,192,.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#5df2c0'; g.beginPath(); g.moveTo(32, 16); g.lineTo(44, 32); g.lineTo(32, 48); g.lineTo(20, 32); g.closePath(); g.fill();
  g.fillStyle = '#e6fff6'; g.beginPath(); g.moveTo(32, 16); g.lineTo(38, 32); g.lineTo(32, 32); g.lineTo(20, 32); g.closePath(); g.fill();
});

function resize(){
  DPR = Math.min(1.5, window.devicePixelRatio || 1);   // sharp enough, and keeps big phones at 60fps
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  vignette = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .2, W / 2, H * .45, Math.max(W, H) * .75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(2,3,8,.55)');
}

function worldTransform(sx, sy){
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.translate(W / 2 + sx, H / 2 + sy);
  ctx.scale(G.zoom, G.zoom);
  ctx.translate(-G.cam.x, -G.cam.y);
}

function draw(dt){
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const z = G.zoom, sh = G.shake;
  const sx = sh ? rand(-sh, sh) : 0, sy = sh ? rand(-sh, sh) : 0;
  const hw = W / (2 * z), hh = H / (2 * z);
  const L = G.cam.x - hw, R = G.cam.x + hw, T = G.cam.y - hh, B = G.cam.y + hh;
  const t = G.t;
  const ph = G.player && (G.state === 'playing' || G.state === 'ending') ? G.player.head() : null;

  // --- ground layer ---
  worldTransform(sx, sy);
  drawGround(ctx, L, T, R, B);
  drawDecor(ctx, L, T, R, B, t);

  // --- darkness: night + caves, with a light around you ---
  G.viewRegion = regionAt(ph ? ph.x : G.cam.x, ph ? ph.y : G.cam.y);
  G.cavesF += ((G.viewRegion.key === 'caves' ? 1 : 0) - G.cavesF) * Math.min(1, dt * 2);
  G.dark = Math.max(G.night * .58, G.cavesF * .8) * (ph ? 1 : .45);   // menus stay readable at night
  if (G.dark > .01){
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const cx = ph ? (ph.x - G.cam.x) * z + W / 2 : W / 2, cy = ph ? (ph.y - G.cam.y) * z + H / 2 : H / 2;
    const lr = (G.cavesF > .5 ? 230 : 340) * z;
    const gr = ctx.createRadialGradient(cx, cy, ph ? lr * .35 : 0, cx, cy, ph ? lr * 1.6 : Math.max(W, H));
    gr.addColorStop(0, `rgba(4,4,16,${ph ? 0 : G.dark * .6})`);
    gr.addColorStop(1, `rgba(4,4,16,${G.dark})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    worldTransform(sx, sy);
  }

  // --- glowing world + landmarks ---
  drawGlow(ctx, L, T, R, B, t);
  drawLandmarks(L, T, R, B, t, ph);

  // orbs
  const nightGlow = 1 + G.dark * .5;
  forOrbs(L - 40, T - 40, R + 40, B + 40, o => {
    let s, img;
    if (o.kind === 'cash'){ s = o.r * 4.4 * (1 + Math.sin(t * 4 + o.ph) * .14) * nightGlow; img = cashSprite(); }
    else if (o.kind === 'frenzy'){ s = o.r * 4.4 * (1 + Math.sin(t * 6 + o.ph) * .2); img = frenzySprite(); }
    else if (o.kind === 'gem'){ s = o.r * 4.6 * (1 + Math.sin(t * 5 + o.ph) * .12); img = gemSprite(); }
    else { s = o.r * 4.2 * (1 + Math.sin(t * 2.5 + o.ph) * .12); img = foodSprite(o.hue); }
    ctx.drawImage(img, o.x - s / 2, o.y - s / 2, s, s);
  });

  // snakes
  for (const s of G.snakes){
    if (!s.alive || s.isPlayer || !inView(s, L, R, T, B)) continue;
    if (s.isBoss){ drawBoss(s, t); continue; }
    let a = 1;
    if (ph && G.dark > .3){
      const d = dist(s.head(), ph);
      a = 1 - (1 - clamp(1 - (d - 260) / 280, 0, 1)) * clamp((G.dark - .3) / .5, 0, 1);
    }
    drawSnake(s, a);
  }
  if (G.player && G.player.alive) drawSnake(G.player, 1);

  drawCanopy(ctx, L, T, R, B, ph ? ph.x : null, ph ? ph.y : null);

  for (const p of G.particles){
    const k = 1 - p.age / p.life;
    if (p.gold){ const s = p.r * 4 * k; ctx.drawImage(cashSprite(), p.x - s / 2, p.y - s / 2, s, s); }
    else {
      ctx.globalAlpha = k; ctx.fillStyle = p.sand ? `rgba(215,185,130,1)` : `hsl(${p.hue} 80% 65%)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.sand ? 1 : k), 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  for (const f of G.floats){
    const k = f.age / f.life, a = k < .7 ? 1 : 1 - (k - .7) / .3;
    const pop = f.age < .12 ? 1 + (1 - f.age / .12) * .5 : 1;
    ctx.globalAlpha = a;
    ctx.font = `800 ${f.size * pop / z}px "Space Grotesk", system-ui, sans-serif`;
    ctx.lineWidth = 4 / z; ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // --- screen space ---
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawWeather(ctx, W, H, dt, G.viewRegion.weather, t);
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  if (G.danger > .02){
    const a = G.danger * (.35 + .15 * Math.sin(t * 10));
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7);
    g.addColorStop(0, 'rgba(255,40,40,0)'); g.addColorStop(1, `rgba(255,40,40,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (G.flash > 0){ ctx.fillStyle = `rgba(255,255,255,${G.flash * .35})`; ctx.fillRect(0, 0, W, H); }

  if (G.state === 'playing'){
    const v = world.vault;
    if (G.mode === 'arena' && G.bankNear && !G.bankIn) edgeArrow(G.bankNear, '#f7c14b', 'BANK ' + meters(G.bankDist), 'bank');
    if (G.mode === 'arena' && G.king && G.king !== G.player) edgeArrow(G.king.head(), '#ffdf8a', fmt(G.king.cash), 'crown');
    if (G.quest) edgeArrow(G.quest, '#d6b8ff', G.quest.label + ' · ' + meters(G.player ? dist(G.quest, G.player.head()) : 0), 'quest');
    if (G.event) edgeArrow(G.event, '#38e1ff', 'FRENZY', null);
    if (v.state === 'open' || v.t < 30) edgeArrow(v, '#5df2c0', v.state === 'open' ? 'VAULT OPEN' : 'VAULT ' + Math.ceil(v.t) + 's', null);
    drawMinimap();
  }
}

function inView(s, L, R, T, B){
  const h = s.head(), pad = s.length + 60;
  return h.x > L - pad && h.x < R + pad && h.y > T - pad && h.y < B + pad;
}

/* ---------- landmarks ---------- */
function label(text, x, y, size, color){
  const z = G.zoom;
  ctx.font = `700 ${size / z}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(text, x, y + 1.5 / z);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function drawLandmarks(L, T, R, B, t, ph){
  const vis = (o, r) => o.x + r > L && o.x - r < R && o.y + r > T && o.y - r < B;

  drawShrines(L, T, R, B, t, vis);

  // banks
  for (const b of world.banks){
    if (G.mode === 'journey' || !vis(b, b.r + 80)) continue;
    const inside = G.bankIn === b;
    ctx.fillStyle = `rgba(247,193,75,${inside ? .2 : .07 + .03 * Math.sin(t * 3)})`;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = inside ? '#ffdf8a' : 'rgba(247,193,75,.75)'; ctx.lineWidth = 6;
    ctx.setLineDash([26, 16]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    // vault-door emblem
    const e = 44;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(b.x + 4, b.y + 6, e, 0, TAU); ctx.fill();
    const gr = ctx.createRadialGradient(b.x - e * .3, b.y - e * .3, 2, b.x, b.y, e);
    gr.addColorStop(0, '#fff3c4'); gr.addColorStop(.5, '#f7c14b'); gr.addColorStop(1, '#a8741a');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, e, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6b4a0c'; ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++){ const a = t * .6 + i / 6 * TAU; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * e * .3, b.y + Math.sin(a) * e * .3); ctx.lineTo(b.x + Math.cos(a) * e * .8, b.y + Math.sin(a) * e * .8); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(b.x, b.y, e * .3, 0, TAU); ctx.stroke();
    label('BANK', b.x, b.y - b.r - 14 / G.zoom, 16, '#ffdf8a');
    label(b.name, b.x, b.y - b.r + 4 / G.zoom, 11, 'rgba(255,230,170,.7)');
  }

  // portals
  for (const p of world.portals){
    if (!vis(p, p.r + 100)) continue;
    const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.6);
    gr.addColorStop(0, `hsla(${p.hue} 90% 70% / .9)`); gr.addColorStop(.45, `hsla(${p.hue} 90% 45% / .45)`); gr.addColorStop(1, `hsla(${p.hue} 90% 40% / 0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.6, 0, TAU); ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++){
      const rr = p.r * (.35 + i * .2), a = t * (2.4 - i * .4) * (i % 2 ? -1 : 1) + i;
      ctx.strokeStyle = `hsla(${p.hue} 95% ${75 - i * 8}% / ${.9 - i * .15})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, a, a + Math.PI * 1.3); ctx.stroke();
    }
    ctx.fillStyle = '#05040c'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .22, 0, TAU); ctx.fill();
    label('PORTAL', p.x, p.y - p.r - 26 / G.zoom, 13, `hsl(${p.hue} 90% 72%)`);
    label('→ ' + p.region, p.x, p.y - p.r - 10 / G.zoom, 10, 'rgba(230,235,255,.7)');
  }

  // the Vault
  const v = world.vault;
  if (vis(v, 500)){
    v.k = v.k || 0;
    v.k += ((v.state === 'open' ? 1 : 0) - v.k) * .05;
    ctx.fillStyle = '#3e3726'; ctx.beginPath(); ctx.arc(v.x, v.y, v.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a7a58'; ctx.lineWidth = 16; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3;
    for (let i = 0; i < 16; i++){ const a = i / 16 * TAU; ctx.beginPath(); ctx.moveTo(v.x + Math.cos(a) * v.r * .68, v.y + Math.sin(a) * v.r * .68); ctx.lineTo(v.x + Math.cos(a) * v.r, v.y + Math.sin(a) * v.r); ctx.stroke(); }
    if (v.k > .02){
      const gr = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, v.r * .9);
      gr.addColorStop(0, `rgba(210,255,240,${v.k})`); gr.addColorStop(.4, `rgba(93,242,192,${.7 * v.k})`); gr.addColorStop(1, 'rgba(93,242,192,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(v.x, v.y, v.r * .9, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 4; i++){   // the four doors slide apart
      const a = i / 4 * TAU + Math.PI / 4, off = v.k * 70;
      ctx.save(); ctx.translate(v.x + Math.cos(a) * off, v.y + Math.sin(a) * off);
      ctx.fillStyle = '#6e6246';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, v.r * .66, a - Math.PI / 4 + .03, a + Math.PI / 4 - .03); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a8966c'; ctx.lineWidth = 4; ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = v.state === 'open' ? '#5df2c0' : '#c9b37c';
    ctx.beginPath(); ctx.arc(v.x, v.y, 18 + v.k * 10, 0, TAU); ctx.fill();
    label('THE VAULT', v.x, v.y - v.r - 30 / G.zoom, 17, v.state === 'open' ? '#5df2c0' : '#e0cf9c');
    label(v.state === 'open' ? `OPEN · ${Math.ceil(v.t)}s` : `opens in ${Math.floor(v.t / 60)}:${String(Math.ceil(v.t) % 60).padStart(2, '0')}`,
          v.x, v.y - v.r - 12 / G.zoom, 12, 'rgba(240,230,200,.8)');
  }

  // jackpot machines
  for (const m of world.jackpots){
    if (!vis(m, 120)) continue;
    const ready = m.cd <= 0 && m.spin <= 0;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; roundRect(m.x - 46, m.y - 30, 100, 70, 14); ctx.fill();
    ctx.fillStyle = '#1b1030'; roundRect(m.x - 50, m.y - 36, 100, 70, 14); ctx.fill();
    ctx.strokeStyle = ready ? `hsl(${(t * 90) % 360} 95% 65%)` : '#6b3a8a'; ctx.lineWidth = 5; ctx.stroke();
    for (let i = 0; i < 3; i++){
      const rx = m.x - 36 + i * 26;
      ctx.fillStyle = '#f4efff'; roundRect(rx, m.y - 22, 22, 30, 5); ctx.fill();
      ctx.font = '800 20px "Space Grotesk", system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = ['#ff3b5c', '#f7c14b', '#38e1ff', '#ff4fd8'][m.reels[i]];
      ctx.fillText(REEL[m.reels[i]], rx + 11, m.y);
    }
    ctx.fillStyle = ready ? '#ff4fd8' : '#6b3a8a';
    ctx.beginPath(); ctx.arc(m.x + 42, m.y - 20, 6, 0, TAU); ctx.fill();
    label(ready ? 'JACKPOT · drive in' : m.spin > 0 ? 'SPINNING…' : `JACKPOT · ${Math.ceil(m.cd)}s`, m.x, m.y - 48 / Math.max(G.zoom, .5), 12, ready ? '#ff9be8' : '#9a7ab8');
  }

  // geysers
  for (const g of world.geysers){
    if (!vis(g, 240)) continue;
    const warn = g.t < 1.6 ? 1 - g.t / 1.6 : 0;
    ctx.fillStyle = '#1a0806'; ctx.beginPath(); ctx.arc(g.x, g.y, 34, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,120,40,${.5 + warn * .5})`; ctx.lineWidth = 6; ctx.stroke();
    if (warn > 0){
      ctx.strokeStyle = `rgba(255,150,60,${warn * .7})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(g.x, g.y, 40 + warn * 170, 0, TAU); ctx.stroke();
    }
  }

  // frenzy zone
  if (G.event && vis(G.event, 320)){
    const e = G.event, a = Math.min(1, e.t / 3) * (.5 + .5 * Math.sin(t * 4));
    ctx.beginPath(); ctx.arc(e.x, e.y, 300, 0, TAU);
    ctx.strokeStyle = `rgba(56,225,255,${.3 * a})`; ctx.lineWidth = 4 / G.zoom;
    ctx.setLineDash([18 / G.zoom, 12 / G.zoom]); ctx.lineDashOffset = -t * 40; ctx.stroke(); ctx.setLineDash([]);
  }

  // coil chests
  let tip = false;
  for (const c of world.chests){
    if (c.open || !vis(c, 120)) continue;
    const bob = Math.sin(t * 2.4 + c.x) * 3;
    const col = ['#9a6432', '#9aa6b8', '#f7c14b'][c.tier], lid = ['#c2864a', '#c9d3e0', '#ffe08a'][c.tier];
    const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 70);
    gr.addColorStop(0, `rgba(93,242,192,${.22 + .1 * Math.sin(t * 3)})`); gr.addColorStop(1, 'rgba(93,242,192,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, c.y, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(c.x - 24 + 4, c.y - 16 + 6, 48, 34, 6); ctx.fill();
    ctx.fillStyle = col; roundRect(c.x - 24, c.y - 18 + bob, 48, 34, 6); ctx.fill();
    ctx.fillStyle = lid; roundRect(c.x - 24, c.y - 18 + bob, 48, 12, 6); ctx.fill();
    ctx.fillStyle = '#2a1a08'; ctx.fillRect(c.x - 4, c.y - 8 + bob, 8, 10);
    if (c.coil > .08){
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(93,242,192,.2)'; ctx.lineWidth = 7 / G.zoom;
      ctx.beginPath(); ctx.arc(c.x, c.y, 60, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#5df2c0';
      ctx.beginPath(); ctx.arc(c.x, c.y, 60, -Math.PI / 2, -Math.PI / 2 + TAU * c.coil); ctx.stroke();
    }
    if (ph && !tip && G.showChestTip && dist(c, ph) < 420){
      tip = true;
      label('circle it to crack it', c.x, c.y - 44 / Math.max(G.zoom, .5), 12, '#5df2c0');
    }
  }
}
const SCALE_HUE = { nest: 44, tundra: 196, caves: 280, neon: 320, magma: 18, ruins: 40, wild: 110, marsh: 170, desert: 30 };
function drawScale(x, y, s, hue, t){
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.5) * .25);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.6);
  gr.addColorStop(0, `hsla(${hue} 100% 75% / .6)`); gr.addColorStop(1, `hsla(${hue} 100% 60% / 0)`);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, s * 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = `hsl(${hue} 90% 62%)`;
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * .9, -s * .2, 0, s); ctx.quadraticCurveTo(-s * .9, -s * .2, 0, -s); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * .45, -s * .3, 0, s * .6); ctx.quadraticCurveTo(-s * .1, 0, 0, -s); ctx.fill();
  ctx.restore();
}
function coilRing(x, y, r, k){
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(214,184,255,.22)'; ctx.lineWidth = 7 / G.zoom;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  if (k > .02){ ctx.strokeStyle = '#d6b8ff'; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); }
}
function drawShrines(L, T, R, B, t, vis){
  for (const s of Object.values(world.shrines)){
    if (!vis(s, 300)) continue;
    const claimed = G.claimed.has(s.key), hue = SCALE_HUE[s.key];
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(s.x, s.y, 120, 0, TAU); ctx.fill();
    ctx.strokeStyle = claimed ? `hsla(${hue} 80% 60% / .8)` : 'rgba(200,190,160,.35)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(s.x, s.y, 110, 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++){
      const a = i / 6 * TAU + .3, x = s.x + Math.cos(a) * 110, y = s.y + Math.sin(a) * 110;
      ctx.fillStyle = claimed ? `hsl(${hue} 60% 55%)` : '#6e6a5a'; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#4a4636'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    if (claimed){
      const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 90);
      gr.addColorStop(0, `hsla(${hue} 100% 70% / ${.45 + .15 * Math.sin(t * 2)})`); gr.addColorStop(1, `hsla(${hue} 100% 60% / 0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y, 90, 0, TAU); ctx.fill();
      drawScale(s.x, s.y - 6, 16, hue, t);
    }
  }
  const e = world.egg;
  if (vis(e, 600)){
    const n = G.claimed.size;
    ctx.strokeStyle = 'rgba(247,193,75,.25)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(e.x, e.y, 150, 0, TAU); ctx.stroke();
    for (let i = 0; i < 9; i++){
      const a = i / 9 * TAU - Math.PI / 2, x = e.x + Math.cos(a) * 150, y = e.y + Math.sin(a) * 150;
      ctx.fillStyle = i < n ? '#f7c14b' : 'rgba(120,110,80,.6)';
      ctx.beginPath(); ctx.arc(x, y, i < n ? 11 + Math.sin(t * 3 + i) * 2 : 9, 0, TAU); ctx.fill();
    }
    const gr = ctx.createRadialGradient(e.x - 10, e.y - 16, 4, e.x, e.y, 46);
    gr.addColorStop(0, '#fff8e0'); gr.addColorStop(.6, n >= 9 ? '#ffd76a' : '#d8cfb4'); gr.addColorStop(1, n >= 9 ? '#b8821c' : '#8a8068');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(e.x, e.y, 32, 42, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(e.x - 20, e.y - 4); ctx.lineTo(e.x - 6, e.y + 6); ctx.lineTo(e.x + 6, e.y - 6); ctx.lineTo(e.x + 18, e.y + 4); ctx.stroke();
    label('THE WORLD EGG', e.x, e.y - 175 / 1, 13, 'rgba(255,230,170,.8)');
  }

  // story objects
  for (const o of G.objects){
    if (!vis(o, 260)) continue;
    if (o.type === 'shrine'){ if (!o.done) coilRing(o.x, o.y, o.ring || 64, o.coil || 0); continue; }
    if (o.done && o.type !== 'beacon') continue;
    if (o.type === 'gate'){
      const a = o.a || 0, px = Math.cos(a + Math.PI / 2) * o.r, py = Math.sin(a + Math.PI / 2) * o.r;
      const col = o.done ? 'rgba(140,200,230,.25)' : o.next ? '#8fe4ff' : 'rgba(170,220,255,.5)';
      ctx.strokeStyle = col; ctx.lineWidth = o.next ? 8 : 5; ctx.setLineDash(o.next ? [] : [14, 10]);
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      for (const sgn of [-1, 1]){ ctx.fillStyle = col; ctx.beginPath(); ctx.arc(o.x + px * sgn, o.y + py * sgn, 14, 0, TAU); ctx.fill(); }
      if (!o.done) label(String(o.n), o.x, o.y + 8 / G.zoom, o.next ? 22 : 15, col);
    } else if (o.type === 'beacon'){
      const lit = o.done, k = lit ? 1 : .35 + .2 * Math.sin(t * 3 + o.x);
      const gr = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, lit ? 260 : 90);
      gr.addColorStop(0, `rgba(200,160,255,${.6 * k})`); gr.addColorStop(1, 'rgba(160,120,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(o.x, o.y, lit ? 260 : 90, 0, TAU); ctx.fill();
      ctx.fillStyle = lit ? '#f4e8ff' : '#7a5ab8';
      ctx.beginPath(); ctx.moveTo(o.x, o.y - 30); ctx.lineTo(o.x + 18, o.y); ctx.lineTo(o.x, o.y + 30); ctx.lineTo(o.x - 18, o.y); ctx.closePath(); ctx.fill();
    } else {
      // relic / shard / core: a floating scale with a light pillar
      const hue = o.hue ?? 44;
      ctx.fillStyle = `hsla(${hue} 100% 70% / .12)`; ctx.fillRect(o.x - 14, o.y - 400, 28, 400);
      drawScale(o.x, o.y + Math.sin(t * 3 + o.x) * 5, 14, hue, t);
    }
  }
  if (G.ouro) drawOuro(t);
}
function drawOuro(t){
  const o = G.ouro, k = Math.min(1, (G.t - o.t0) / 3), e = world.egg;
  const R = 420 + (1 - k) * 600, n = 90;
  ctx.globalAlpha = k;
  for (let i = n - 1; i >= 0; i--){
    const a = t * .4 + i / n * TAU * .92, x = e.x + Math.cos(a) * R, y = e.y + Math.sin(a) * R;
    ctx.fillStyle = segColor({ kind: 'shine', a: '#f7c14b', b: '#e0a82e' }, i, t);
    ctx.beginPath(); ctx.arc(x, y, 62 * (1 - i / n * .55), 0, TAU); ctx.fill();
  }
  const a = t * .4, hx = e.x + Math.cos(a) * R, hy = e.y + Math.sin(a) * R;
  ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(hx, hy, 72, 0, TAU); ctx.fill();
  for (const s of [-1, 1]){
    const ex = hx + Math.cos(a + Math.PI / 2 + s * .5) * 22, ey = hy + Math.sin(a + Math.PI / 2 + s * .5) * 22;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1a04'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundRect(x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ---------- snakes ---------- */
function drawSnake(s, alpha){
  const p = s.segs;
  if (p.length < 2) return;
  const r = s.radius, sk = s.skin, t = G.t, z = G.zoom;
  const h = p[0], a = s.angle;

  if (alpha > .03){
    ctx.globalAlpha = alpha;
    const path = new Path2D();
    path.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) path.lineTo(p[i].x, p[i].y);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    if (s.boosting || s.padT > 0 || sk.kind === 'glow'){
      ctx.strokeStyle = s.padT > 0 && sk.kind !== 'glow' ? '#38e1ff' : sk.glow || sk.a;
      ctx.globalAlpha = alpha * (s.boosting || s.padT > 0 ? .3 : .16 + .05 * Math.sin(t * 3));
      ctx.lineWidth = r * 2 + (s.boosting ? 18 : 14); ctx.stroke(path);
      ctx.globalAlpha = alpha;
    }
    ctx.strokeStyle = sk.dark; ctx.lineWidth = r * 2 + 4; ctx.stroke(path);
    for (let i = p.length - 1; i >= 1; i--){
      ctx.fillStyle = segColor(sk, i, t);
      ctx.beginPath(); ctx.arc(p[i].x, p[i].y, r, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = r * .8; ctx.stroke(path);

    const rich = clamp(s.cash / (G.tableStake * 6), 0, 1);
    if (s.cash > 0.5){
      const every = Math.max(2, Math.round(7 - rich * 5)), gs = r * (1.1 + rich * .6);
      const img = cashSprite();
      for (let i = 3; i < p.length; i += every) ctx.drawImage(img, p[i].x - gs / 2, p[i].y - gs / 2, gs, gs);
    }
    ctx.fillStyle = segColor(sk, 0, t);
    ctx.beginPath(); ctx.arc(h.x, h.y, r * 1.08, 0, TAU); ctx.fill();
  }

  // eyes stay visible in the dark
  ctx.globalAlpha = Math.max(alpha, .9);
  const look = s.isPlayer && G.input.angle !== null ? G.input.angle : a;
  for (const side of [-1, 1]){
    const ex = h.x + Math.cos(a) * r * .42 + Math.cos(a + side * Math.PI / 2) * r * .5;
    const ey = h.y + Math.sin(a) * r * .42 + Math.sin(a + side * Math.PI / 2) * r * .5;
    ctx.fillStyle = alpha < .5 ? '#ffe9a8' : '#fff';
    ctx.beginPath(); ctx.arc(ex, ey, r * .34, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0d16';
    ctx.beginPath(); ctx.arc(ex + Math.cos(look) * r * .14, ey + Math.sin(look) * r * .14, r * .18, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (alpha < .25) return;

  if (s.shield > 0){
    const fade = Math.min(1, s.shield / 1.2), br = r * 2.5 * (1 + Math.sin(t * 5.5) * .05);
    ctx.save();
    ctx.globalAlpha = .1 * fade; ctx.fillStyle = '#8fd7ff';
    ctx.beginPath(); ctx.arc(h.x, h.y, br, 0, TAU); ctx.fill();
    ctx.globalAlpha = .6 * fade; ctx.strokeStyle = '#8fd7ff'; ctx.lineWidth = 2 / z;
    ctx.setLineDash([10 / z, 7 / z]); ctx.lineDashOffset = -t * 22;
    ctx.beginPath(); ctx.arc(h.x, h.y, br, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (s.isPlayer && G.cashT > 0.02){
    const k = Math.min(1, G.cashT / CASHOUT_TIME), rr = r * 2.3 + 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(247,193,75,.18)'; ctx.lineWidth = 6 / z;
    ctx.beginPath(); ctx.arc(h.x, h.y, rr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#f7c14b';
    ctx.beginPath(); ctx.arc(h.x, h.y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
  }
  if (s.hidden && !s.isPlayer) return;   // under the canopy: no name tag

  const fs = 13 / z;
  let y = h.y - r * 1.1 - 8 / z;
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  if (G.mode === 'journey'){
    if (!s.isPlayer){
      ctx.font = `${s.npc ? 700 : 500} ${(s.npc ? 13 : 11) / z}px "Space Grotesk", system-ui, sans-serif`;
      ctx.fillStyle = s.npc ? '#ffd76a' : 'rgba(210,218,235,.55)'; ctx.fillText(s.name, h.x, y);
    }
    ctx.globalAlpha = 1;
    return;
  }
  ctx.font = `700 ${fs}px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(fmt(s.cash), h.x, y + 1.5 / z);
  ctx.fillStyle = s.isPlayer ? '#ffffff' : '#f7c14b'; ctx.fillText(fmt(s.cash), h.x, y);
  y -= fs * 1.1;
  if (!s.isPlayer){
    ctx.font = `500 ${11 / z}px "Space Grotesk", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(210,218,235,.55)'; ctx.fillText(s.name, h.x, y);
    y -= fs * 1.05;
  }
  if (s === G.king) drawCrown(h.x, y - 4 / z, 11 / z);
  ctx.globalAlpha = 1;
}

function drawBoss(b, t){
  const h = b.head();
  if (b.phase === 'surface'){
    drawSnake(b, 1);
    // mandibles
    const r = b.radius, a = b.angle;
    ctx.strokeStyle = '#f2e6c8'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (const side of [-1, 1]){
      const bx = h.x + Math.cos(a) * r * .8 + Math.cos(a + side * 1.2) * r * .6, by = h.y + Math.sin(a) * r * .8 + Math.sin(a + side * 1.2) * r * .6;
      const open = .4 + .3 * Math.sin(t * 6);
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(a + side * open) * r, by + Math.sin(a + side * open) * r, bx + Math.cos(a - side * .3) * r * 1.2, by + Math.sin(a - side * .3) * r * 1.2);
      ctx.stroke();
    }
    label('DUNE LEVIATHAN', h.x, h.y - r - 16 / G.zoom, 13, '#ff8a6a');
    return;
  }
  // underground: a moving mound, then a warning ring before it bursts out
  for (let i = 0; i < b.segs.length; i += 3){
    const g = b.segs[i], k = 1 - i / b.segs.length;
    ctx.fillStyle = `rgba(200,170,110,${.22 * k})`;
    ctx.beginPath(); ctx.arc(g.x, g.y, b.radius * .9 * k + 6, 0, TAU); ctx.fill();
  }
  if (b.phase === 'rising'){
    const k = 1 - b.phaseT / 1.2;
    ctx.strokeStyle = `rgba(255,80,60,${.4 + .5 * Math.sin(t * 20)})`; ctx.lineWidth = 6 / G.zoom;
    ctx.beginPath(); ctx.arc(h.x, h.y, 60 + k * 120, 0, TAU); ctx.stroke();
    label('!', h.x, h.y - 20 / G.zoom, 28, '#ff5a4d');
  }
}

function drawCrown(x, y, s){
  const bob = Math.sin(G.t * 4) * s * .15;
  y += bob;
  ctx.fillStyle = '#f7c14b';
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * .5);
  ctx.lineTo(x - s, y - s * .4); ctx.lineTo(x - s * .5, y + s * .05);
  ctx.lineTo(x, y - s * .7); ctx.lineTo(x + s * .5, y + s * .05);
  ctx.lineTo(x + s, y - s * .4); ctx.lineTo(x + s, y + s * .5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath(); ctx.arc(x, y - s * .7, s * .16, 0, TAU); ctx.fill();
}

const arrowSlots = [];
function edgeArrow(pos, color, text, icon){
  const z = G.zoom;
  const x = (pos.x - G.cam.x) * z + W / 2, y = (pos.y - G.cam.y) * z + H / 2;
  const m = 52;
  if (x > m && x < W - m && y > m + 60 && y < H - m) return;
  const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy;
  const k = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m - 40) / Math.abs(dy || 1e-6));
  const ax = cx + dx * k, ay = cy + dy * k, ang = Math.atan2(dy, dx);
  const pulse = 1 + Math.sin(G.t * 6) * .08;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.save(); ctx.rotate(ang); ctx.scale(pulse, pulse);
  ctx.fillStyle = color; ctx.globalAlpha = .95;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, -11); ctx.lineTo(-2, 0); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fill();
  ctx.restore();
  const lx = -Math.cos(ang) * 32, ly = -Math.sin(ang) * 32;
  if (icon === 'crown') drawCrown(lx, ly - 16, 7);
  if (icon === 'quest') drawScale(lx, ly - 18, 8, 270, G.t);
  if (icon === 'bank'){
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(lx, ly - 16, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6b4a0c'; ctx.beginPath(); ctx.arc(lx, ly - 16, 3, 0, TAU); ctx.fill();
  }
  ctx.font = '700 11px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(text, lx, ly + 5);
  ctx.fillStyle = color; ctx.fillText(text, lx, ly + 4);
  ctx.restore();
}

export function minimapRect(){
  const size = W < 600 ? 92 : 120, pad = 14;
  return { x: pad, y: H - size - pad, size };
}
function drawMinimap(){
  const { x, y, size } = minimapRect();
  const cx = x + size / 2, cy = y + size / 2, k = size / (2 * HALF);
  const tx = v => x + (v + HALF) * k, ty = v => y + (v + HALF) * k;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, TAU);
  ctx.fillStyle = '#061626'; ctx.fill();
  ctx.clip();
  ctx.globalAlpha = .9;
  ctx.drawImage(world.mini, x, y, size, size);
  ctx.globalAlpha = 1;
  if (G.mode === 'arena') for (const b of world.banks){ ctx.fillStyle = '#f7c14b'; ctx.fillRect(tx(b.x) - 2.5, ty(b.y) - 2.5, 5, 5); }
  const v = world.vault;
  ctx.fillStyle = v.state === 'open' ? '#5df2c0' : 'rgba(220,200,150,.7)';
  ctx.beginPath(); ctx.arc(tx(v.x), ty(v.y), v.state === 'open' ? 4 + Math.sin(G.t * 6) : 2.5, 0, TAU); ctx.fill();
  if (G.event){ ctx.fillStyle = 'rgba(56,225,255,.8)'; ctx.beginPath(); ctx.arc(tx(G.event.x), ty(G.event.y), 3.5, 0, TAU); ctx.fill(); }
  if (G.king && G.king !== G.player){ const h = G.king.head(); ctx.fillStyle = '#ffdf8a'; ctx.beginPath(); ctx.arc(tx(h.x), ty(h.y), 3, 0, TAU); ctx.fill(); }
  if (G.quest){ ctx.fillStyle = '#d6b8ff'; ctx.beginPath(); ctx.arc(tx(G.quest.x), ty(G.quest.y), 4 + Math.sin(G.t * 5), 0, TAU); ctx.fill(); }
  if (G.boss && G.boss.phase === 'surface'){ const h = G.boss.head(); ctx.fillStyle = '#ff5a4d'; ctx.beginPath(); ctx.arc(tx(h.x), ty(h.y), 3.4, 0, TAU); ctx.fill(); }
  if (G.player && G.player.alive){
    const h = G.player.head(), a = G.player.angle;
    ctx.save(); ctx.translate(tx(h.x), ty(h.y)); ctx.rotate(a);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, TAU); ctx.stroke();
  ctx.font = '700 9px "Space Grotesk", system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,235,255,.6)';
  ctx.fillText('MAP', cx, y + size + 11 > H ? y - 4 : y + size + 11);
}

/* ============================================================
   Public
   ============================================================ */
export function initGame(canvas){
  cv = canvas; ctx = cv.getContext('2d');
  buildWorld();
  resize();
  addEventListener('resize', resize);
  seedFood(TARGET_FOOD);
  while (botCount() < BOT_COUNT) addBot();
  G.boss = makeBoss(); G.snakes.push(G.boss);
  G.cam.x = Math.cos(ambA) * 2600; G.cam.y = Math.sin(ambA * 1.3) * 2400;
  for (let i = 0; i < 90; i++) stepWorld(1 / 30);
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
}

export function toMenu(){
  G.state = 'menu'; G.player = null; G.run = null; G.bankIn = null; G.danger = 0; G.paused = false;
  G.objects = []; G.quest = null; G.bossAggro = false; G.forceJackpot = 0;
}
export const viewport = () => ({ W, H });
