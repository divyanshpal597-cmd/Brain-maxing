/* ============================================================
   Cashcoil — screens, HUD, input, meta-progression
   ============================================================ */
import { STAKES, SKINS, RAKE, CASHOUT_TIME, REFILL, DAILY_LADDER, xpForLevel } from './config.js';
import { P, save, stake, shiftStake, addXP, levelProgress, skinUnlocked, dailyReady, dailyPreview,
         claimDaily, streak, missions, missionDef, missionReward, missionsClaimable, trackMissions,
         claimMission, msToMidnight } from './store.js';
import { G, initGame, startRun, toMenu, segColor, fmt, clamp } from './game.js';
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

  const broke = P.coins < STAKES[0];
  els.play.classList.toggle('refill', broke);
  els.play.firstElementChild.textContent = broke ? `FREE REFILL +${REFILL}` : P.coins < s ? 'LOWER STAKE' : 'PLAY';

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

els.play.onclick = () => {
  unlockAudio();
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
   RUN
   ============================================================ */
let runStake = 0;
function beginRun(){
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
  if (P.stats.games <= 3)
    setTimeout(() => banner(TOUCH ? 'DRAG TO STEER' : 'MOUSE TO STEER',
      TOUCH ? 'Tap ⚡ to sprint · hold CASH OUT to bank your wallet' : 'Click to sprint · hold SPACE to bank your wallet', 'gold'), 400);
}

/* ---------- HUD ---------- */
let lastCash = 0, boardT = 0, bannerTO = null;
function hudFrame(dt){
  if (G.state !== 'playing' && G.state !== 'ending') return;
  const p = G.player;
  if (!p) return;

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
  els.bCash.classList.toggle('locked', p.shield > 0);

  boardT -= dt;
  if (boardT <= 0){
    boardT = .3;
    const alive = G.snakes.filter(s => s.alive).sort((a, b) => b.cash - a.cash);
    const top = alive.slice(0, 5), rank = alive.indexOf(p) + 1;
    const dot = s => s.skin.kind === 'rainbow' ? 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' : s.skin.a;
    els.board.innerHTML = top.map((s, i) => `<div class="row ${s.isPlayer ? 'me' : ''}"><i style="background:${dot(s)}"></i><span>${i === 0 ? '👑 ' : ''}${s.isPlayer ? 'You' : s.name}</span><b>${fmt(s.cash)}</b></div>`).join('')
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
G.hooks.feed = (text, cash) => {
  const d = document.createElement('div');
  d.innerHTML = `${text}${cash > 1 ? ` · <b>${fmt(cash)}</b>` : ''}`;
  els.feed.prepend(d);
  while (els.feed.children.length > 3) els.feed.lastChild.remove();
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 500); }, 4000);
};
G.hooks.end = r => showResult(r);

/* ============================================================
   RESULT
   ============================================================ */
function showResult(r){
  els.hud.classList.add('hidden');
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

  const xp = Math.round(r.eaten * .4 + r.frenzy + r.kills * 35 + (r.bestCombo > 1 ? r.bestCombo * 15 : 0)
    + r.time * .6 + r.king * 40 + (r.win ? 50 + Math.max(0, net / r.stake - 1) * 60 : 0));
  const lvlBefore = P.level, progBefore = levelProgress();

  const completed = trackMissions({
    eat: r.eaten, kills: r.kills, cashouts: r.win ? 1 : 0, mult: r.win ? net / r.stake : 0,
    survive: r.time, king: r.king, boost: r.boostT, frenzy: r.frenzy,
  });
  const ups = addXP(xp);

  const win = r.win;
  const mult = win ? net / r.stake : 0;
  let line, near = '';
  if (win){
    const d = net - r.stake;
    line = d >= 0 ? `You walked out <b>${fmt(d)}</b> up on a ${fmt(r.stake)} stake.`
                  : `Banked ${fmt(net)} of your ${fmt(r.stake)} stake — live to fight again.`;
  } else {
    line = r.killer ? `<b>${r.killer}</b> cut you off. Your wallet is on the floor — someone's already eating it.`
                    : `You hit the edge of the arena. Your wallet is on the floor.`;
    if (r.nearMiss > .3) near = `So close — you were ${(CASHOUT_TIME - r.nearMiss).toFixed(1)}s from cashing out.`;
    else if (r.peak > r.stake * 1.25) near = `You were holding ${fmt(r.peak)} (${(r.peak / r.stake).toFixed(1)}×). Bank it next time.`;
  }

  const again = P.coins >= r.stake ? r.stake : STAKES.slice().reverse().find(s => s <= P.coins);
  els.res.className = 'res ' + (win ? 'win' : 'lose');
  els.res.innerHTML = `
    <div class="kicker">${win ? 'CASHED OUT' : r.killer ? 'CUT OFF' : 'WIPED OUT'}</div>
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
  else c.innerHTML = profileSheet();
  els.sheet.classList.remove('hidden');
  c.scrollTop = 0;
  if (kind === 'skins') wireSkins();
  if (kind === 'missions') wireMissions();
  if (kind === 'profile') wireProfile();
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
        <canvas></canvas><b>${s.name}</b><small>${sel ? 'Equipped' : un ? 'Tap to equip' : '🔒 Level ' + s.lvl}</small></button>`;
    }).join('')}</div>`;
}
function wireSkins(){
  els.sheetCard.querySelectorAll('.sk').forEach(b => {
    const s = SKINS.find(x => x.id === b.dataset.id);
    drawSkinPreview(b.querySelector('canvas'), s);
    b.onclick = () => {
      if (!skinUnlocked(s)){ sfx.deny(); buzz(30); toast(`Reach <b>level ${s.lvl}</b> to unlock ${s.name}`); return; }
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

/* ============================================================
   INPUT
   ============================================================ */
let joyId = null, joyX = 0, joyY = 0;
const JOY_R = 44;

cv.addEventListener('pointerdown', e => {
  if (G.state !== 'playing') return;
  unlockAudio();
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
  if (e.code === 'Space' || e.code === 'KeyE'){ e.preventDefault(); G.input.cash = true; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.input.boost = true;
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
