/* ============================================================
   Cashcoil — "The Nine Scales"
   Ouro, the Great Coil who holds the island together, shed nine
   golden Scales in his sleep. You hatched the morning the last one
   fell. Each region hides one; each chapter teaches one of the
   island's mechanics. Bring them home to the World Egg.
   ============================================================ */
import { G, spawnNPC } from './game.js';
import { world, REG, regionAt, randomLand, terrainAt, T_LAND } from './world.js';

export const SPEAKERS = {
  moss:    { name: 'Old Moss',        glyph: '🐢', color: '#5df2c0' },
  far:     { name: 'Old Moss (far away)', glyph: '🐢', color: '#5df2c0' },
  rattle:  { name: 'Rattle',          glyph: '🐍', color: '#ffd23f' },
  mire:    { name: 'Mother Mire',     glyph: '🐸', color: '#7fe0a8' },
  whisper: { name: 'The Whisper',     glyph: '🌬️', color: '#e8cf9c' },
  glacier: { name: 'Glacier Spirit',  glyph: '❄️', color: '#9ee3ff' },
  echo:    { name: 'Echo',            glyph: '✨', color: '#c9a6ff' },
  lou:     { name: 'Lucky Lou',       glyph: '🎰', color: '#ff7ae0' },
  cinder:  { name: 'Cinder',          glyph: '🦎', color: '#ff8a4a' },
  warden:  { name: 'The Warden',      glyph: '🗿', color: '#e0cf9c' },
  ouro:    { name: 'Ouro, the Great Coil', glyph: '🐉', color: '#ffd76a' },
};

export const PROLOGUE = [
  ['moss', 'Long ago, before anyone kept count, a serpent called Ouro curled himself around this island and fell asleep.'],
  ['moss', 'His coil held the land together. The sea stayed calm. The seasons came when they were supposed to.'],
  ['moss', 'Last night, Ouro shed nine golden Scales in his sleep — and they scattered across the nine lands.'],
  ['moss', 'Without them he is fading. And this morning, in the Nest, a very small egg began to crack…'],
];

const RATTLE_SKIN = { kind: 'stripe', a: '#ffd23f', b: '#2a2206', dark: '#5a4a06', hue: 50 };

export const CHAPTERS = [
  { region: 'nest', title: 'The Hatchling',
    intro: [
      ['moss', 'Oh! A crack, a wiggle — you’ve hatched! And on such a strange morning, too.'],
      ['moss', 'I’m Old Moss. I’ve watched this island for three hundred summers. Something is wrong with it.'],
      ['moss', 'Ouro’s nine Scales are scattered. Someone small enough to slip through every land could bring them home.'],
      ['moss', 'But first — eat! Nobody saves the world on an empty belly.'],
    ],
    steps: [
      { type: 'count', event: 'eat', n: 25, text: 'Eat 25 glowing orbs' },
      { type: 'count', event: 'chest', n: 1, text: 'Loop your body all the way around a chest', marker: 'chest',
        hint: ['COIL IT', 'Circle the chest — the ring fills as you wrap around it'] },
      { type: 'shrine', text: 'Coil around the Hatch Stone' },
    ],
    outro: [
      ['moss', 'The Scale of Beginnings! Look how it glows for you.'],
      ['moss', 'The next Scale fell somewhere in the Wildwood, to the southwest. Follow the old road.'],
      ['moss', 'And little one — watch out for Rattle. He steals anything shiny.'],
    ] },

  { region: 'wild', title: 'The Thief in the Leaves',
    intro: [
      ['rattle', 'Well, well. A hatchling with a Scale. Shiny. I’ve got one too — found it first. Heh.'],
      ['rattle', 'Finders keepers, noodle! Catch me if you can!'],
      ['far', 'Cut him off! Get your body in front of his head and he’ll bonk right into it.'],
    ],
    steps: [
      { type: 'chase', text: 'Cut off Rattle — get in front of him', hint: ['CUT HIM OFF', 'Sprint past him, then curl across his path'] },
      { type: 'relics', from: 'drop', n: 1, text: 'Grab the Scale Rattle dropped', label: 'SCALE!' },
      { type: 'shrine', text: 'Coil around the Wildwood Shrine' },
    ],
    outro: [
      ['rattle', 'Ow. Fine. FINE. Keep your dumb shiny rock.'],
      ['rattle', '…The old toad in the Marsh keeps croaking about something glinting in her pond. West. Not that I care.'],
    ] },

  { region: 'marsh', title: 'Fish Tales',
    intro: [
      ['mire', 'Croooak. Another visitor, splashing about in my marsh.'],
      ['mire', 'Yes, yes, a golden Scale sank into my pond. My silver fish nibbled it to bits, the greedy things.'],
      ['mire', 'Catch twelve of them. They swim away from you — and the water slows you down. Be clever.'],
    ],
    steps: [
      { type: 'count', event: 'fish', n: 12, text: 'Catch 12 silver fish', marker: 'fish' },
      { type: 'shrine', text: 'Coil around the Marsh Shrine' },
    ],
    outro: [
      ['mire', 'There it is, coughed up and shining. Ribbit. Take it.'],
      ['mire', 'North of here the sand swallows everything. The Bone Desert. Something enormous lives beneath it.'],
      ['mire', 'It has been sitting on pieces of a Scale. Whatever you do out there — don’t stop moving.'],
    ] },

  { region: 'desert', title: 'The Leviathan’s Hoard',
    intro: [
      ['whisper', 'Sssso small… Three shards of a Scale lie in the dunes.'],
      ['whisper', 'The Leviathan feels every scale that crosses its sand. When the ground rumbles, it is rising beneath you.'],
      ['whisper', 'See the red ring? Move. Move!'],
    ],
    steps: [
      { type: 'relics', from: 'region', n: 3, text: 'Collect 3 Scale shards — the Leviathan is hunting you', label: 'SHARD', boss: true },
      { type: 'shrine', text: 'Coil around the Desert Shrine', boss: true },
    ],
    outro: [
      ['whisper', 'The shards remember each other… they are whole again.'],
      ['whisper', 'Colder lands lie to the north-east. The Glacier Spirit has no patience for the slow.'],
    ] },

  { region: 'tundra', title: 'The Ice Run',
    intro: [
      ['glacier', 'HALT. Only the swift may approach my Scale.'],
      ['glacier', 'Pass through my seven ice gates before the frost claims you. Sixty heartbeats.'],
      ['glacier', 'The ice will not help you turn. Plan your curves early. Sprint on the straights.'],
    ],
    steps: [
      { type: 'gates', n: 7, time: 60, text: 'Race through 7 ice gates in 60s' },
      { type: 'shrine', text: 'Coil around the Glacier Shrine' },
    ],
    outro: [
      ['glacier', '…Swift enough. Take it, and go before you freeze.'],
      ['glacier', 'East of me lies the dark. Something there has been crying for light.'],
    ] },

  { region: 'caves', title: 'Five Lights',
    intro: [
      ['echo', 'Hello…? Hello…? Is someone there… there… there…?'],
      ['echo', 'It’s so dark. My five crystal hearts went out when the Scale fell.'],
      ['echo', 'Will you light them? Follow the faint glow. And if you see eyes in the dark… don’t stop.'],
    ],
    steps: [
      { type: 'relics', from: 'region', n: 5, kind: 'beacon', text: 'Light 5 crystal hearts', label: 'LIT' },
      { type: 'shrine', text: 'Coil around the Crystal Shrine' },
    ],
    outro: [
      ['echo', 'Light! Beautiful light! Take the Scale — take it — take it…'],
      ['echo', 'South, where the lights never sleep, a gambler keeps the next one as a prize.'],
    ] },

  { region: 'neon', title: 'Beat the House',
    intro: [
      ['lou', 'Step right up, step right up! Welcome to the Neon Strip, kid!'],
      ['lou', 'The Scale? It’s the grand prize! Hit triple-seven on one of my machines and it’s yours, fair and square.'],
      ['lou', 'Just drive straight into a machine to spin. Round and round she goes!'],
    ],
    steps: [
      { type: 'jackpot', text: 'Hit 7-7-7 on a jackpot machine', marker: 'jackpot' },
      { type: 'shrine', text: 'Coil around the Neon Shrine' },
    ],
    outro: [
      ['lou', 'Well, I’ll be. The house never loses — except today. Congrats, kid.'],
      ['lou', 'Word of advice: south of here it gets HOT. Cinder guards the next one, and lava doesn’t give refunds.'],
    ] },

  { region: 'magma', title: 'Through the Fire',
    intro: [
      ['cinder', 'Hsssss. Seven Scales on one little hatchling? Bold. Or foolish.'],
      ['cinder', 'The eighth melted into three Ember Cores. They cool beside my geysers.'],
      ['cinder', 'The lava will not forgive a single mistake. Neither will I.'],
    ],
    steps: [
      { type: 'relics', from: 'geysers', n: 3, text: 'Collect 3 Ember Cores by the geysers', label: 'EMBER CORE', hue: 18 },
      { type: 'shrine', text: 'Coil around the Magma Shrine' },
    ],
    outro: [
      ['cinder', '…You did not melt. Interesting.'],
      ['cinder', 'The last Scale sleeps inside the Vault of the Sunken Ruins. The Warden opens it only when time turns.'],
    ] },

  { region: 'ruins', title: 'The Vault',
    intro: [
      ['warden', 'WHO. APPROACHES. THE VAULT.'],
      ['warden', 'Eight Scales… You have carried them far, small one.'],
      ['warden', 'The ninth is the Vault’s own heart. When the doors open, coil around the heart — before they close again.'],
    ],
    steps: [
      { type: 'vault', text: 'Wait by the Vault for its doors to open' },
      { type: 'shrine', at: 'vault', text: 'Coil around the Vault’s heart — before the doors close!' },
    ],
    outro: [
      ['warden', 'IT. IS. DONE. Nine Scales.'],
      ['warden', 'Go home, little coil. The World Egg waits in the Nest.'],
    ] },

  { region: 'nest', title: 'The Great Coil', finale: true,
    intro: [
      ['moss', 'You came back! And… oh my. All nine.'],
      ['moss', 'The World Egg sits in the heart of the Nest. Coil around it and give Ouro back his Scales.'],
    ],
    steps: [
      { type: 'shrine', at: 'egg', text: 'Coil around the World Egg' },
    ],
    outro: [
      ['ouro', '…Little one.'],
      ['ouro', 'I dreamed I was coming apart. Then I felt something small carrying me home, one piece at a time.'],
      ['ouro', 'The sea will sleep again. The island is whole. Wear my gold — you have earned it.'],
      ['moss', 'Well! Three hundred summers, and I have never seen that. Go on then, hero. The island is yours.'],
    ] },
];
export const SCALE_KEYS = CHAPTERS.filter(c => !c.finale).map(c => c.region);

/* ============================================================
   Runner
   ============================================================ */
let S = null, UI = null;
let npc = null, gateT = 0, gateOn = false, lastHint = -1;

export function initStory(state, ui){ S = state; UI = ui; }
export const chapter = () => CHAPTERS[Math.min(S.ch, CHAPTERS.length - 1)];
export const stepDef = () => chapter().steps[S.step];
export const isDone = () => S.done;

export function checkpoint(){
  const key = S.cp || 'nest';
  const sh = world.shrines[key];
  return { x: sh.x + 160, y: sh.y };
}

/** called when a journey (re)starts: rebuild the current objective in the world */
export function begin(){
  G.claimed = new Set(S.scales);
  G.objects = []; G.quest = null; G.bossAggro = false; G.forceJackpot = 0;
  G.huntPlayer = S.ch >= 2;
  npc = null; gateOn = false;
  if (S.done){ G.quest = null; return; }
  if (!S.intro) return;            // travelling: the intro plays when you arrive
  enterStep(false);
}

function inRegion(){
  const h = G.player && G.player.alive ? G.player.head() : null;
  return h && regionAt(h.x, h.y).key === chapter().region;
}

/** per-frame: markers, timers, arrival */
export function tick(dt){
  if (!S || S.done || G.mode !== 'journey' || G.state !== 'playing' || G.paused) return;
  const ch = chapter();

  if (!S.intro){
    const sh = world.shrines[ch.region];
    G.quest = { x: sh.x, y: sh.y, label: REG[ch.region].name.toUpperCase() };
    if (inRegion()){
      S.intro = true; UI.save();
      UI.dialog(ch.intro, () => enterStep(true));
    }
    return;
  }

  const st = stepDef();
  if (!st) return;
  const h = G.player.head();

  switch (st.type){
    case 'count': {
      if (st.marker === 'chest'){
        let best = null, bd = Infinity;
        for (const c of world.chests) if (!c.open){ const d = Math.hypot(c.x - h.x, c.y - h.y); if (d < bd){ bd = d; best = c; } }
        G.quest = best ? { x: best.x, y: best.y, label: 'CHEST' } : null;
      } else if (st.marker === 'fish'){
        let best = null, bd = Infinity;
        for (const o of G.orbs) if (o.fish !== undefined){ const d = Math.hypot(o.x - h.x, o.y - h.y); if (d < bd){ bd = d; best = o; } }
        G.quest = best && bd > 250 ? { x: best.x, y: best.y, label: 'FISH' } : null;
      } else G.quest = null;
      break;
    }
    case 'chase':
      if (!npc || !npc.alive) spawnRattle();
      else G.quest = { x: npc.head().x, y: npc.head().y, label: 'RATTLE' };
      break;
    case 'relics': case 'shrine': {
      let best = null, bd = Infinity;
      for (const o of G.objects) if (!o.done){ const d = Math.hypot(o.x - h.x, o.y - h.y); if (d < bd){ bd = d; best = o; } }
      G.quest = best ? { x: best.x, y: best.y, label: st.type === 'shrine' ? 'SHRINE' : (st.label || 'SCALE') } : null;
      if (st.at === 'vault'){
        const v = world.vault, o = G.objects[0];
        if (o) o.active = v.state === 'open';
        if (v.state !== 'open' && o && !o.done){
          UI.banner('THE DOORS CLOSED', 'Wait for them to open again', 'coral');
          S.step--; enterStep(false);
        }
      }
      break;
    }
    case 'gates': {
      const next = G.objects.find(o => !o.done);
      G.quest = next ? { x: next.x, y: next.y, label: 'GATE ' + next.n } : null;
      if (gateOn){
        gateT -= dt;
        UI.timer(gateT);
        if (gateT <= 0){
          gateOn = false; UI.timer(null);
          UI.banner('TOO SLOW!', 'The frost resets the gates — back to gate 1', 'coral');
          S.prog = 0; buildGates(st);
        }
      }
      break;
    }
    case 'jackpot': {
      let best = null, bd = Infinity;
      for (const m of world.jackpots) if (m.cd <= 0 && m.spin <= 0){ const d = Math.hypot(m.x - h.x, m.y - h.y); if (d < bd){ bd = d; best = m; } }
      G.quest = best ? { x: best.x, y: best.y, label: 'JACKPOT' } : null;
      break;
    }
    case 'vault': {
      const v = world.vault;
      G.quest = { x: v.x, y: v.y, label: 'THE VAULT' };
      if (v.state === 'closed' && v.t > 30) v.t = 30;
      if (v.state === 'open') advance();
      break;
    }
  }
  G.bossAggro = !!st.boss;
}

function enterStep(fresh){
  const st = stepDef();
  if (!st) return finishChapter();
  const ch = chapter();
  G.objects = []; G.quest = null; gateOn = false; UI.timer(null);
  UI.quest();
  if (st.hint && lastHint !== S.ch * 10 + S.step){ lastHint = S.ch * 10 + S.step; setTimeout(() => UI.banner(st.hint[0], st.hint[1], 'violet'), 600); }

  switch (st.type){
    case 'shrine': {
      const at = st.at === 'egg' ? world.egg : st.at === 'vault' ? { x: world.vault.x, y: world.vault.y, r: 26 } : world.shrines[ch.region];
      G.objects.push({ type: 'shrine', x: at.x, y: at.y, r: at.r || 30, ring: 70, coil: 0 });
      break;
    }
    case 'relics': {
      const left = st.n - S.prog;
      for (let i = 0; i < left; i++){
        let p;
        if (st.from === 'drop') p = S.drop || world.shrines[ch.region];
        else if (st.from === 'geysers'){ const g = world.geysers[(i + S.prog) % world.geysers.length]; p = { x: g.x + 90, y: g.y + 40 }; }
        else p = spot(ch.region, i);
        G.objects.push({ type: st.kind || 'relic', x: p.x, y: p.y, r: st.kind === 'beacon' ? 40 : 30, label: st.label, hue: st.hue });
      }
      break;
    }
    case 'chase': spawnRattle(); break;
    case 'gates': S.prog = 0; buildGates(st); break;
    case 'jackpot': G.forceJackpot = 3; break;
  }
  UI.save();
}

/* spread relics out: far from the shrine and from each other */
function spot(region, i){
  const R = REG[region], sh = world.shrines[region];
  let best = null, bs = -1;
  for (let k = 0; k < 24; k++){
    const p = randomLand(Math.random, R, 60);
    let s = Math.min(1400, Math.hypot(p.x - sh.x, p.y - sh.y));
    for (const o of G.objects) s = Math.min(s, Math.hypot(p.x - o.x, p.y - o.y) * 1.5);
    if (s > bs){ bs = s; best = p; }
  }
  return best;
}

function buildGates(st){
  G.objects = [];
  const R = REG.tundra, c = world.shrines.tundra;
  const cx = (R.x + c.x) / 2, cy = (R.y + c.y) / 2 + 250;
  for (let i = 0; i < st.n; i++){
    const a = i / st.n * Math.PI * 2 - Math.PI / 2, rr = 650 + (i % 2) * 180;
    let x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    for (let k = 0; k < 20 && terrainAt(x, y) !== T_LAND; k++){ x += (cx - x) * .12; y += (cy - y) * .12; }
    G.objects.push({ type: 'gate', x, y, r: 70, n: i + 1, a: a + Math.PI / 2, next: i === 0 });
  }
}

function spawnRattle(){
  if (npc && npc.alive) return;
  npc = spawnNPC({ name: 'Rattle', skin: RATTLE_SKIN, region: REG.wild, near: G.player ? G.player.head() : null, mass: 70 });
}

function advance(){
  S.step++; S.prog = 0;
  UI.save();
  if (S.step >= chapter().steps.length) finishChapter();
  else enterStep(true);
}

function finishChapter(){
  const ch = chapter();
  G.objects = []; G.quest = null; G.bossAggro = false; UI.timer(null);
  if (ch.finale){
    G.ouro = { t0: G.t };
    UI.dialog(ch.outro, () => { S.done = true; UI.save(); UI.finale(); });
    return;
  }
  S.scales.push(ch.region);
  S.cp = ch.region;
  G.claimed = new Set(S.scales);
  UI.scale(ch, S.scales.length);
  UI.dialog(ch.outro, () => {
    S.ch++; S.step = 0; S.prog = 0; S.intro = false;
    G.huntPlayer = S.ch >= 2;
    UI.save(); UI.quest();
    if (inRegion()){ S.intro = true; UI.dialog(chapter().intro, () => enterStep(true)); }
  });
}

/* ---------- events from the engine ---------- */
export function onEvent(type, a, b){
  if (!S || S.done || G.mode !== 'journey' || !S.intro) return;
  const st = stepDef();
  if (!st) return;
  switch (type){
    case 'eat':
      if (st.type === 'count' && (st.event === 'eat' || (st.event === 'fish' && a.fish !== undefined))) bump(st);
      break;
    case 'chest': if (st.type === 'count' && st.event === 'chest') bump(st); break;
    case 'jackpot': if (st.type === 'jackpot' && a) setTimeout(advance, 900); break;
    case 'died':
      if (st.type === 'chase' && a === npc){
        S.drop = { x: b.x, y: b.y };
        UI.banner('RATTLE DROPPED THE SCALE!', 'Grab it before he comes back', 'gold');
        advance();
      }
      break;
    case 'story':
      if (a === 'coil'){ advance(); break; }
      if (a === 'gate'){
        S.prog++;
        const nx = G.objects.find(o => !o.done);
        if (nx) nx.next = true;
        if (S.prog === 1){ gateOn = true; gateT = st.time; }
        UI.quest();
        if (S.prog >= st.n){ gateOn = false; UI.timer(null); UI.banner('GATES CLEARED', 'The Glacier Spirit is impressed', 'mint'); advance(); }
        break;
      }
      if (a === 'touch'){ S.prog++; UI.quest(); if (S.prog >= st.n) advance(); else UI.save(); }
      break;
  }
}
function bump(st){
  S.prog++;
  UI.quest();
  if (S.prog >= st.n) advance();
}

/* ---------- read-outs for the UI ---------- */
export function questText(){
  if (!S) return null;
  if (S.done) return { chapter: 'Epilogue', title: 'The island is whole', text: 'Roam free — every land is yours', prog: '' };
  const ch = chapter(), n = S.ch;
  const head = ch.finale ? 'Finale' : `Chapter ${n + 1}`;
  if (!S.intro) return { chapter: head, title: ch.title, text: `Travel to ${REG[ch.region].name}`, prog: '' };
  const st = stepDef();
  if (!st) return { chapter: head, title: ch.title, text: '', prog: '' };
  const prog = st.type === 'count' || st.type === 'relics' || st.type === 'gates' ? `${S.prog}/${st.n}` : '';
  return { chapter: head, title: ch.title, text: st.text, prog };
}
