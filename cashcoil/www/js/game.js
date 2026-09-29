/* ============================================================
   Cashcoil — arena engine
   Money model:
     • cash = stake coins. Only enters as a stake, only leaves via a
              cash-out (95% to the player, 5% house). Never created.
     • mass = free food. Makes you long, fuels sprint, worth nothing.
   ============================================================ */
import { WORLD_R, TARGET_FOOD, FIELD_SIZE, AMBIENT_COUNT, RAKE, CASHOUT_TIME,
         BOT_NAMES, HUES, COMBO_WORDS } from './config.js';
import { sfx, buzz } from './fx.js';

const TAU = Math.PI * 2;
export const rand  = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[(Math.random() * a.length) | 0];
const normAngle = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
export const fmt = v => Math.floor(Math.max(0, v)).toLocaleString('en-US');

let cv, ctx, DPR = 1, W = 0, H = 0, vignette = null, hexPattern = null;

export const G = {
  state: 'menu',            // menu | playing | ending | over
  snakes: [], orbs: [], particles: [], floats: [],
  player: null, king: null, run: null, result: null,
  cam: { x: 0, y: 0 }, zoom: .6, shake: 0, flash: 0, t: 0,
  input: { angle: null, boost: false, cash: false },
  cashT: 0, endT: 0, eventT: 40, event: null, danger: 0,
  tableStake: 50,
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
    this.alive = true; this.shield = isPlayer ? 4 : 3;
    this.angle = rand(-Math.PI, Math.PI); this.targetAngle = this.angle;
    this.boosting = false; this.boostDrop = 0; this.slow = 1;
    this.thinkT = 0; this.dodge = Math.random() < .5 ? 1 : -1;
    this.aggr = Math.random(); this.prey = null; this.preyT = 0;
    this.path = []; this.segs = [];
    for (let i = 14; i >= 0; i--)
      this.path.push({ x: x - Math.cos(this.angle) * i * 3, y: y - Math.sin(this.angle) * i * 3 });
  }
  get value(){ return this.cash * 0.1 + this.mass * 0.35; }
  get radius(){ return 8 + 6.2 * Math.pow(this.value + 1, 0.30); }
  get length(){ return this.radius * 9 + Math.min(this.value, 600) * 2.4; }
  head(){ return this.path[this.path.length - 1]; }
  speed(){ return Math.max(96, 156 - this.radius * 0.42); }
  turnRate(){ return Math.max(4.2, 8.2 - this.radius * 0.028); }

  update(dt){
    if (this.shield > 0) this.shield = Math.max(0, this.shield - dt);
    const d = normAngle(this.targetAngle - this.angle);
    const maxTurn = this.turnRate() * dt;
    this.angle += clamp(d * Math.min(1, 18 * dt), -maxTurn, maxTurn);

    let sp = this.speed() * this.slow;
    if (this.boosting && this.mass > 6){
      sp *= 1.8;
      this.mass -= 11 * dt;
      this.boostDrop += 11 * dt;
      if (this.boostDrop > 3.5){
        this.boostDrop = 0;
        const tail = this.segs[this.segs.length - 1] || this.head();
        G.orbs.push(makeOrb(tail.x + rand(-6, 6), tail.y + rand(-6, 6), 3, 'food', this.skin.hue));
      }
    } else this.boosting = false;

    const h = this.head();
    this.path.push({ x: h.x + Math.cos(this.angle) * sp * dt, y: h.y + Math.sin(this.angle) * sp * dt });
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
    const h = this.head();
    let steer = null;

    // 1. arena wall
    if (Math.hypot(h.x, h.y) > WORLD_R - 260) steer = Math.atan2(-h.y, -h.x);

    // 2. bodies ahead
    if (steer === null){
      const look = this.radius * 4 + 90;
      const ax = h.x + Math.cos(this.angle) * look, ay = h.y + Math.sin(this.angle) * look;
      let threat = null;
      for (const s of G.snakes){
        if (s === this || !s.alive) continue;
        const sh = s.head();
        if (Math.hypot(sh.x - h.x, sh.y - h.y) > s.length + look + 200) continue;
        const lim = (s.radius + this.radius + 26) ** 2;
        for (const g of s.segs){
          const dx = g.x - ax, dy = g.y - ay;
          if (dx * dx + dy * dy < lim){ threat = g; break; }
        }
        if (threat) break;
      }
      if (threat) steer = Math.atan2(threat.y - h.y, threat.x - h.x) + this.dodge * Math.PI / 2;
    }

    this.thinkT -= dt;
    this.preyT -= dt;

    // 3. hunters try to cut across a smaller snake's nose
    if (steer === null && this.aggr > .62){
      if ((!this.prey || !this.prey.alive || this.preyT <= 0) && this.thinkT <= 0){
        this.prey = null;
        let best = null, bd = 720;
        for (const s of G.snakes){
          if (s === this || !s.alive || s.shield > 0) continue;
          if (s.radius > this.radius * 1.25) continue;
          const sh = s.head(), d = Math.hypot(sh.x - h.x, sh.y - h.y) * (s.isPlayer ? .75 : 1);
          if (d < bd){ bd = d; best = s; }
        }
        if (best && Math.random() < .5){ this.prey = best; this.preyT = rand(2.5, 4.5); }
      }
      if (this.prey && this.prey.alive){
        const ph = this.prey.head(), lead = this.prey.radius * 6 + 70;
        const tx = ph.x + Math.cos(this.prey.angle) * lead, ty = ph.y + Math.sin(this.prey.angle) * lead;
        steer = Math.atan2(ty - h.y, tx - h.x);
        const dist = Math.hypot(tx - h.x, ty - h.y);
        this.boosting = this.mass > 30 && dist < 320 && dist > 60;
        this.targetAngle = steer;
        if (this.thinkT <= 0) this.thinkT = .4;
        return;
      }
    }

    // 4. go shopping
    if (steer === null){
      if (this.thinkT <= 0 || !this.goal){
        this.thinkT = 0.4;
        let best = null, bs = Infinity;
        for (const o of G.orbs){
          const d = Math.hypot(o.x - h.x, o.y - h.y);
          if (d > 1000) continue;
          const worth = o.kind === 'cash' ? o.value * 6 : o.value;
          const sc = d / (1 + worth);
          if (sc < bs){ bs = sc; best = o; }
        }
        this.goal = best ? { x: best.x, y: best.y }
                         : { x: rand(-1, 1) * WORLD_R * .7, y: rand(-1, 1) * WORLD_R * .7 };
      }
      steer = Math.atan2(this.goal.y - h.y, this.goal.x - h.x);
    }

    this.targetAngle = steer;
    this.boosting = this.mass > 40 && Math.random() < 0.012;

    // bots take winnings home sometimes
    if (this.cash > this.entry * 2.6 && Math.random() < 0.0009) cashOut(this);
  }
}

/* ============================================================
   Orbs, particles, floating text
   ============================================================ */
function makeOrb(x, y, value, kind, hue){
  const r = kind === 'cash' ? 4 + 5 * Math.sqrt(value * 0.1)
          : kind === 'frenzy' ? 7 : 3 + value * 0.35;
  return { x, y, value, kind, r, hue: hue !== undefined ? hue : pick(HUES), ph: rand(0, TAU) };
}
function seedFood(n){
  for (let i = 0; i < n; i++){
    const a = rand(0, TAU), r = WORLD_R * Math.sqrt(Math.random());
    G.orbs.push(makeOrb(Math.cos(a) * r, Math.sin(a) * r, rand(1.5, 4), 'food'));
  }
}
function spillCash(s){
  const segs = s.segs.length ? s.segs : [s.head()];
  const n = clamp(Math.round(s.cash * 0.22), 7, 80);
  for (let i = 0; i < n; i++){
    const g = segs[(i / n * segs.length) | 0] || segs[0];
    G.orbs.push(makeOrb(g.x + rand(-14, 14), g.y + rand(-14, 14), s.cash / n, 'cash'));
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
   Arena management
   ============================================================ */
function spawnPoint(){
  // away from other heads so nobody spawns into a body
  let best = null, bd = -1;
  for (let k = 0; k < 8; k++){
    const a = rand(0, TAU), r = WORLD_R * .78 * Math.sqrt(Math.random());
    const p = { x: Math.cos(a) * r, y: Math.sin(a) * r };
    let near = Infinity;
    for (const s of G.snakes){ if (!s.alive) continue; const h = s.head(); near = Math.min(near, Math.hypot(h.x - p.x, h.y - p.y)); }
    if (near > bd){ bd = near; best = p; }
    if (near > 700) break;
  }
  return best;
}
function addBot(){
  const p = spawnPoint();
  // everyone at a table buys in at the same stake — a fair lobby
  const b = new Snake(p.x, p.y, G.tableStake, nextBotName(), botSkin(), false);
  b.mass = rand(10, 60);
  G.snakes.push(b);
  return b;
}

export function startRun(stake, skin){
  // fresh table: every bot buys in at the player's stake, no loose cash on the floor
  G.tableStake = stake;
  G.snakes = [];
  G.orbs = G.orbs.filter(o => o.kind === 'food');
  G.particles = []; G.floats = [];
  while (G.snakes.length < FIELD_SIZE - 1) addBot();
  const p = spawnPoint();
  const pl = new Snake(p.x, p.y, stake, 'You', skin, true);
  G.player = pl; G.snakes.push(pl);
  G.run = { stake, t0: G.t, kills: 0, eaten: 0, frenzy: 0, boostT: 0, peak: stake,
            combo: 0, lastKill: -99, wasKing: 0, kingNow: false, bestCombo: 0 };
  G.cashT = 0; G.shake = 0; G.event = null; G.eventT = rand(25, 40);
  G.input.boost = G.input.cash = false; G.input.angle = null;
  G.cam.x = p.x; G.cam.y = p.y;
  G.state = 'playing';
}

function runSummary(win, extra){
  const r = G.run, t = G.t - r.t0;
  return { win, stake: r.stake, kills: r.kills, eaten: r.eaten, frenzy: r.frenzy,
           boostT: r.boostT, time: t, peak: r.peak, king: r.wasKing,
           bestCombo: r.bestCombo, ...extra };
}

function kill(s, killer){
  if (!s.alive) return;
  s.alive = false;
  const h = s.head();
  burst(h.x, h.y, 24, s.skin.hue, false, 360);
  const cash = s.cash, wasKing = s === G.king;
  if (cash > 0.5) burst(h.x, h.y, 20, undefined, true, 280);
  spillCash(s); spillMass(s);

  if (killer && killer.isPlayer && !s.isPlayer && G.run) creditKill(s, cash, wasKing);
  if (s.isPlayer){
    G.state = 'ending'; G.endT = 1.1;
    G.result = runSummary(false, { killer: killer ? killer.name : null, nearMiss: G.cashT });
    G.shake = 16; G.flash = .35;
    sfx.death(); buzz([60, 40, 180]);
  } else if (G.state === 'playing' && G.hooks.feed && G.player && dist2(h, G.player.head()) < 1200 ** 2){
    G.hooks.feed(killer ? `${killer.isPlayer ? 'You' : killer.name} cut off ${s.name}` : `${s.name} hit the wall`, cash);
  }
}
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

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

export function cashOut(s){
  if (!s.alive) return;
  const gross = s.cash, fee = gross * RAKE, net = gross - fee;
  s.alive = false;
  const h = s.head();
  if (s.isPlayer){
    burst(h.x, h.y, 60, undefined, true, 420);
    G.state = 'ending'; G.endT = .8;
    G.result = runSummary(true, { gross, fee, net });
    sfx.cashout(); buzz([20, 40, 20, 40, 80]);
  }
  s.cash = 0;
  spillMass(s);   // length stays behind as free food; the money leaves with them
}

/* ============================================================
   Collisions + eating
   ============================================================ */
function collide(){
  for (const a of G.snakes){
    if (!a.alive) continue;
    const h = a.head(), ar = a.radius;
    if (Math.hypot(h.x, h.y) > WORLD_R - ar * 0.4){ kill(a, null); continue; }

    for (const b of G.snakes){
      if (b === a || !b.alive) continue;
      if (a.shield > 0 || b.shield > 0) continue;   // spawn protection works both ways
      const bh = b.head();
      const dh = Math.hypot(bh.x - h.x, bh.y - h.y);
      if (dh > b.length + ar + 40) continue;
      if (dh < ar + b.radius){ kill(a, b); kill(b, a); break; }   // head-on: both go
      let hit = false;
      const lim = (ar * 0.55 + b.radius) ** 2;
      for (let i = 2; i < b.segs.length; i++){
        const g = b.segs[i], dx = g.x - h.x, dy = g.y - h.y;
        if (dx * dx + dy * dy < lim){ hit = true; break; }
      }
      if (hit){ kill(a, b); break; }
    }
  }
}

function feed(dt){
  const orbs = G.orbs;
  for (const s of G.snakes){
    if (!s.alive) continue;
    const h = s.head(), pull = s.radius + 34, sr = s.radius;
    for (let i = orbs.length - 1; i >= 0; i--){
      const o = orbs[i], dx = h.x - o.x, dy = h.y - o.y;
      if (dx > pull || dx < -pull || dy > pull || dy < -pull) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 > pull * pull) continue;
      const d = Math.sqrt(d2) || 1;
      if (d < sr + o.r * .5){
        eat(s, o);
        orbs[i] = orbs[orbs.length - 1]; orbs.pop();
      } else {
        const f = 280 * dt / d;
        o.x += dx * f; o.y += dy * f;
      }
    }
  }
}

function eat(s, o){
  if (o.kind === 'cash'){
    s.cash += o.value;
    burst(o.x, o.y, 6, undefined, true, 130);
    if (s.isPlayer){
      cashPickupFloat(s.head(), o.value);
      G.shake = Math.min(G.shake + 1.5, 6);
      sfx.coin(o.value > 20); buzz(12);
      G.run.peak = Math.max(G.run.peak, s.cash);
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
   Frenzy events — a burst of mass somewhere on the map
   ============================================================ */
function spawnFrenzy(){
  const a = rand(0, TAU), r = rand(.2, .65) * WORLD_R;
  const x = Math.cos(a) * r, y = Math.sin(a) * r;
  for (let i = 0; i < 70; i++){
    const aa = rand(0, TAU), rr = Math.sqrt(Math.random()) * 260;
    G.orbs.push(makeOrb(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr, 7, 'frenzy', 190));
  }
  G.event = { x, y, t: 22 };
  sfx.frenzy();
  G.hooks.banner && G.hooks.banner('FRENZY', 'Mass surge on the map — follow the arrow', 'cyan');
}

/* ============================================================
   Step
   ============================================================ */
function stepWorld(dt, target){
  for (const s of G.snakes) if (s.alive && !s.isPlayer) s.think(dt);
  for (const s of G.snakes) if (s.alive) s.update(dt);
  collide();
  feed(dt);

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
  let alive = G.snakes.length;
  while (alive < target){ addBot(); alive++; }

  let food = 0;
  for (const o of G.orbs) if (o.kind === 'food') food++;
  if (food < TARGET_FOOD) seedFood(Math.min(8, TARGET_FOOD - food));

  // the richest snake wears the crown
  let king = null;
  for (const s of G.snakes) if (s.cash > 0 && (!king || s.cash > king.cash)) king = s;
  G.king = king;

  if (G.event){ G.event.t -= dt; if (G.event.t <= 0) G.event = null; }
}

function stepPlaying(dt){
  const p = G.player, r = G.run;
  if (G.input.angle !== null) p.targetAngle = G.input.angle;

  if (G.input.cash && p.shield <= 0){
    const before = G.cashT;
    G.cashT += dt;
    p.slow = .55; p.boosting = false;
    if (Math.floor(before * 4) !== Math.floor(G.cashT * 4)) sfx.cashTick(G.cashT / CASHOUT_TIME);
    if (G.cashT >= CASHOUT_TIME){ cashOut(p); }
  } else {
    G.cashT = Math.max(0, G.cashT - dt * 2.2);
    p.slow = 1;
    const was = p.boosting;
    p.boosting = G.input.boost && p.mass > 6;
    if (p.boosting && !was) sfx.boost();
  }
  if (p.boosting) r.boostT += dt;

  G.eventT -= dt;
  if (G.eventT <= 0){ G.eventT = rand(45, 70); spawnFrenzy(); }

  stepWorld(dt, FIELD_SIZE);

  if (G.state === 'playing'){
    const isKing = G.king === p;
    if (isKing && !r.kingNow){
      r.wasKing++;
      sfx.crown(); buzz([15, 30, 15]);
      G.hooks.banner && G.hooks.banner('YOU HOLD THE CROWN', 'Richest snake alive — everyone wants your wallet', 'gold');
    }
    r.kingNow = isKing;
    const h = p.head();
    G.danger = clamp((Math.hypot(h.x, h.y) - (WORLD_R - 420)) / 380, 0, 1);
  }
}

function followCam(dt){
  const p = G.player, h = p.head();
  const scale = clamp(Math.sqrt(W * H) / 950, .72, 1.05);
  const tz = clamp(30 / (p.radius + 20), 0.36, 1.05) * scale;
  G.zoom += (tz - G.zoom) * Math.min(1, dt * 2.5);
  G.cam.x += (h.x - G.cam.x) * Math.min(1, dt * 9);
  G.cam.y += (h.y - G.cam.y) * Math.min(1, dt * 9);
}

let ambA = Math.random() * TAU;
function driftCam(dt){
  ambA += dt * 0.03;
  const tx = Math.cos(ambA) * 520, ty = Math.sin(ambA * 0.82) * 380;
  const k = Math.min(1, dt * .6);
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
  const tz = .62 * clamp(Math.sqrt(W * H) / 950, .75, 1.05);
  G.zoom += (tz - G.zoom) * Math.min(1, dt * .8);
}

/* ============================================================
   Loop
   ============================================================ */
let last = 0;
function frame(now){
  let dt = Math.min(0.034, (now - last) / 1000 || 0);
  last = now;
  if (G.state === 'ending' && G.result && !G.result.win) dt *= .3;   // slow-mo death
  G.t += dt;

  if (G.state === 'playing'){ stepPlaying(dt); followCam(dt); }
  else if (G.state === 'ending'){
    stepWorld(dt, FIELD_SIZE); followCam(dt);
    G.endT -= dt / (G.result.win ? 1 : .3);
    if (G.endT <= 0){ G.state = 'over'; G.danger = 0; G.hooks.end && G.hooks.end(G.result); }
  } else { stepWorld(dt, G.state === 'over' ? FIELD_SIZE - 3 : AMBIENT_COUNT); driftCam(dt); }

  G.shake = Math.max(0, G.shake - dt * 22);
  G.flash = Math.max(0, G.flash - dt * 1.6);
  draw();
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

function makeHexPattern(){
  const a = 26, h = 45, c = document.createElement('canvas');
  c.width = a * 3; c.height = h;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(130,150,210,.075)'; g.lineWidth = 1.2;
  const hex = (cx, cy) => {
    g.beginPath();
    for (let i = 0; i < 6; i++){ const t = i * Math.PI / 3; g.lineTo(cx + Math.cos(t) * a, cy + Math.sin(t) * a); }
    g.closePath(); g.stroke();
  };
  [[0, 0], [a * 3, 0], [0, h], [a * 3, h], [a * 1.5, h / 2]].forEach(([x, y]) => hex(x, y));
  const p = ctx.createPattern(c, 'repeat');
  try { p.setTransform(new DOMMatrix().scale(2)); } catch {}
  return p;
}

function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  vignette = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .2, W / 2, H * .45, Math.max(W, H) * .75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(2,3,8,.6)');
}

function draw(){
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#03050a';
  ctx.fillRect(0, 0, W, H);

  const z = G.zoom, sh = G.shake;
  const sx = sh ? rand(-sh, sh) : 0, sy = sh ? rand(-sh, sh) : 0;
  ctx.save();
  ctx.translate(W / 2 + sx, H / 2 + sy);
  ctx.scale(z, z);
  ctx.translate(-G.cam.x, -G.cam.y);

  const hw = W / (2 * z), hh = H / (2 * z);
  const L = G.cam.x - hw, R = G.cam.x + hw, T = G.cam.y - hh, B = G.cam.y + hh;

  // arena floor
  ctx.beginPath(); ctx.arc(0, 0, WORLD_R, 0, TAU);
  ctx.fillStyle = '#0a0e1a'; ctx.fill();
  ctx.fillStyle = hexPattern; ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,77,.12)'; ctx.lineWidth = 60; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,90,77,.7)'; ctx.lineWidth = Math.max(4, 3 / z); ctx.stroke();

  // frenzy zone
  if (G.event){
    const e = G.event, a = Math.min(1, e.t / 3) * (.5 + .5 * Math.sin(G.t * 4));
    ctx.beginPath(); ctx.arc(e.x, e.y, 300, 0, TAU);
    ctx.strokeStyle = `rgba(56,225,255,${.25 * a})`; ctx.lineWidth = 4 / z;
    ctx.setLineDash([18 / z, 12 / z]); ctx.lineDashOffset = -G.t * 40; ctx.stroke(); ctx.setLineDash([]);
  }

  // orbs
  const now = G.t;
  for (const o of G.orbs){
    if (o.x < L - 40 || o.x > R + 40 || o.y < T - 40 || o.y > B + 40) continue;
    if (o.kind === 'cash'){
      const p = 1 + Math.sin(now * 4 + o.ph) * .14, s = o.r * 4.4 * p;
      ctx.drawImage(cashSprite(), o.x - s / 2, o.y - s / 2, s, s);
    } else if (o.kind === 'frenzy'){
      const p = 1 + Math.sin(now * 6 + o.ph) * .2, s = o.r * 4.4 * p;
      ctx.drawImage(frenzySprite(), o.x - s / 2, o.y - s / 2, s, s);
    } else {
      const p = 1 + Math.sin(now * 2.5 + o.ph) * .12, s = o.r * 4.2 * p;
      ctx.drawImage(foodSprite(o.hue), o.x - s / 2, o.y - s / 2, s, s);
    }
  }

  // snakes: others first, player on top
  for (const s of G.snakes) if (s.alive && !s.isPlayer && inView(s, L, R, T, B)) drawSnake(s);
  if (G.player && G.player.alive) drawSnake(G.player);

  // particles
  for (const p of G.particles){
    const k = 1 - p.age / p.life;
    if (p.gold){
      const s = p.r * 4 * k; ctx.drawImage(cashSprite(), p.x - s / 2, p.y - s / 2, s, s);
    } else {
      ctx.globalAlpha = k; ctx.fillStyle = `hsl(${p.hue} 80% 65%)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // floating text
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
  ctx.restore();

  // screen-space overlays
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  if (G.danger > 0){
    const a = G.danger * (.35 + .15 * Math.sin(G.t * 10));
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7);
    g.addColorStop(0, 'rgba(255,40,40,0)'); g.addColorStop(1, `rgba(255,40,40,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (G.flash > 0){ ctx.fillStyle = `rgba(255,255,255,${G.flash * .35})`; ctx.fillRect(0, 0, W, H); }

  if (G.state === 'playing'){
    if (G.king && G.king !== G.player) edgeArrow(G.king.head(), '#f7c14b', fmt(G.king.cash), true);
    if (G.event) edgeArrow(G.event, '#38e1ff', 'FRENZY', false);
    drawMinimap();
  }
}

function inView(s, L, R, T, B){
  const h = s.head(), pad = s.length + 60;
  return h.x > L - pad && h.x < R + pad && h.y > T - pad && h.y < B + pad;
}

function drawSnake(s){
  const p = s.segs;
  if (p.length < 2) return;
  const r = s.radius, sk = s.skin, t = G.t, z = G.zoom;

  const path = new Path2D();
  path.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) path.lineTo(p[i].x, p[i].y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (s.boosting || sk.kind === 'glow'){
    ctx.strokeStyle = sk.glow || sk.a;
    ctx.globalAlpha = s.boosting ? .3 : .16 + .05 * Math.sin(t * 3);
    ctx.lineWidth = r * 2 + (s.boosting ? 18 : 14); ctx.stroke(path);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = sk.dark; ctx.lineWidth = r * 2 + 4; ctx.stroke(path);

  for (let i = p.length - 1; i >= 1; i--){
    ctx.fillStyle = segColor(sk, i, t);
    ctx.beginPath(); ctx.arc(p[i].x, p[i].y, r, 0, TAU); ctx.fill();
  }
  // sheen
  ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = r * .8; ctx.stroke(path);

  // wallet: gold studs on the body — richer snakes glitter more
  const rich = clamp(s.cash / 300, 0, 1);
  if (rich > .02){
    const every = Math.max(2, Math.round(7 - rich * 5)), gs = r * (1.1 + rich * .6);
    const img = cashSprite();
    for (let i = 3; i < p.length; i += every) ctx.drawImage(img, p[i].x - gs / 2, p[i].y - gs / 2, gs, gs);
  }

  // head
  const h = p[0], a = s.angle;
  ctx.fillStyle = segColor(sk, 0, t);
  ctx.beginPath(); ctx.arc(h.x, h.y, r * 1.08, 0, TAU); ctx.fill();
  const look = s.isPlayer && G.input.angle !== null ? G.input.angle : a;
  for (const side of [-1, 1]){
    const ex = h.x + Math.cos(a) * r * .42 + Math.cos(a + side * Math.PI / 2) * r * .5;
    const ey = h.y + Math.sin(a) * r * .42 + Math.sin(a + side * Math.PI / 2) * r * .5;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex, ey, r * .34, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0d16';
    ctx.beginPath(); ctx.arc(ex + Math.cos(look) * r * .14, ey + Math.sin(look) * r * .14, r * .18, 0, TAU); ctx.fill();
  }

  // spawn shield
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

  // cash-out ring
  if (s.isPlayer && G.cashT > 0.02){
    const k = Math.min(1, G.cashT / CASHOUT_TIME), rr = r * 2.3 + 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(247,193,75,.18)'; ctx.lineWidth = 6 / z;
    ctx.beginPath(); ctx.arc(h.x, h.y, rr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#f7c14b';
    ctx.beginPath(); ctx.arc(h.x, h.y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
  }

  // labels
  const fs = 13 / z;
  let y = h.y - r * 1.1 - 8 / z;
  ctx.textAlign = 'center';
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

function edgeArrow(pos, color, label, crown){
  const z = G.zoom;
  const x = (pos.x - G.cam.x) * z + W / 2, y = (pos.y - G.cam.y) * z + H / 2;
  const m = 46;
  if (x > m && x < W - m && y > m + 40 && y < H - m) return;
  const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy;
  const k = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m - 20) / Math.abs(dy || 1e-6));
  const ax = cx + dx * k, ay = cy + dy * k, ang = Math.atan2(dy, dx);
  const pulse = 1 + Math.sin(G.t * 6) * .08;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.save(); ctx.rotate(ang); ctx.scale(pulse, pulse);
  ctx.fillStyle = color; ctx.globalAlpha = .95;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, -11); ctx.lineTo(-2, 0); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fill();
  ctx.restore();
  const lx = -Math.cos(ang) * 30, ly = -Math.sin(ang) * 30;
  if (crown) drawCrown(lx, ly - 16, 7);
  ctx.font = '700 11px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.fillStyle = color;
  ctx.fillText(label, lx, ly + 4);
  ctx.restore();
}

function drawMinimap(){
  const size = W < 600 ? 78 : 104, pad = 14;
  const cx = pad + size / 2, cy = H - size / 2 - pad - (W < 600 ? 0 : 0);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, TAU);
  ctx.fillStyle = 'rgba(8,11,20,.7)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,77,.35)'; ctx.lineWidth = 1; ctx.stroke();
  const k = (size / 2 - 4) / WORLD_R;
  if (G.event){ ctx.fillStyle = 'rgba(56,225,255,.5)'; ctx.beginPath(); ctx.arc(cx + G.event.x * k, cy + G.event.y * k, 5, 0, TAU); ctx.fill(); }
  for (const s of G.snakes){
    if (!s.alive) continue;
    const h = s.head();
    ctx.beginPath();
    const r = s.isPlayer ? 3.4 : s === G.king ? 3.2 : 1.8;
    ctx.arc(cx + h.x * k, cy + h.y * k, r, 0, TAU);
    ctx.fillStyle = s.isPlayer ? '#ffffff' : s === G.king ? '#f7c14b' : 'rgba(170,180,210,.5)';
    ctx.fill();
  }
  ctx.restore();
}

/* ============================================================
   Public
   ============================================================ */
export function initGame(canvas){
  cv = canvas; ctx = cv.getContext('2d');
  hexPattern = makeHexPattern();
  resize();
  addEventListener('resize', resize);
  seedFood(TARGET_FOOD);
  while (G.snakes.length < AMBIENT_COUNT) addBot();
  // pre-warm so the menu opens on a lived-in arena
  for (let i = 0; i < 120; i++) stepWorld(1 / 30, AMBIENT_COUNT);
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
}

export function toMenu(){ G.state = 'menu'; G.player = null; G.run = null; }
export const viewport = () => ({ W, H });
