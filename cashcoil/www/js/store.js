/* ============================================================
   Persistent player profile (localStorage for now — swaps for
   a server-backed account once login lands).
   ============================================================ */
import { START_COINS, STAKES, DAILY_LADDER, MISSION_POOL, MISSION_REWARD, xpForLevel, SKINS } from './config.js';

const KEY = 'cashcoil.profile.v1';

function defaults(){
  return {
    coins: START_COINS,
    level: 1, xp: 0,
    skin: 'ember',
    stakeIdx: 2,
    daily: { last: null, streak: 0 },
    missions: { day: null, list: [] },
    stats: { games: 0, kills: 0, cashouts: 0, earned: 0, bestCash: 0, bestMult: 0, bestKills: 0, bestTime: 0, chests: 0 },
    settings: { sound: true, haptics: true },
    seenTutorial: false,
    discovered: [],
    mode: 'journey',
    story: { ch: 0, step: 0, prog: 0, scales: [], intro: false, done: false, cp: 'nest', mass: 12, prologue: false, drop: null },
  };
}

function load(){
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = defaults(), p = JSON.parse(raw);
    return { ...d, ...p,
      daily: { ...d.daily, ...p.daily },
      missions: { ...d.missions, ...p.missions },
      stats: { ...d.stats, ...p.stats },
      settings: { ...d.settings, ...p.settings },
      story: { ...d.story, ...p.story } };
  } catch { return defaults(); }
}

export const P = load();

export function save(){
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch {}
}

/* ---------- days ---------- */
export function dayKey(d = new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function yesterdayKey(){ const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); }
export function msToMidnight(){
  const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); return m - n;
}

/* ---------- stake ---------- */
export function stake(){ return STAKES[P.stakeIdx]; }
export function shiftStake(dir){
  P.stakeIdx = Math.max(0, Math.min(STAKES.length - 1, P.stakeIdx + dir));
  save();
}

/* ---------- XP / levels ---------- */
export function levelProgress(){ return P.xp / xpForLevel(P.level); }

/** adds xp, returns list of level-ups: [{level, coins, skin}] */
export function addXP(n){
  const ups = [];
  P.xp += Math.round(n);
  while (P.xp >= xpForLevel(P.level)){
    P.xp -= xpForLevel(P.level);
    P.level++;
    const coins = 50 * P.level;
    P.coins += coins;
    const skin = SKINS.find(s => s.lvl === P.level);
    ups.push({ level: P.level, coins, skin });
  }
  save();
  return ups;
}

export function skinUnlocked(s){ return s.story ? P.story.done : P.level >= s.lvl; }

/* ---------- daily reward ---------- */
export function dailyReady(){ return P.daily.last !== dayKey(); }
export function dailyPreview(){
  const streak = P.daily.last === yesterdayKey() ? P.daily.streak + 1 : 1;
  return { day: streak, coins: DAILY_LADDER[(streak - 1) % DAILY_LADDER.length] };
}
export function claimDaily(){
  if (!dailyReady()) return null;
  const r = dailyPreview();
  P.daily = { last: dayKey(), streak: r.day };
  P.coins += r.coins;
  save();
  return r;
}
export function streak(){
  if (P.daily.last === dayKey() || P.daily.last === yesterdayKey()) return P.daily.streak;
  return 0;
}

/* ---------- missions ---------- */
export function missions(){
  const today = dayKey();
  if (P.missions.day !== today){
    const pool = [...MISSION_POOL].sort(() => Math.random() - .5).slice(0, 3);
    const tiers = [0, 1, 2].sort(() => Math.random() - .5);
    P.missions = { day: today, list: pool.map((m, i) => ({
      id: m.id, tier: tiers[i], n: m.ns[tiers[i]], prog: 0, done: false, claimed: false })) };
    save();
  }
  return P.missions.list;
}
export function missionDef(m){ return MISSION_POOL.find(d => d.id === m.id); }
export function missionReward(m){ return MISSION_REWARD[m.tier]; }
export function missionsClaimable(){ return missions().filter(m => m.done && !m.claimed).length; }

/** feed a batch of run metrics; returns missions completed by it */
export function trackMissions(metrics){
  const done = [];
  for (const m of missions()){
    if (m.done) continue;
    const def = missionDef(m), v = metrics[def.metric];
    if (v === undefined) continue;
    m.prog = def.mode === 'best' ? Math.max(m.prog, v) : m.prog + v;
    if (m.prog >= m.n){ m.prog = m.n; m.done = true; done.push(m); }
  }
  save();
  return done;
}
export function claimMission(m){
  if (!m.done || m.claimed) return null;
  m.claimed = true;
  const r = missionReward(m);
  P.coins += r.coins;
  const ups = addXP(r.xp);
  save();
  return { ...r, ups };
}
