/* ============================================================
   Cashcoil — screens, HUD, input, meta-progression
   ============================================================ */
import { STAKES, SKINS, RAKE, CASHOUT_TIME, REFILL, DAILY_LADDER, xpForLevel, GEM_XP, DISCOVER_XP, CHEST_XP } from './config.js';
import { P, save, stake, shiftStake, addXP, levelProgress, skinUnlocked, dailyReady, dailyPreview,
         claimDaily, streak, missions, missionDef, missionReward, missionsClaimable, trackMissions,
         claimMission, msToMidnight } from './store.js';
import { G, initGame, startRun, startJourney, runSnapshot, toMenu, segColor, fmt, meters, minimapRect } from './game.js';
import { initStory, begin as storyBegin, tick as storyTick, onEvent as storyEvent, questText, checkpoint,
         SPEAKERS, PROLOGUE, SCALE_KEYS } from './story.js';
import { world, REGIONS, REG, drawMap, HALF } from './world.js';
import { sfx, buzz, unlockAudio } from './fx.js';

const $ = id => document.getElementById(id);
const cv = $('game');
const els = {
  home: $('home'), hud: $('hud'), result: $('result'), res: $('res'),
  coins: $('hCoins'), bal: $('hBal'), lvl: $('hLvl'), ring: $('hLvlRing'), streak: $('hStreak'),
  daily: $('hDaily'), stVal: $('stVal'), stHint: $('stHint'), stDown: $('stDown'), stUp: $('stUp'),
  play: $('play'), mDot: $('mDot'),
  wCash: $('wCash'), wMult: $('wMult'), wNet: $('wNet'), board: $('board'), banner: $('banner'),
  killpop: $('killpop'), feed: $('feed'), shieldTag: $('shieldTag'), shieldT: $('shieldT'),
  joy: $('joy'), knob: $('knob'), bCash: $('bCash'), bBoost: $('bBoost'), cashRing: $('cashRing'),
  region: $('regionTag'), ticker: $('ticker'), cashLbl: $('cashLbl'), mapov: $('mapov'), mapCv: $('mapCv'), mapInfo: $('mapInfo'),
  quest: $('quest'), gTimer: $('gTimer'), pauseBtn: $('pauseBtn'), hJourney: $('hJourney'), hStake: $('hStake'),
  dialog: $('dialog'), dFace: $('dFace'), dName: $('dName'), dText: $('dText'),
  sheet: $('sheet'), sheetCard: $('sheetCard'), scrim: $('scrim'), modal: $('modal'), toasts: $('toasts'),
};

const TOUCH = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (TOUCH) document.body.classList.add('touch');

const ICON = {
  gift: `<svg viewBox="0 0 48 48"><rect x="7" y="19" width="34" height="23" rx="4" fill="#ff5a4d"/><rect x="5" y="13" width="38" height="9" rx="3" fill="#ff7a6f"/><rect x="21" y="13" width="6" height="29" fill="#f7c14b"/><path d="M24 13c-3-7-12-8-11-2 1 4 11 2 11 2zm0 0c3-7 12-8 11-2-1 4-11 2-11 2z" fill="none" stroke="#f7c14b" stroke-width="3"/></svg>`,
  flame: `<svg viewBox="0 0 24 24"><path d="M12 2c1 4 6 6 6 12a6 6 0 01-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></svg>`,
  star: `<svg viewBox="0 0 48 48"><path d="M24 4l6 13 14 1.5-10.5 9.5 3 14L24 35l-12.5 7 3-14L4 18.5 18 17z" fill="#5df2c0"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="#7d87a2" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
};

/* ============================================================
   Helpers
   ============================================================ */
function countUp(el, from, to, dur = 900, prefix = ''){
  const t0 = performance.now();
  const tick = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = prefix + fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function hms(ms){
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}
function mmss(s){ s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function toast(html, kind = ''){
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.innerHTML = html;
  els.toasts.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2600);
}

function flyCoins(fromEl, n = 12){
  const a = fromEl.getBoundingClientRect(), b = els.bal.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  const bx = b.left + 22, by = b.top + b.height / 2;
  for (let i = 0; i < n; i++){
    const c = document.createElement('i');
    c.className = 'coin fly';
    c.style.left = ax - 9 + 'px'; c.style.top = ay - 9 + 'px';
    document.body.appendChild(c);
    const ox = (Math.random() - .5) * 140, oy = (Math.random() - .5) * 100 - 40;
    c.animate([
      { transform: 'translate(0,0) scale(.6)', opacity: 0 },
      { transform: `translate(${ox}px,${oy}px) scale(1.2)`, opacity: 1, offset: .35 },
      { transform: `translate(${bx - ax}px,${by - ay}px) scale(.7)`, opacity: 1 },
    ], { duration: 750 + i * 35, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' })
     .onfinish = () => { c.remove(); if (i % 3 === 0) sfx.tick(); };
  }
  setTimeout(() => { els.bal.classList.remove('bump'); void els.bal.offsetWidth; els.bal.classList.add('bump'); }, 800);
}

/* ============================================================
   HOME
   ============================================================ */
let shownCoins = P.coins;
function renderHome(animateCoins = false){
  if (animateCoins && shownCoins !== P.coins) countUp(els.coins, shownCoins, P.coins, 1100);
  else els.coins.textContent = fmt(P.coins);
  shownCoins = P.coins;

  els.lvl.textContent = P.level;
  els.ring.style.strokeDashoffset = 119.4 * (1 - levelProgress());

  const st = streak();
  els.streak.innerHTML = st > 0 ? `${ICON.flame}${st}` : '';
  els.streak.classList.toggle('on', st > 0);

  renderDaily();

  const s = stake();
  els.stVal.textContent = fmt(s);
  els.stHint.textContent = `house fee ${Math.round(RAKE * 100)}% on cash-out`;
  els.stDown.disabled = P.stakeIdx === 0;
  els.stUp.disabled = P.stakeIdx === STAKES.length - 1;

  const journey = P.mode === 'journey';
  document.querySelectorAll('#hModes button').forEach(b => b.classList.toggle('on', b.dataset.mode === P.mode));
  els.hStake.classList.toggle('hidden', journey);
  els.hJourney.classList.toggle('hidden', !journey);
  $('hTag').textContent = journey ? 'journey of the nine scales' : 'eat · cut · cash out';
  if (journey){
    const q = questText(), S = P.story;
    els.hJourney.innerHTML = `
      <small>${S.prologue ? q.chapter : 'Prologue'}</small>
      <b>${S.prologue ? q.title : 'An egg in the Nest'}</b>
      <span>${S.prologue ? q.text + (q.prog ? ' · ' + q.prog : '') : 'A small egg is about to crack…'}</span>
      ${pipsHTML()}`;
    els.play.classList.remove('refill');
    els.play.firstElementChild.textContent = S.done ? 'FREE ROAM' : S.prologue ? 'CONTINUE' : 'BEGIN JOURNEY';
  } else {
    const broke = P.coins < STAKES[0];
    els.play.classList.toggle('refill', broke);
    els.play.firstElementChild.textContent = broke ? `FREE REFILL +${REFILL}` : P.coins < s ? 'LOWER STAKE' : 'PLAY';
  }

  $('mDotMap').textContent = `${P.discovered.length}/${REGIONS.length}`;
  const n = missionsClaimable();
  els.mDot.textContent = n;
  els.mDot.classList.toggle('on', n > 0);
}

function renderDaily(){
  if (dailyReady()){
    const d = dailyPreview();
    els.daily.className = 'daily ready';
    els.daily.innerHTML = `${ICON.gift}<span>Day ${d.day} reward · <b>${fmt(d.coins)}</b></span>`;
  } else {
    els.daily.className = 'daily';
    els.daily.innerHTML = `${ICON.clock}<span>Next reward in ${hms(msToMidnight())}</span>`;
  }
}
setInterval(() => { if (G.state === 'menu') renderDaily(); }, 30000);

function showHome(){
  toMenu();
  document.body.classList.remove('journey');
  if (dlg){ clearInterval(dlg.iv); dlg = null; els.dialog.classList.add('hidden'); }
  els.result.classList.add('hidden');
  els.hud.classList.add('hidden');
  els.home.classList.remove('hidden');
  cv.classList.add('dim');
  renderHome(true);
  // pop the daily reward the moment you land, once
  if (dailyReady() && !showHome.offered){ showHome.offered = true; setTimeout(openDaily, 650); }
}

function changeStake(dir){
  const before = P.stakeIdx;
  shiftStake(dir);
  if (before === P.stakeIdx){ sfx.deny(); return; }
  sfx.tap(); buzz(8);
  const v = els.stVal.parentElement;
  v.classList.remove('flip'); void v.offsetWidth; v.classList.add('flip');
  renderHome();
}
els.stDown.onclick = () => changeStake(-1);
els.stUp.onclick   = () => changeStake(1);
// swipe the stake left/right
{
  let sx = null;
  $('hStake').addEventListener('pointerdown', e => { sx = e.clientX; });
  $('hStake').addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 36) changeStake(dx < 0 ? 1 : -1);
  });
}

document.querySelectorAll('#hModes button').forEach(b => b.onclick = () => {
  if (P.mode === b.dataset.mode) return;
  P.mode = b.dataset.mode; save(); sfx.tap(); buzz(8); renderHome();
});

els.play.onclick = () => {
  unlockAudio();
  if (P.mode === 'journey'){ beginJourney(); return; }
  if (P.coins < STAKES[0]){
    P.coins += REFILL; save(); sfx.claim(); flyCoins(els.play, 10);
    setTimeout(() => renderHome(true), 700);
    return;
  }
  if (P.coins < stake()){
    while (P.stakeIdx > 0 && STAKES[P.stakeIdx] > P.coins) P.stakeIdx--;
    save(); sfx.deny(); renderHome(); return;
  }
  beginRun();
};

els.daily.onclick = () => { unlockAudio(); if (dailyReady()) openDaily(); else sfx.deny(); };
document.querySelectorAll('.dock button').forEach(b => b.onclick = () => { unlockAudio(); sfx.tap(); openSheet(b.dataset.sheet); });
$('hLevel').onclick = () => { unlockAudio(); sfx.tap(); openSheet('profile'); };

/* ============================================================
   JOURNEY
   ============================================================ */
const SCALE_HUE = { nest: 44, tundra: 196, caves: 280, neon: 320, magma: 18, ruins: 40, wild: 110, marsh: 170, desert: 30 };
const pipsHTML = () => `<div class="pips">${SCALE_KEYS.map(k => `<i class="${P.story.scales.includes(k) ? 'on' : ''}" style="--h:${SCALE_HUE[k]}"></i>`).join('')}</div>`;
const FALL_LINES = [
  ['moss', 'Up you get, little one. Scales don’t carry themselves.'],
  ['moss', 'Every great serpent fell a hundred times. You’re at… let’s not count.'],
  ['moss', 'Shake it off. The island is patient — mostly.'],
  ['moss', 'That looked painful. Try going around it next time?'],
];

initStory(P.story, {
  save,
  banner: (a, b, k) => banner(a, b, k),
  quest: () => renderQuest(),
  timer: t => {
    els.gTimer.classList.toggle('on', t !== null && t !== undefined);
    if (t !== null && t !== undefined){ els.gTimer.textContent = Math.max(0, t).toFixed(1) + 's'; els.gTimer.classList.toggle('low', t < 10); }
  },
  dialog: (lines, cb) => dialog(lines, cb),
  scale: (ch, n) => {
    sfx.levelup(); buzz([30, 50, 30, 50, 120]);
    banner(`SCALE ${n} / 9`, `${REG[ch.region].name} Scale restored · +250 XP`, 'gold');
    const ups = addXP(250);
    ups.forEach(u => toast(`<b>LEVEL ${u.level}</b> · +${fmt(u.coins)} coins${u.skin ? ` · ${u.skin.name} skin unlocked` : ''}`, 'gold'));
    renderQuest();
  },
  finale: () => showFinale(),
});

let deadMass = 12;
function beginJourney(){
  unlockAudio();
  closeSheet();
  els.home.classList.add('hidden');
  els.result.classList.add('hidden');
  els.hud.classList.remove('hidden');
  document.body.classList.add('journey');
  cv.classList.remove('dim');
  els.feed.innerHTML = ''; els.killpop.innerHTML = '';
  runNew = [];
  P.stats.games++; save();
  const skin = SKINS.find(s => s.id === P.skin) || SKINS[0];
  startJourney(skin, checkpoint(), P.story.mass);
  storyBegin();
  G.showChestTip = true;
  renderQuest();
  sfx.tap(); buzz(15);
  if (!P.story.prologue){
    P.story.prologue = true; save();
    dialog(PROLOGUE);
    if (TOUCH) setTimeout(() => banner('DRAG TO STEER', 'Tap ⚡ to sprint · tap the minimap for the map', 'gold'), 200);
  }
}

function renderQuest(){
  const q = questText();
  if (!q) return;
  els.quest.innerHTML = `<small>${q.chapter} · ${q.title}</small><b>${q.text}</b>${q.prog ? `<em>${q.prog}</em>` : ''}${pipsHTML()}`;
}

/* flush a life's worth of XP + mission progress */
function flushJourney(){
  const r = runSnapshot();
  if (!r) return { xp: 0, ups: [], done: [] };
  const xp = Math.round(r.eaten * .4 + r.frenzy + r.kills * 35 + r.gems * GEM_XP + r.chests * CHEST_XP + r.jackpots * 10 + runNew.length * DISCOVER_XP);
  const st = P.stats;
  st.kills += r.kills; st.chests = (st.chests || 0) + r.chests; st.bestTime = Math.max(st.bestTime, r.time);
  const done = trackMissions({ eat: r.eaten, kills: r.kills, survive: r.time, boost: r.boostT, frenzy: r.frenzy, regions: r.regions,
    chests: r.chests, vault: r.vault, portals: r.portals, jackpots: r.jackpots, gems: r.gems });
  const ups = addXP(xp);
  runNew = [];
  Object.assign(G.run, { kills: 0, eaten: 0, frenzy: 0, boostT: 0, gems: 0, vault: 0, chests: 0, portals: 0, jackpots: 0, t0: G.t, regions: new Set() });
  return { xp, ups, done };
}

function showFall(r){
  els.hud.classList.add('hidden');
  els.mapov.classList.add('hidden');
  els.joy.classList.remove('on');
  G.input.boost = G.input.cash = false;
  P.story.mass = Math.max(12, Math.round(deadMass * .5));
  const f = flushJourney();
  save();
  const why = r.cause === 'the Dune Leviathan' ? 'The Dune Leviathan swallowed you whole.'
    : r.killer ? `<b>${r.killer}</b> cut you off.`
    : r.cause === 'the lava' ? 'You slid into the lava.'
    : r.cause === 'the deep water' ? 'The deep water pulled you under.' : 'You fell.';
  const [who, line] = FALL_LINES[(Math.random() * FALL_LINES.length) | 0];
  const cp = REG[P.story.cp || 'nest'];
  els.res.className = 'res lose journeyres';
  els.res.innerHTML = `
    <div class="kicker">YOU FELL</div>
    <p class="line" style="margin-top:14px">${why}</p>
    <div class="say"><i>${SPEAKERS[who].glyph}</i><span><b>${SPEAKERS[who].name}</b>${line}</span></div>
    <div class="xp">
      <div class="xl"><span>Level ${P.level}</span><b>+${f.xp} XP</b></div>
      <div class="tr"><div class="fl" style="width:${levelProgress() * 100}%"></div></div>
    </div>
    ${f.done.length ? `<div class="mdone">${f.done.map(m => `<div>✓ Mission complete — ${missionDef(m).text(m.n)}</div>`).join('')}</div>` : ''}
    <button class="btn gold" id="rAgain">WAKE AT ${cp.name.toUpperCase()}</button>
    <button class="btn ghost" id="rHome">HOME</button>`;
  els.result.classList.remove('hidden');
  cv.classList.add('dim');
  if (f.ups.length) setTimeout(() => showLevelUps(f.ups), 900);
  $('rAgain').onclick = () => { unlockAudio(); beginJourney(); };
  $('rHome').onclick = () => { sfx.tap(); showHome(); };
}

function leaveJourney(){
  if (G.player && G.player.alive) P.story.mass = Math.max(12, Math.round(G.player.mass));
  const f = flushJourney();
  save();
  closeModal();
  showHome();
  if (f.ups.length) setTimeout(() => showLevelUps(f.ups), 700);
}

function openPause(){
  if (G.mode !== 'journey' || G.state !== 'playing' || dlg) return;
  G.paused = true; sfx.tap();
  const q = questText();
  openModal(`
    <div class="k">PAUSED</div>
    <h3>${q.title}</h3>
    <p>${q.text}${q.prog ? ' · ' + q.prog : ''}</p>
    ${pipsHTML()}
    <button class="btn gold" id="pResume">RESUME</button>
    <button class="btn ghost" id="pMap">MAP</button>
    <button class="btn ghost" id="pHome">SAVE &amp; HOME</button>`, m => {
    m.querySelector('#pResume').onclick = () => { closeModal(); G.paused = false; };
    m.querySelector('#pMap').onclick = () => { closeModal(); openMapOverlay(); };
    m.querySelector('#pHome').onclick = () => leaveJourney();
  });
}
els.pauseBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); openPause(); });

function showFinale(){
  const f = flushJourney();
  const ups = addXP(1000);
  save();
  sfx.levelup(); setTimeout(() => sfx.jackpot(), 400); buzz([40, 60, 40, 60, 200]);
  G.paused = true;
  const ouro = SKINS.find(s => s.id === 'ouro');
  openModal(`
    <div class="ico">${ICON.star}</div>
    <div class="k">THE END</div>
    <h3>The island is whole</h3>
    <p>Nine Scales, carried home by the smallest snake on the island. Ouro sleeps soundly again.<br><br>+1,000 XP · the <b style="color:#ffd76a">Ouro</b> skin is yours.</p>
    <canvas id="ouroSkin" style="position:static;width:100%;height:70px;margin:-6px 0 14px"></canvas>
    <button class="btn gold" id="fEquip">WEAR OURO’S GOLD</button>
    <button class="btn ghost" id="fRoam">KEEP EXPLORING</button>`, m => {
    drawSkinPreview(m.querySelector('#ouroSkin'), ouro);
    const done = () => { closeModal(); G.paused = false; G.ouro = null; renderQuest(); if (ups.length || f.ups.length) setTimeout(() => showLevelUps([...f.ups, ...ups]), 400); };
    m.querySelector('#fEquip').onclick = () => { P.skin = 'ouro'; save(); if (G.player) G.player.skin = ouro; done(); };
    m.querySelector('#fRoam').onclick = done;
  });
}

/* ---------- dialogue ---------- */
let dlg = null;
function dialog(lines, cb){
  G.paused = true;
  G.input.boost = G.input.cash = false;
  els.joy.classList.remove('on');
  dlg = { lines, i: 0, cb, n: 0, full: '', iv: null };
  els.dialog.classList.remove('hidden');
  showLine();
}
function showLine(){
  const [who, text] = dlg.lines[dlg.i], sp = SPEAKERS[who];
  els.dFace.textContent = sp.glyph;
  els.dFace.style.setProperty('--c', sp.color);
  els.dName.textContent = sp.name; els.dName.style.color = sp.color;
  dlg.full = text; dlg.n = 0; els.dText.textContent = '';
  clearInterval(dlg.iv);
  dlg.iv = setInterval(() => {
    if (!dlg) return;
    dlg.n = Math.min(dlg.full.length, dlg.n + 2);
    els.dText.textContent = dlg.full.slice(0, dlg.n);
    if (dlg.n % 6 === 0) sfx.tick();
    if (dlg.n >= dlg.full.length) clearInterval(dlg.iv);
  }, 22);
}
function advanceDialog(){
  if (!dlg) return;
  if (dlg.n < dlg.full.length){ dlg.n = dlg.full.length; els.dText.textContent = dlg.full; clearInterval(dlg.iv); return; }
  dlg.i++;
  if (dlg.i >= dlg.lines.length){
    clearInterval(dlg.iv);
    const cb = dlg.cb; dlg = null;
    els.dialog.classList.add('hidden');
    G.paused = false;
    cb && cb();
  } else { sfx.tap(); showLine(); }
}
els.dialog.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); unlockAudio(); advanceDialog(); });

/* ============================================================
   RUN
   ============================================================ */
let runStake = 0;
function beginRun(){
  document.body.classList.remove('journey');
  runStake = stake();
  P.coins -= runStake;
  P.stats.games++;
  save();
  closeSheet();
  els.home.classList.add('hidden');
  els.result.classList.add('hidden');
  els.hud.classList.remove('hidden');
  cv.classList.remove('dim');
  els.feed.innerHTML = ''; els.killpop.innerHTML = '';
  lastCash = runStake; boardT = 0;
  els.wCash.textContent = fmt(runStake);
  startRun(runStake, SKINS.find(s => s.id === P.skin) || SKINS[0]);
  sfx.tap(); buzz(15);
  runNew = [];
  G.showChestTip = (P.stats.chests || 0) < 2;
  if (P.stats.games <= 3){
    setTimeout(() => banner(TOUCH ? 'DRAG TO STEER' : 'MOUSE TO STEER',
      TOUCH ? 'Tap ⚡ to sprint · steal wallets · bank them at a BANK' : 'Click to sprint · steal wallets · bank them at a BANK', 'gold'), 400);
    setTimeout(() => banner('CASH OUT AT A BANK', 'Follow the gold arrow — hold CASH OUT inside the ring', 'gold'), 4200);
  }
}

/* ---------- HUD ---------- */
let lastCash = 0, boardT = 0, bannerTO = null, lastLbl = '', tickT = 0, runNew = [], regionTO = null;
function hudFrame(dt){
  if (G.state !== 'playing' && G.state !== 'ending') return;
  const p = G.player;
  if (!p) return;
  if (G.mode === 'journey'){
    if (p.alive) deadMass = p.mass;
    storyTick(dt);
    els.shieldTag.classList.toggle('on', p.alive && p.shield > 0);
    if (p.shield > 0) els.shieldT.textContent = p.shield.toFixed(1);
    return;
  }

  const cash = p.alive ? p.cash : 0;
  if (Math.floor(cash) !== Math.floor(lastCash)){
    els.wCash.textContent = fmt(cash);
    if (cash > lastCash){ const w = els.wCash.parentElement; w.classList.remove('pulse'); void w.offsetWidth; w.classList.add('pulse'); }
  }
  lastCash = cash;
  const m = cash / runStake;
  els.wMult.textContent = m.toFixed(2) + '×';
  els.wMult.className = 'mult ' + (m >= 2 ? 'hot' : m >= 1.05 ? 'up' : m < .95 ? 'down' : '');
  els.wNet.textContent = fmt(cash * (1 - RAKE));

  els.shieldTag.classList.toggle('on', p.alive && p.shield > 0);
  if (p.shield > 0) els.shieldT.textContent = p.shield.toFixed(1);

  const k = Math.min(1, G.cashT / CASHOUT_TIME);
  els.cashRing.style.strokeDashoffset = 226.2 * (1 - k);
  const inBank = !!G.bankIn;
  els.bCash.classList.toggle('locked', p.shield > 0 || !inBank);
  els.bCash.classList.toggle('ready', inBank && p.shield <= 0);
  const lbl = inBank ? 'HOLD<br><b>CASH OUT</b>' : `BANK<br><b>${G.bankNear ? meters(G.bankDist) : '—'}</b>`;
  if (lbl !== lastLbl){ els.cashLbl.innerHTML = lbl; lastLbl = lbl; }

  tickT -= dt;
  if (tickT <= 0){
    tickT = .25;
    const v = world.vault;
    const vt = v.state === 'open' ? `<b class="open">VAULT OPEN · ${Math.ceil(v.t)}s</b>`
             : `Vault opens in <b>${Math.floor(v.t / 60)}:${String(Math.ceil(v.t) % 60).padStart(2, '0')}</b>`;
    const night = G.night > .5 ? ' · <span class="nt">night</span>' : '';
    els.ticker.innerHTML = vt + night;
  }

  boardT -= dt;
  if (boardT <= 0){
    boardT = .3;
    const alive = G.snakes.filter(s => s.alive && !s.isBoss).sort((a, b) => b.cash - a.cash);
    const top = alive.slice(0, 5), rank = alive.indexOf(p) + 1;
    const dot = s => s.skin.kind === 'rainbow' ? 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' : s.skin.a;
    els.board.innerHTML = top.map((s, i) => `<div class="row ${s.isPlayer ? 'me' : ''}"><i style="background:${dot(s)}"></i><span>${s === G.king ? '👑 ' : ''}${s.isPlayer ? 'You' : s.name}</span><b>${fmt(s.cash)}</b></div>`).join('')
      + (rank > 5 ? `<div class="rank">you're #${rank} · <b style="color:#fff">${fmt(p.cash)}</b></div>` : '');
  }
}

function banner(title, sub, kind = 'gold'){
  const b = els.banner;
  b.className = 'banner ' + kind;
  b.querySelector('b').textContent = title;
  b.querySelector('small').textContent = sub || '';
  requestAnimationFrame(() => b.classList.add('on'));
  clearTimeout(bannerTO);
  bannerTO = setTimeout(() => b.classList.remove('on'), 3000);
}

G.hooks.banner = banner;
G.hooks.frame = hudFrame;
G.hooks.kill = k => {
  els.killpop.innerHTML = `<div><b>${k.word}</b><small>${k.king ? '👑 Dethroned ' : ''}${k.name} spilled ${fmt(k.cash)}</small></div>`;
};
G.hooks.feed = (text, cash, news) => {
  const d = document.createElement('div');
  if (news) d.className = 'news';
  d.innerHTML = `${text}${cash > 1 ? ` · <b>${fmt(cash)}</b>` : ''}`;
  els.feed.prepend(d);
  while (els.feed.children.length > 3) els.feed.lastChild.remove();
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 500); }, 4000);
};
G.hooks.end = r => G.mode === 'journey' ? showFall(r) : showResult(r);
G.hooks.eat = o => storyEvent('eat', o);
G.hooks.chest = c => storyEvent('chest', c);
G.hooks.jackpot = win => storyEvent('jackpot', win);
G.hooks.died = (s, killer, cause, h) => storyEvent('died', s, h);
G.hooks.story = (kind, o) => storyEvent('story', kind, o);
G.hooks.region = R => {
  const first = !P.discovered.includes(R.key);
  els.region.innerHTML = `<i>${R.icon}</i>${R.name}`;
  els.region.classList.remove('on'); void els.region.offsetWidth; els.region.classList.add('on');
  clearTimeout(regionTO);
  regionTO = setTimeout(() => els.region.classList.remove('on'), 3500);
  if (first){
    P.discovered.push(R.key); save();
    runNew.push(R.key);
    sfx.discover(); buzz([20, 40, 20]);
    banner('NEW REGION DISCOVERED', `${R.name} · +${DISCOVER_XP} XP · ${P.discovered.length}/${REGIONS.length} explored`, 'mint');
  }
};

/* ============================================================
   RESULT
   ============================================================ */
function showResult(r){
  els.hud.classList.add('hidden');
  els.mapov.classList.add('hidden');
  els.joy.classList.remove('on');
  G.input.boost = G.input.cash = false;
  els.bBoost.classList.remove('on'); els.bCash.classList.remove('on');

  // payout + stats
  const net = r.win ? r.net : 0;
  P.coins += net;
  const st = P.stats;
  st.kills += r.kills;
  if (r.win){ st.cashouts++; st.earned += Math.max(0, net - r.stake); st.bestCash = Math.max(st.bestCash, net); st.bestMult = Math.max(st.bestMult, net / r.stake); }
  st.bestKills = Math.max(st.bestKills, r.kills);
  st.bestTime = Math.max(st.bestTime, r.time);
  save();

  st.chests = (st.chests || 0) + r.chests;
  const xp = Math.round(r.eaten * .4 + r.frenzy + r.kills * 35 + (r.bestCombo > 1 ? r.bestCombo * 15 : 0)
    + r.time * .6 + r.king * 40 + (r.win ? 50 + Math.max(0, net / r.stake - 1) * 60 : 0)
    + r.gems * GEM_XP + r.chests * CHEST_XP + runNew.length * DISCOVER_XP);
  save();
  const lvlBefore = P.level, progBefore = levelProgress();

  const completed = trackMissions({
    eat: r.eaten, kills: r.kills, cashouts: r.win ? 1 : 0, mult: r.win ? net / r.stake : 0,
    survive: r.time, king: r.king, boost: r.boostT, frenzy: r.frenzy,
    regions: r.regions, chests: r.chests, vault: r.vault, portals: r.portals, jackpots: r.jackpots, gems: r.gems,
  });
  const ups = addXP(xp);

  const win = r.win;
  const mult = win ? net / r.stake : 0;
  let line, near = '';
  if (win){
    const d = net - r.stake;
    line = d >= 0 ? `Banked at <b>${r.bank}</b> — <b>${fmt(d)}</b> up on a ${fmt(r.stake)} stake.`
                  : `Banked ${fmt(net)} of your ${fmt(r.stake)} stake — live to fight again.`;
  } else {
    line = r.cause === 'the Dune Leviathan' ? `The <b>Dune Leviathan</b> swallowed you whole. Your wallet is in the sand.`
         : r.killer ? `<b>${r.killer}</b> cut you off. Your wallet is on the floor — someone's already eating it.`
         : r.cause === 'the lava' ? `You slid into <b>lava</b>. Your wallet spilled on the rocks.`
         : r.cause === 'the deep water' ? `You swam into the <b>deep water</b> and sank. Your wallet washed ashore.`
         : `You died. Your wallet is on the floor.`;
    if (r.nearMiss > .3) near = `So close — you were ${(CASHOUT_TIME - r.nearMiss).toFixed(1)}s from cashing out.`;
    else if (r.peak > r.stake * 1.25) near = `You were holding ${fmt(r.peak)} (${(r.peak / r.stake).toFixed(1)}×). Bank it next time.`;
  }

  const again = P.coins >= r.stake ? r.stake : STAKES.slice().reverse().find(s => s <= P.coins);
  els.res.className = 'res ' + (win ? 'win' : 'lose');
  els.res.innerHTML = `
    <div class="kicker">${win ? 'BANKED' : r.cause === 'the Dune Leviathan' ? 'DEVOURED' : r.killer ? 'CUT OFF' : r.cause === 'the lava' ? 'MELTED' : r.cause === 'the deep water' ? 'DROWNED' : 'WIPED OUT'}</div>
    <div class="big"><i class="coin"></i><span id="rAmt">0</span></div>
    <span class="delta ${win && net >= r.stake ? 'pos' : 'neg'}">${win
      ? `${net >= r.stake ? '+' : '−'}${fmt(Math.abs(net - r.stake))} · ${mult.toFixed(2)}×`
      : `−${fmt(r.stake)}`}</span>
    <p class="line">${line}</p>
    ${near ? `<p class="near">${near}</p>` : ''}
    <div class="stats3">
      <div><b>${r.kills}</b><small>cuts</small></div>
      <div><b>${mmss(r.time)}</b><small>alive</small></div>
      <div><b>${fmt(r.peak)}</b><small>peak</small></div>
    </div>
    <div class="loot">
      ${r.gems ? `<span><i class="gem"></i>${r.gems} gems</span>` : ''}
      ${r.chests ? `<span>▣ ${r.chests} chest${r.chests > 1 ? 's' : ''}</span>` : ''}
      <span>◎ ${r.regions} region${r.regions > 1 ? 's' : ''}</span>
      ${runNew.length ? `<span class="new">★ ${runNew.length} discovered</span>` : ''}
    </div>
    <div class="xp">
      <div class="xl"><span>Level <span id="rLvl">${lvlBefore}</span></span><b>+${xp} XP</b></div>
      <div class="tr"><div class="fl" id="rXp" style="width:${progBefore * 100}%"></div></div>
    </div>
    ${completed.length ? `<div class="mdone">${completed.map((m, i) => `<div style="animation-delay:${.4 + i * .15}s">✓ Mission complete — ${missionDef(m).text(m.n)}</div>`).join('')}</div>` : ''}
    ${again ? `<button class="btn ${win ? 'gold' : 'coral'}" id="rAgain">${win ? 'PLAY AGAIN' : 'BUY BACK IN'}<small>${fmt(again)}</small></button>`
            : `<button class="btn gold" id="rAgain">FREE REFILL<small>+${REFILL}</small></button>`}
    <button class="btn ghost" id="rHome">HOME</button>`;

  els.result.classList.remove('hidden');
  cv.classList.add('dim');

  countUp($('rAmt'), 0, win ? net : 0, win ? 1200 : 400);
  setTimeout(() => {
    const fl = $('rXp');
    if (!fl) return;
    if (ups.length){
      fl.style.width = '100%';
      setTimeout(() => {
        fl.style.transition = 'none'; fl.style.width = '0%'; void fl.offsetWidth;
        fl.style.transition = ''; fl.style.width = levelProgress() * 100 + '%';
        $('rLvl').textContent = P.level;
      }, 1150);
    } else fl.style.width = levelProgress() * 100 + '%';
  }, 350);

  if (completed.length) setTimeout(() => { sfx.claim(); buzz([10, 30, 10]); }, 600);
  if (ups.length) setTimeout(() => showLevelUps(ups), 1500);

  $('rAgain').onclick = () => {
    unlockAudio();
    if (!again){ P.coins += REFILL; save(); sfx.claim(); showHome(); return; }
    P.stakeIdx = STAKES.indexOf(again); save();
    beginRun();
  };
  $('rHome').onclick = () => { sfx.tap(); showHome(); };
}

/* ============================================================
   MODALS
   ============================================================ */
function openModal(html, onReady){
  els.modal.innerHTML = `<div class="mbox">${html}</div>`;
  els.modal.classList.remove('hidden');
  onReady && onReady(els.modal);
}
function closeModal(){ els.modal.classList.add('hidden'); els.modal.innerHTML = ''; }

function openDaily(){
  if (!dailyReady()) return;
  const d = dailyPreview();
  const slot = (d.day - 1) % DAILY_LADDER.length;
  openModal(`
    <div class="ico">${ICON.gift}</div>
    <div class="k">DAILY REWARD · DAY ${d.day}</div>
    <div class="amt"><i class="coin"></i>${fmt(d.coins)}</div>
    <div class="ladder">${DAILY_LADDER.map((v, i) => `<i class="${i < slot ? 'done' : i === slot ? 'now' : ''}">${v >= 1000 ? v / 1000 + 'k' : v}</i>`).join('')}</div>
    <p>Come back tomorrow to keep the streak — day 7 pays ${fmt(DAILY_LADDER[6])}.</p>
    <button class="btn gold" id="mClaim">CLAIM</button>`, m => {
    m.querySelector('#mClaim').onclick = e => {
      unlockAudio();
      claimDaily();
      sfx.claim(); buzz([15, 40, 15]);
      flyCoins(e.currentTarget, 14);
      closeModal();
      setTimeout(() => renderHome(true), 750);
    };
  });
}

function showLevelUps(ups){
  const u = ups[ups.length - 1];
  const coins = ups.reduce((a, b) => a + b.coins, 0);
  const skin = ups.map(x => x.skin).filter(Boolean).pop();
  sfx.levelup(); buzz([20, 40, 20, 40, 60]);
  openModal(`
    <div class="ico">${ICON.star}</div>
    <div class="k">LEVEL UP</div>
    <h3>Level ${u.level}</h3>
    <div class="amt" style="font-size:30px"><i class="coin"></i>+${fmt(coins)}</div>
    ${skin ? `<p>New skin unlocked: <b style="color:#fff">${skin.name}</b></p><canvas id="luSkin" style="position:static;width:100%;height:70px;margin:-6px 0 14px"></canvas>` : '<p>Keep climbing — new skins unlock as you level.</p>'}
    <button class="btn gold" id="mOk">${skin ? 'EQUIP' : 'NICE'}</button>`, m => {
    if (skin) drawSkinPreview(m.querySelector('#luSkin'), skin);
    m.querySelector('#mOk').onclick = () => {
      if (skin){ P.skin = skin.id; save(); }
      sfx.tap(); closeModal();
    };
  });
}

/* ============================================================
   SHEETS
   ============================================================ */
function openSheet(kind){
  const c = els.sheetCard;
  if (kind === 'skins') c.innerHTML = skinsSheet();
  else if (kind === 'missions') c.innerHTML = missionsSheet();
  else if (kind === 'map') c.innerHTML = mapSheet();
  else c.innerHTML = profileSheet();
  els.sheet.classList.remove('hidden');
  c.scrollTop = 0;
  if (kind === 'skins') wireSkins();
  if (kind === 'missions') wireMissions();
  if (kind === 'profile') wireProfile();
  if (kind === 'map') wireMap();
}
function closeSheet(){ els.sheet.classList.add('hidden'); renderHome(); }
els.scrim.onclick = closeSheet;
{
  let sy = null;
  els.sheetCard.addEventListener('pointerdown', e => { sy = els.sheetCard.scrollTop <= 0 ? e.clientY : null; });
  els.sheetCard.addEventListener('pointerup', e => { if (sy !== null && e.clientY - sy > 70) closeSheet(); sy = null; });
}

function drawSkinPreview(canvas, sk){
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const w = canvas.width = Math.max(1, r.width * dpr), h = canvas.height = Math.max(1, r.height * dpr);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const W = r.width, H = r.height, rad = Math.min(9, H / 5.5);
  const pts = [];
  for (let x = rad * 1.6; x <= W - rad * 1.8; x += rad * .55) pts.push({ x, y: H / 2 + Math.sin(x / W * 6.5) * H * .2 });
  if (sk.kind === 'glow'){
    g.strokeStyle = sk.glow; g.globalAlpha = .2; g.lineWidth = rad * 2 + 10; g.lineCap = 'round';
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); g.globalAlpha = 1;
  }
  g.strokeStyle = sk.dark; g.lineWidth = rad * 2 + 3; g.lineCap = 'round';
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
  for (let i = 0; i < pts.length; i++){
    const idx = pts.length - 1 - i;
    g.fillStyle = segColor(sk, idx, 0);
    g.beginPath(); g.arc(pts[i].x, pts[i].y, rad, 0, Math.PI * 2); g.fill();
  }
  const hd = pts[pts.length - 1];
  for (const s of [-1, 1]){
    g.fillStyle = '#fff'; g.beginPath(); g.arc(hd.x + rad * .3, hd.y + s * rad * .5, rad * .34, 0, 7); g.fill();
    g.fillStyle = '#0a0d16'; g.beginPath(); g.arc(hd.x + rad * .42, hd.y + s * rad * .5, rad * .17, 0, 7); g.fill();
  }
}

function skinsSheet(){
  return `<div class="grab"></div><h2>Skins</h2><p class="sub">Level up to unlock more. Level ${P.level} · ${fmt(P.xp)}/${fmt(xpForLevel(P.level))} XP</p>
    <div class="skins">${SKINS.map(s => {
      const un = skinUnlocked(s), sel = P.skin === s.id;
      return `<button class="sk ${sel ? 'sel' : ''} ${un ? '' : 'lock'}" data-id="${s.id}">
        <canvas></canvas><b>${s.name}</b><small>${sel ? 'Equipped' : un ? 'Tap to equip' : s.story ? '🔒 Finish the story' : '🔒 Level ' + s.lvl}</small></button>`;
    }).join('')}</div>`;
}
function wireSkins(){
  els.sheetCard.querySelectorAll('.sk').forEach(b => {
    const s = SKINS.find(x => x.id === b.dataset.id);
    drawSkinPreview(b.querySelector('canvas'), s);
    b.onclick = () => {
      if (!skinUnlocked(s)){ sfx.deny(); buzz(30); toast(s.story ? `Bring all nine Scales home to earn <b>${s.name}</b>` : `Reach <b>level ${s.lvl}</b> to unlock ${s.name}`); return; }
      P.skin = s.id; save(); sfx.tap(); buzz(10);
      els.sheetCard.innerHTML = skinsSheet(); wireSkins();
    };
  });
}

function missionsSheet(){
  const ms = missions();
  return `<div class="grab"></div><h2>Daily missions</h2><p class="sub">New set in ${hms(msToMidnight())}</p>
    <div class="ms">${ms.map((m, i) => {
      const d = missionDef(m), rw = missionReward(m), k = Math.min(1, m.prog / m.n);
      const prog = d.mode === 'best' && d.metric === 'mult' ? `${m.prog.toFixed(2)} / ${m.n}×` : `${fmt(m.prog)} / ${fmt(m.n)}`;
      return `<div class="m ${m.claimed ? 'claimed' : ''}"><div class="mi">
        <div class="mt">${d.text(m.n)}</div>
        <div class="mr"><i class="coin"></i>${fmt(rw.coins)} · +${rw.xp} XP</div>
        ${m.done ? '' : `<div class="pb"><i style="width:${k * 100}%"></i></div><div class="pn">${prog}</div>`}
      </div>${m.claimed ? '<span class="ok">✓</span>' : m.done ? `<button data-i="${i}">CLAIM</button>` : ''}</div>`;
    }).join('')}</div>`;
}
function wireMissions(){
  els.sheetCard.querySelectorAll('.m button').forEach(b => b.onclick = () => {
    const m = missions()[+b.dataset.i];
    const r = claimMission(m);
    if (!r) return;
    sfx.claim(); buzz([15, 30, 15]);
    flyCoins(b, 10);
    setTimeout(() => renderHome(true), 750);
    els.sheetCard.innerHTML = missionsSheet(); wireMissions();
    if (r.ups.length) setTimeout(() => showLevelUps(r.ups), 900);
  });
}

function profileSheet(){
  const s = P.stats;
  const tile = (v, l) => `<div><b>${v}</b><small>${l}</small></div>`;
  return `<div class="grab"></div><h2>Level ${P.level}</h2><p class="sub">${fmt(P.xp)} / ${fmt(xpForLevel(P.level))} XP to level ${P.level + 1}</p>
    <div class="pgrid">
      ${tile(fmt(s.games), 'RUNS')}${tile(fmt(s.kills), 'CUTS')}
      ${tile(fmt(s.cashouts), 'CASH-OUTS')}${tile(fmt(s.earned), 'TOTAL PROFIT')}
      ${tile(fmt(s.bestCash), 'BEST CASH-OUT')}${tile(s.bestMult.toFixed(2) + '×', 'BEST MULTIPLIER')}
      ${tile(s.bestKills, 'MOST CUTS')}${tile(mmss(s.bestTime), 'LONGEST RUN')}
    </div>
    <div class="sec">SETTINGS</div>
    <div class="tg">Sound<button class="sw ${P.settings.sound ? 'on' : ''}" data-k="sound"></button></div>
    <div class="tg">Vibration<button class="sw ${P.settings.haptics ? 'on' : ''}" data-k="haptics"></button></div>`;
}
function wireProfile(){
  els.sheetCard.querySelectorAll('.sw').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    P.settings[k] = !P.settings[k]; save();
    b.classList.toggle('on', P.settings[k]);
    sfx.tap(); buzz(10);
  });
}

/* ---------- world map ---------- */
function paintMap(canvas, live){
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), size = Math.max(1, Math.min(r.width, r.height));
  canvas.width = canvas.height = size * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  drawMap(g, size, { discovered: P.discovered, labels: true, extra: (tx, s) => {
    const dot = (x, y, rr, col) => { g.fillStyle = col; g.beginPath(); g.arc(tx(x), tx(y), rr, 0, 7); g.fill(); };
    for (const k of P.story.scales){ const sh = world.shrines[k]; dot(sh.x, sh.y, 3.5 * s, `hsl(${SCALE_HUE[k]} 90% 65%)`); }
    if (!live) return;
    if (G.quest){ g.strokeStyle = '#d6b8ff'; g.lineWidth = 3; g.beginPath(); g.arc(tx(G.quest.x), tx(G.quest.y), 9 * s, 0, 7); g.stroke(); }
    if (G.event) dot(G.event.x, G.event.y, 5 * s, 'rgba(56,225,255,.8)');
    if (G.king && G.king !== G.player){ const h = G.king.head(); dot(h.x, h.y, 4 * s, '#ffdf8a'); }
    if (G.boss && G.boss.phase === 'surface'){ const h = G.boss.head(); dot(h.x, h.y, 5 * s, '#ff5a4d'); }
    if (G.player && G.player.alive){
      const h = G.player.head();
      g.save(); g.translate(tx(h.x), tx(h.y)); g.rotate(G.player.angle);
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(10 * s, 0); g.lineTo(-7 * s, -7 * s); g.lineTo(-7 * s, 7 * s); g.closePath(); g.stroke(); g.fill();
      g.restore();
    }
  }});
}
function openMapOverlay(){
  els.mapov.classList.remove('hidden');
  if (G.mode === 'journey') G.paused = true;
  sfx.tap();
  const v = world.vault;
  els.mapInfo.innerHTML = (G.mode === 'journey' ? `<span><i class="dt" style="background:#d6b8ff"></i>Objective</span>` : `<span><i class="sq"></i>Bank</span>`) + `<span><i class="dt" style="background:#5df2c0"></i>Vault ${v.state === 'open' ? 'OPEN' : Math.ceil(v.t) + 's'}</span><span><i class="dt" style="background:#38e1ff"></i>Frenzy</span><span><i class="dt" style="background:#ff5a4d"></i>Leviathan</span><span>${P.discovered.length}/${REGIONS.length} explored · tap to close</span>`;
  requestAnimationFrame(() => paintMap(els.mapCv, true));
}
els.mapov.addEventListener('pointerdown', e => { e.stopPropagation(); els.mapov.classList.add('hidden'); if (!dlg && els.modal.classList.contains('hidden')) G.paused = false; });

function mapSheet(){
  return `<div class="grab"></div><h2>The Island</h2><p class="sub">${P.discovered.length} of ${REGIONS.length} regions discovered · +${DISCOVER_XP} XP each</p>
    <canvas id="homeMap" class="homemap"></canvas>
    <div class="regions">${REGIONS.map(R => {
      const k = P.discovered.includes(R.key);
      return `<div class="rg ${k ? '' : 'lock'}"><i>${k ? R.icon : '?'}</i><div><b>${k ? R.name : 'Undiscovered'}</b><small>${k ? R.desc : 'Go find it.'}</small></div></div>`;
    }).join('')}</div>`;
}
function wireMap(){ requestAnimationFrame(() => paintMap($('homeMap'), false)); }

/* ============================================================
   INPUT
   ============================================================ */
let joyId = null, joyX = 0, joyY = 0;
const JOY_R = 44;

cv.addEventListener('pointerdown', e => {
  if (G.state !== 'playing' || G.paused) return;
  unlockAudio();
  const mm = minimapRect();
  if (Math.hypot(e.clientX - (mm.x + mm.size / 2), e.clientY - (mm.y + mm.size / 2)) < mm.size / 2 + 6){ openMapOverlay(); return; }
  if (e.pointerType === 'mouse'){ if (e.button === 0) G.input.boost = true; return; }
  if (joyId !== null) return;
  joyId = e.pointerId; joyX = e.clientX; joyY = e.clientY;
  els.joy.style.left = joyX + 'px'; els.joy.style.top = joyY + 'px';
  els.knob.style.transform = '';
  els.joy.classList.add('on');
});
addEventListener('pointermove', e => {
  if (G.state !== 'playing') return;
  if (e.pointerType === 'mouse'){
    const dx = e.clientX - innerWidth / 2, dy = e.clientY - innerHeight / 2;
    if (dx * dx + dy * dy > 300) G.input.angle = Math.atan2(dy, dx);
    return;
  }
  if (e.pointerId !== joyId) return;
  let dx = e.clientX - joyX, dy = e.clientY - joyY;
  const d = Math.hypot(dx, dy);
  if (d > 6) G.input.angle = Math.atan2(dy, dx);
  if (d > JOY_R * 1.6){   // base follows the thumb so it never runs out of travel
    const k = (d - JOY_R * 1.6) / d;
    joyX += dx * k; joyY += dy * k;
    els.joy.style.left = joyX + 'px'; els.joy.style.top = joyY + 'px';
    dx = e.clientX - joyX; dy = e.clientY - joyY;
  }
  const kk = Math.min(1, JOY_R / (Math.hypot(dx, dy) || 1));
  els.knob.style.transform = `translate(${dx * kk}px,${dy * kk}px)`;
});
function joyEnd(e){
  if (e.pointerType === 'mouse'){ G.input.boost = false; return; }
  if (e.pointerId !== joyId) return;
  joyId = null;
  els.joy.classList.remove('on');
}
addEventListener('pointerup', joyEnd);
addEventListener('pointercancel', joyEnd);

function holdButton(el, key){
  const down = e => {
    e.preventDefault(); e.stopPropagation();
    unlockAudio();
    try { el.setPointerCapture(e.pointerId); } catch {}
    G.input[key] = true; el.classList.add('on'); buzz(8);
  };
  const up = () => { G.input[key] = false; el.classList.remove('on'); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
holdButton(els.bBoost, 'boost');
holdButton(els.bCash, 'cash');

addEventListener('keydown', e => {
  if (dlg && (e.code === 'Space' || e.code === 'Enter')){ e.preventDefault(); advanceDialog(); return; }
  if (e.code === 'Escape' && G.mode === 'journey' && G.state === 'playing'){ if (G.paused && !dlg){ closeModal(); G.paused = false; } else openPause(); return; }
  if (e.code === 'Space' || e.code === 'KeyE'){ e.preventDefault(); G.input.cash = true; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.input.boost = true;
  if (e.code === 'KeyM' && G.state === 'playing'){ if (els.mapov.classList.contains('hidden')) openMapOverlay(); else els.mapov.classList.add('hidden'); }
  if (e.code === 'Enter' && G.state === 'menu' && els.sheet.classList.contains('hidden') && els.modal.classList.contains('hidden')) els.play.click();
  if (G.state === 'menu' && e.code === 'ArrowLeft') changeStake(-1);
  if (G.state === 'menu' && e.code === 'ArrowRight') changeStake(1);
});
addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'KeyE') G.input.cash = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.input.boost = false;
});
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { G.input.boost = G.input.cash = false; });

/* ============================================================
   BOOT
   ============================================================ */
initGame(cv);
missions();
showHome();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !/localhost|127\.0\.0\.1/.test(location.hostname))
  navigator.serviceWorker.register('sw.js').catch(() => {});
