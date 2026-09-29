/* ============================================================
   Cashcoil — tuning + content tables
   ============================================================ */

export const WORLD_R       = 2600;
export const TARGET_FOOD   = 800;
export const FIELD_SIZE    = 16;     // snakes alive during a run (incl. player)
export const AMBIENT_COUNT = 10;     // snakes drifting behind the home screen
export const RAKE          = 0.05;   // house fee on cash-out
export const CASHOUT_TIME  = 3;      // seconds to hold cash-out

/* Soft currency for now. The arena is still a closed pot: coins only
   enter as stakes and only leave through a cash-out, so the economy
   drops straight onto real money once wallets/login are added. */
export const START_COINS = 1000;
export const REFILL      = 500;
export const STAKES      = [10, 25, 50, 100, 250, 500, 1000];

export const DAILY_LADDER = [100, 150, 200, 300, 400, 600, 1000];

export function xpForLevel(l){
  return Math.round(120 + (l - 1) * 80 + Math.pow(l - 1, 1.6) * 12);
}

export const HUES = [12, 34, 52, 96, 150, 172, 196, 214, 258, 288, 320, 340];

export const BOT_NAMES = [
  "Big Nugget","Deadeye Doris","Noodle King","Granny Venmo","Chairman Meow","Danger Noodle",
  "Broke Baron","Cash Cow","Payday Pirate","Sir Slithers","Mortgage Mike","Tax Evader",
  "Your Landlord","Rent Is Due","All-In Andy","Pocket Aces","Big Spender","Free Lunch",
  "Wifi Thief","Couch Potato","Chonk Boi","Last Call Larry","Not On Call","Moist Nugget",
  "Big Yeetus","Snack Attack","Nacho Snake","Hiss Kiss","Noodle Baron","Whale Watcher",
  "Goblin Mode","Uncle Kevin","Aunt Carol","Stonks Only","Your Ex","Dad Jokes",
  "Eats-A-Lot","Hot Pocket","Gremlin Energy","Feral Raccoon","No Brakes","Lil Pumpkin",
  "Spaghetti West","Vengeful Toaster","Money Maggot","Quiet Storm","Mood Baby","Discount Dracula",
  "Thicc Boi","Wallet Warrior","Sneaky Snek","Grumpy Goose","Pasta La Vista","No Refunds",
  "Meme Lord","Not A Robot","Sudden Regret","Yolo Officer","Big Yikes","Prince of Debt"
];

/* kind: solid | stripe | rainbow | glow | shine
   a/b = body colours, dark = outline, hue = colour of spilled food */
export const SKINS = [
  { id:'ember',  name:'Ember',   lvl:1,  kind:'solid',   a:'#ff5a4d', b:'#f04a3e', dark:'#7d1a14', hue:4   },
  { id:'mint',   name:'Mint',    lvl:2,  kind:'solid',   a:'#5df2c0', b:'#44dcab', dark:'#0f6149', hue:160 },
  { id:'grape',  name:'Grape',   lvl:3,  kind:'stripe',  a:'#a78bfa', b:'#7c5cf0', dark:'#33206e', hue:258 },
  { id:'tiger',  name:'Tiger',   lvl:5,  kind:'stripe',  a:'#ff9d2e', b:'#1b1206', dark:'#5a3107', hue:30  },
  { id:'neon',   name:'Neon',    lvl:7,  kind:'glow',    a:'#38e1ff', b:'#1fc2e6', dark:'#064a5c', hue:192, glow:'#38e1ff' },
  { id:'candy',  name:'Candy',   lvl:10, kind:'stripe',  a:'#ff7ac8', b:'#fff0f8', dark:'#7a1f55', hue:320 },
  { id:'toxic',  name:'Toxic',   lvl:12, kind:'glow',    a:'#b6ff3b', b:'#8fe01a', dark:'#2f5206', hue:90,  glow:'#b6ff3b' },
  { id:'aurora', name:'Aurora',  lvl:15, kind:'rainbow', a:'#ffffff', b:'#ffffff', dark:'#1a1f33', hue:200 },
  { id:'midas',  name:'Midas',   lvl:20, kind:'shine',   a:'#f7c14b', b:'#e0a82e', dark:'#6b4a0c', hue:44  },
  { id:'void',   name:'Void',    lvl:25, kind:'glow',    a:'#1a1330', b:'#261b45', dark:'#8b5cf6', hue:270, glow:'#8b5cf6' },
];

/* daily missions — three are drawn each day */
export const MISSION_POOL = [
  { id:'eat',     metric:'eat',      mode:'total', ns:[150, 300, 600],  text:n => `Eat ${n} orbs` },
  { id:'kill',    metric:'kills',    mode:'total', ns:[1, 3, 6],        text:n => `Cut off ${n} snake${n>1?'s':''}` },
  { id:'cash',    metric:'cashouts', mode:'total', ns:[1, 2, 4],        text:n => `Cash out ${n} time${n>1?'s':''}` },
  { id:'mult',    metric:'mult',     mode:'best',  ns:[1.5, 2, 3],      text:n => `Cash out at ${n}× your stake` },
  { id:'survive', metric:'survive',  mode:'best',  ns:[60, 150, 300],   text:n => `Survive ${n}s in one run` },
  { id:'king',    metric:'king',     mode:'total', ns:[1, 2, 3],        text:n => `Take the crown ${n>1?n+' times':''}`.trim() },
  { id:'boost',   metric:'boost',    mode:'total', ns:[20, 45, 90],     text:n => `Sprint for ${n}s` },
  { id:'frenzy',  metric:'frenzy',   mode:'total', ns:[20, 50, 100],    text:n => `Eat ${n} frenzy orbs` },
];
export const MISSION_REWARD = [ {coins:80, xp:60}, {coins:160, xp:120}, {coins:300, xp:220} ];

export const COMBO_WORDS = ['', 'CUT OFF', 'DOUBLE CUT', 'TRIPLE CUT', 'RAMPAGE', 'UNSTOPPABLE', 'GODLIKE'];
