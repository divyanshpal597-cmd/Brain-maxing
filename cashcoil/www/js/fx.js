/* ============================================================
   Sound (synthesised with WebAudio — no asset files) + haptics
   ============================================================ */
import { P } from './store.js';

let ac = null, master = null, noiseBuf = null;

export function unlockAudio(){
  if (!ac){
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.55;
      const comp = ac.createDynamicsCompressor();
      master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume();
}

function on(){ return ac && P.settings.sound; }

function tone(freq, dur, type = 'sine', vol = .2, slideTo = null, delay = 0){
  if (!on()) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}

function noise(dur, vol = .2, freq = 1200, delay = 0){
  if (!on()) return;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.03);
}

const semis = n => Math.pow(2, n / 12);

/* rapid pickups climb a scale — the "keep going" ladder */
let ladder = 0, ladderT = 0, lastEat = 0;
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];

export const sfx = {
  eat(){
    if (!on()) return;
    const now = ac.currentTime;
    if (now - lastEat < 0.045) return;
    ladder = now - ladderT < 0.45 ? Math.min(ladder + 1, SCALE.length - 1) : 0;
    ladderT = lastEat = now;
    tone(392 * semis(SCALE[ladder]), .07, 'sine', .07);
  },
  coin(big){
    tone(1318, .09, 'triangle', .13);
    tone(1760, .16, 'triangle', .10, null, .05);
    if (big) tone(2637, .22, 'sine', .07, null, .1);
  },
  kill(combo = 1){
    noise(.35, .28, 1400);
    tone(180, .32, 'sawtooth', .14, 50);
    const base = 523 * semis(Math.min(combo - 1, 6) * 2);
    tone(base, .1, 'square', .06, null, .06);
    tone(base * semis(7), .18, 'square', .05, null, .13);
  },
  death(){
    noise(.7, .32, 700);
    tone(320, .8, 'sawtooth', .16, 38);
    tone(160, .9, 'sine', .2, 30, .05);
  },
  cashTick(p){ tone(330 * semis(Math.round(p * 12)), .05, 'square', .045); },
  cashout(){
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(523 * semis(s), .28, 'triangle', .11, null, i * .06));
    noise(.5, .06, 6000, .3);
  },
  crown(){ [0, 7, 12].forEach((s, i) => tone(659 * semis(s), .3, 'sine', .1, null, i * .08)); },
  frenzy(){ tone(220, .5, 'sawtooth', .07, 880); tone(330, .5, 'sawtooth', .05, 1320, .05); },
  levelup(){ [0, 4, 7, 11, 12, 16, 19, 24].forEach((s, i) => tone(392 * semis(s), .22, 'triangle', .1, null, i * .055)); },
  tap(){ tone(740, .04, 'sine', .07); },
  tick(){ tone(1200, .025, 'square', .03); },
  claim(){ [0, 7, 12, 19].forEach((s, i) => tone(784 * semis(s), .18, 'triangle', .1, null, i * .05)); noise(.3, .05, 8000, .15); },
  boost(){ noise(.18, .06, 2400); },
  deny(){ tone(200, .12, 'square', .06, 140); },
  gem(){ tone(1568 * semis(Math.random() * 5 | 0), .09, 'sine', .07); },
  pad(){ tone(440, .18, 'sawtooth', .05, 1320); noise(.15, .05, 5000); },
  portal(){ tone(200, .5, 'sine', .14, 1600); tone(300, .5, 'triangle', .07, 2400, .05); noise(.4, .08, 3000); },
  spin(){ noise(.1, .05, 4000); tone(880, .06, 'square', .04); },
  jackpot(){ [0, 4, 7, 12, 16, 19, 24, 28].forEach((s, i) => tone(523 * semis(s), .2, 'square', .06, null, i * .05)); noise(.8, .08, 8000, .2); },
  chest(){ noise(.25, .15, 1800); [0, 7, 12, 16].forEach((s, i) => tone(659 * semis(s), .22, 'triangle', .1, null, .05 + i * .06)); },
  vault(){ tone(110, 1.2, 'sawtooth', .12, 220); [0, 7, 12, 19].forEach((s, i) => tone(392 * semis(s), .5, 'sine', .09, null, .3 + i * .12)); },
  geyser(){ noise(.9, .16, 900); tone(90, .7, 'sine', .12, 50); },
  rumble(){ noise(1.2, .18, 260); tone(55, 1.2, 'sine', .2, 40); },
  emerge(){ noise(.8, .3, 1200); tone(140, .6, 'sawtooth', .18, 40); },
  discover(){ [0, 5, 9, 12, 17].forEach((s, i) => tone(440 * semis(s), .35, 'sine', .1, null, i * .09)); },
};

export function buzz(pattern){
  if (!P.settings.haptics) return;
  try { navigator.vibrate && navigator.vibrate(pattern); } catch {}
}
