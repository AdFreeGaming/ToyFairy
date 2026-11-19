'use strict';
/* The Toy Fairy - an isometric bedtime tidy-up game (plain Canvas 2D, no build step). */
(() => {
const W = 1376, H = 768, HW = 32, HH = 16;           // canvas size, half tile width/height
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const FONT = '"Press Start 2P", "Courier New", monospace';
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const K = (i, j) => i + ',' + j;
const easeBack = t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const INK = '#1a1030', CREAM = '#fbefc0', GOLD = '#ffd24a';

// ---------------------------------------------------------------- assets
const IMG = {};
const FILES = {};
for (let n = 1; n <= 6; n++) FILES['bg' + n] = `assets/bg/Level${n}.jpg`;
['boy_run1', 'boy_run2', 'boy_run3', 'boy_shock', 'boy_cheer', 'boy_sleep', 'fairy_big',
 'fairy_hover0', 'fairy_hover1', 'fairy_hover2', 'fairy_cast0', 'fairy_cast1', 'fairy_laugh0', 'fairy_laugh1',
 'fairy_hit0', 'fairy_hit1', 'fairy_cele0', 'fairy_cele1', 'fairy_pick0', 'fairy_pick1']
  .forEach(k => FILES[k] = `assets/sprites/${k}.png`);
FILES.qr = 'assets/qr.png';
function loadAll() {
  return Promise.all(Object.entries(FILES).map(([k, src]) => new Promise(res => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = res; im.src = src;
  })));
}

// ---------------------------------------------------------------- sound
let AC = null, muted = false;
function tone(f, d = 0.12, type = 'square', vol = 0.05, when = 0, f2 = 0) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.03);
  } catch (e) { /* audio unavailable */ }
}
const SFX = {
  pick: () => tone(660, .08, 'square', .05, 0, 990),
  pack: () => { tone(523, .1); tone(784, .14, 'square', .05, .09); },
  steal: () => tone(520, .5, 'sawtooth', .05, 0, 90),
  warn: () => tone(1200, .07, 'triangle', .05),
  chime: () => [784, 988, 1175, 1568].forEach((f, k) => tone(f, .5, 'triangle', .07, k * .16)),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone(f, .16, 'square', .05, k * .13)),
  lose: () => [392, 330, 262, 196].forEach((f, k) => tone(f, .25, 'triangle', .08, k * .2)),
  bonk: () => tone(180, .2, 'square', .07, 0, 80),
  foil: () => tone(900, .15, 'triangle', .06, 0, 1500),
  lever: () => tone(220, .12, 'square', .06, 0, 440),
  flap: () => tone(300, .25, 'triangle', .07, 0, 800),
  zip: () => tone(400, .9, 'sine', .06, 0, 2200),
};

// ---------------------------------------------------------------- procedural pixel sprites
const SPR = {};
function sprite(w, h, scale, fn) {
  const a = document.createElement('canvas'); a.width = w; a.height = h;
  const c = a.getContext('2d');
  const r = (col, x, y, ww = 1, hh = 1) => { c.fillStyle = col; c.fillRect(x, y, ww, hh); };
  fn(r, c);
  // dark outline: silhouette stamped in 4 directions underneath
  const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
  const sc = sil.getContext('2d'); sc.drawImage(a, 0, 0);
  sc.globalCompositeOperation = 'source-in'; sc.fillStyle = INK; sc.fillRect(0, 0, w, h);
  const o = document.createElement('canvas'); o.width = (w + 2) * scale; o.height = (h + 2) * scale;
  const oc = o.getContext('2d'); oc.imageSmoothingEnabled = false; oc.scale(scale, scale);
  [[0, 1], [2, 1], [1, 0], [1, 2]].forEach(([x, y]) => oc.drawImage(sil, x, y));
  oc.drawImage(a, 1, 1);
  return o;
}
function disc(r, col) { // 12px ball silhouette on a 16 grid
  [[5, 2, 6], [4, 3, 8], [3, 4, 10], [2, 5, 12], [2, 6, 12], [2, 7, 12], [2, 8, 12], [2, 9, 12], [2, 10, 12], [3, 11, 10], [4, 12, 8], [5, 13, 6]]
    .forEach(([x, y, w]) => r(col, x, y, w, 1));
}
function makeSprites() {
  const car = c => sprite(16, 16, 4, r => {
    r(c, 1, 7, 14, 4); r(c, 4, 4, 7, 3); r('#bfe6ff', 5, 5, 2, 2); r('#bfe6ff', 8, 5, 2, 2);
    r('#ffffff55', 1, 7, 14, 1); r('#222', 2, 10, 3, 3); r('#222', 10, 10, 3, 3); r('#999', 3, 11); r('#999', 11, 11); r('#ffe066', 14, 8);
  });
  const block = (c, c2) => sprite(16, 16, 4, r => {
    r(c, 2, 3, 12, 11); r(c2, 2, 3, 12, 2); r(c2, 2, 3, 2, 11);
    r('#fff', 6, 6, 4, 1); r('#fff', 6, 6, 1, 6); r('#fff', 9, 6, 1, 6); r('#fff', 6, 9, 4, 1);
  });
  const train = c => sprite(16, 16, 4, r => {
    r(c, 2, 4, 5, 7); r(c, 7, 7, 6, 4); r('#333', 10, 4, 2, 3); r('#555', 9, 3, 4, 1);
    r('#bfe6ff', 3, 5, 3, 3); r('#ffd24a', 2, 10, 11, 1); r('#222', 3, 11, 3, 3); r('#222', 8, 11, 3, 3);
    r('#999', 4, 12); r('#999', 9, 12); r('#444', 13, 10, 2, 2);
  });
  const puzzle = c => sprite(16, 16, 4, (r, x) => {
    r(c, 3, 5, 10, 9); r(c, 6, 2, 4, 3); r(c, 13, 8, 2, 3); x.clearRect(3, 8, 2, 3); x.clearRect(7, 12, 3, 2);
    r('#ffffff55', 3, 5, 10, 1); r('#ffffff55', 6, 2, 4, 1);
  });
  SPR.car = car('#d8342c'); SPR.carBlue = car('#2f6fd0');
  SPR.block = block('#3c9a4c', '#59c06a'); SPR.blockO = block('#e08a2c', '#f5ae55');
  SPR.trainBlue = train('#2f6fd0'); SPR.trainRed = train('#d8342c');
  SPR.puzzles = ['#d8342c', '#2f6fd0', '#3c9a4c', '#e8b62c', '#9a4fc0'].map(puzzle);
  SPR.ball = sprite(16, 16, 4, (r, x) => {
    disc(r, '#d8342c'); x.globalCompositeOperation = 'source-atop';
    r('#2f6fd0', 6, 0, 3, 16); r('#e8c62c', 9, 0, 3, 16); r('#3c9a4c', 12, 0, 3, 16); r('#ffffff88', 4, 4, 2, 2);
  });
  SPR.bigBall = sprite(16, 16, 4, (r, x) => {
    disc(r, '#e8c62c'); x.globalCompositeOperation = 'source-atop';
    r('#d8342c', 2, 0, 4, 16); r('#2f9ad0', 9, 0, 3, 16); r('#3c9a4c', 12, 0, 3, 16); r('#ffffffaa', 4, 4, 2, 2); r('#00000033', 2, 11, 12, 3);
  });
  SPR.dino = sprite(16, 16, 4, r => {
    const g = '#4caf50', d = '#2e7d32';
    r(g, 3, 8, 8, 4); r(g, 9, 4, 3, 5); r(g, 9, 3, 5, 3); r('#fff', 12, 4); r(INK, 13, 4); r(g, 1, 9, 2, 2); r(g, 0, 10, 1, 1);
    r(d, 4, 12, 2, 2); r(d, 8, 12, 2, 2); r(d, 4, 7); r(d, 6, 7); r(d, 8, 7); r('#fff', 12, 6, 2, 1);
  });
  SPR.robot = sprite(16, 16, 4, r => {
    r('#9fb3c8', 5, 2, 6, 4); r('#d8342c', 6, 3); r('#d8342c', 9, 3); r('#555', 7, 0, 2, 2); r('#ffd24a', 7, 0);
    r('#6f87a3', 4, 7, 8, 5); r('#ffd24a', 6, 8, 2, 2); r('#3c9a4c', 9, 8, 2, 1); r('#9fb3c8', 2, 7, 2, 4); r('#9fb3c8', 12, 7, 2, 4);
    r('#4a5f78', 5, 12, 2, 3); r('#4a5f78', 9, 12, 2, 3);
  });
  SPR.rocket = sprite(16, 16, 4, r => {
    r('#eef', 6, 3, 4, 9); r('#d8342c', 7, 1, 2, 2); r('#d8342c', 4, 10, 2, 3); r('#d8342c', 10, 10, 2, 3);
    r('#2f6fd0', 7, 5, 2, 2); r('#ffb02c', 7, 12, 2, 2); r('#ffe066', 7, 14, 2, 1);
  });
  SPR.duck = sprite(16, 16, 4, r => {
    r('#ffd83a', 3, 8, 9, 5); r('#ffd83a', 9, 4, 4, 4); r('#f08a1c', 13, 6, 2, 1); r(INK, 11, 5); r('#e8b62c', 4, 10, 5, 2); r('#ffd83a', 2, 7, 2, 2);
  });
  SPR.teddy = sprite(20, 22, 3, r => {
    const b = '#a8683a', d = '#7c4a26', l = '#d9a877';
    r(b, 3, 1, 4, 4); r(b, 13, 1, 4, 4); r(l, 4, 2, 2, 2); r(l, 14, 2, 2, 2);
    r(b, 4, 3, 12, 8); r(l, 8, 7, 4, 3); r(INK, 9, 7, 2, 1); r(INK, 7, 5); r(INK, 12, 5);
    r(b, 5, 11, 10, 8); r(l, 7, 13, 6, 5); r(d, 2, 11, 3, 6); r(d, 15, 11, 3, 6); r(d, 4, 18, 5, 3); r(d, 11, 18, 5, 3); r(l, 5, 19, 3, 2); r(l, 12, 19, 3, 2);
  });
  SPR.dust = sprite(16, 12, 3, r => {
    const g = '#8d8fa3', d = '#6d6f85';
    r(g, 3, 2, 10, 8); r(g, 1, 4, 14, 4); r(d, 2, 3, 2, 1); r(d, 12, 8, 2, 1); r(g, 5, 0, 2, 2); r(g, 10, 1, 2, 2); r(g, 0, 6, 1, 1); r(g, 15, 5, 1, 1);
    r('#fff', 5, 4, 2, 3); r('#fff', 9, 4, 2, 3); r(INK, 6, 5); r(INK, 10, 5); r(d, 4, 10, 2, 1); r(d, 9, 10, 3, 1);
  });
}
const TOYSET = ['car', 'block', 'ball', 'dino', 'robot', 'rocket', 'duck', 'blockO', 'carBlue'];
const TOYNAME = { car: 'car', carBlue: 'car', block: 'block', blockO: 'block', ball: 'ball', dino: 'dino', robot: 'robot', rocket: 'rocket', duck: 'duck', trainBlue: 'blue train', trainRed: 'red train', puzzle: 'puzzle' };

// ---------------------------------------------------------------- level data
const LV = [null,
  { name: 'THE BEDROOM FLOOR', bg: 'bg1',
    rhyme: ['When bedtime chimes and lights go low,', 'the Toy Fairy starts to glow!'],
    hint: 'Walk over toys to grab them (carry 3), then run them to the toy box. Reach a glowing toy before the fairy finishes her spell!',
    fairy: { wait: 7, cast: 5.5, speed: 4.2 } },
  { name: 'BLOCK BRICK MAZE', bg: 'bg2',
    rhyme: ['Jump the blocks upon the rug,', 'avoid the giant teddy hug!'],
    hint: 'A teddy hug makes you drop your toys. Bump the yellow block to lift its flap - a lost red car is hiding underneath!',
    fairy: { wait: 8, cast: 6.5, speed: 4 } },
  { name: 'SOCK MOUNTAIN CLIMB', bg: 'bg3',
    rhyme: ['Climb the socks up to the bed,', 'collect the trains of blue and red!'],
    hint: 'Use the yellow sock steps to climb. Touch the spinning wheel at the peak to make the fairy dizzy!',
    fairy: { wait: 7, cast: 6, speed: 4 } },
  { name: 'THE TOY BOX WARP', bg: 'bg4',
    rhyme: ['Zoom right past the rolling ball,', 'drop the toys before they fall!'],
    hint: 'Put toys on the striped slide, then pull the lever to drop them into the toy chest. Toys on the slide are not safe yet!',
    fairy: { wait: 6.5, cast: 5.5, speed: 4.4 } },
  { name: 'BONUS: UNDER THE BED', bg: 'bg5',
    rhyme: ['Peek beneath the dusty frame,', 'grab the puzzles, win the game!'],
    hint: 'It is dark down here! Find the puzzle pieces and take them to the sparkling treasure chest. Dust bunnies make you sneeze.',
    fairy: { wait: 6, cast: 5, speed: 4.4 } },
];
const LESSON = "Packing away your toys before you go to sleep keeps your treasures safe, happy, and ready for tomorrow's big adventure!";
const WALLET = 'bc1qaem3wda6usdsflx8n45ysa84d7j77wm808faft';
const MAXLOST = 3, CARRY = 3, SPEED = 5.4;

// ---------------------------------------------------------------- state
const G = { state: 'load', t: 0, score: 0, levelScore: 0, hi: 0, stars: [], banner: '', bannerT: 0, ct: 0, pulled: false, shake: 0 };
try { G.hi = +localStorage.getItem('toyfairy_hi') || 0; } catch (e) { /* no storage */ }
let L = null, P = null, F = null, FX = [];
const keys = new Set();

function scr(i, j, z = 0) { return [L.ox + (i - j) * HW, L.oy + (i + j) * HH - z * L.hs * L.hscale]; }
function tileAt(i, j) { return L.tiles.get(K(Math.round(i), Math.round(j))); }
function inPoly(x, y, p) {
  let c = false;
  for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
    const [xa, ya] = p[a], [xb, yb] = p[b];
    if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c;
  }
  return c;
}
function near(sx, sy) { // closest walkable tile to a screen point
  let best = null, bd = 1e9;
  for (const t of L.tiles.values()) {
    if (t.solid) continue;
    const [x, y] = scr(t.i, t.j, t.h), d = (x - sx) ** 2 + (y - sy) ** 2;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
function bfs(from) { // breadth-first distances over walkable tiles (max 1 height step)
  const out = new Map(); if (!from) return out;
  out.set(K(from.i, from.j), { d: 0, prev: null, t: from });
  const q = [from];
  for (let h = 0; h < q.length; h++) {
    const t = q[h], n = out.get(K(t.i, t.j));
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const u = L.tiles.get(K(t.i + di, t.j + dj));
      if (!u || u.solid || Math.abs(u.h - t.h) > 1 || out.has(K(u.i, u.j))) continue;
      out.set(K(u.i, u.j), { d: n.d + 1, prev: t, t: u }); q.push(u);
    }
  }
  return out;
}
function pathTo(from, to) {
  const m = bfs(from); let node = m.get(K(to.i, to.j));
  if (!node) { // unreachable or solid: go to the reachable tile closest to it
    let bd = 1e9;
    for (const n of m.values()) { const d = (n.t.i - to.i) ** 2 + (n.t.j - to.j) ** 2; if (d < bd) { bd = d; node = n; } }
  }
  const p = [];
  while (node && node.prev) { p.unshift(node.t); node = m.get(K(node.prev.i, node.prev.j)); }
  return p;
}

// ---------------------------------------------------------------- level building
function build(n) {
  const def = LV[n];
  L = { n, def, ox: 688, oy: 0, hs: 14, hscale: 1, tiles: new Map(), toys: [], enemies: [], walls: [], dark: n === 5, time: 0, lost: 0, packed: 0, tip: 9 };
  FX = [];
  const add = (i, j, o) => { const t = Object.assign({ i, j, h: 0, solid: false }, o); L.tiles.set(K(i, j), t); return t; };
  const flat = poly => {
    for (let i = -30; i < 70; i++) for (let j = -40; j < 60; j++) {
      const x = L.ox + (i - j) * HW, y = L.oy + (i + j) * HH;
      if (inPoly(x, y, poly)) add(i, j);
    }
  };
  let reserved = [];
  if (n === 1) {
    flat([[40, 640], [600, 640], [640, 556], [1340, 556], [1340, 710], [40, 710]]);
    L.start = near(670, 630);
    const c = near(1270, 630); c.solid = true;
    L.chest = { i: c.i, j: c.j, drawn: true, range: 1.7 };
  } else if (n === 2) {
    L.ox = 690; L.oy = 224; const N = 15;
    for (let tries = 0; tries < 60; tries++) {
      L.tiles.clear();
      const open = new Set(), seen = new Set(['0,0']), stack = [[0, 0]];
      open.add('0,0');
      while (stack.length) { // depth-first maze carve on even cells
        const [ci, cj] = stack[stack.length - 1];
        const opts = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([a, b]) => ci + a >= 0 && ci + a < N && cj + b >= 0 && cj + b < N && !seen.has(K(ci + a, cj + b)));
        if (!opts.length) { stack.pop(); continue; }
        const [a, b] = pick(opts);
        open.add(K(ci + a / 2, cj + b / 2)); open.add(K(ci + a, cj + b)); seen.add(K(ci + a, cj + b)); stack.push([ci + a, cj + b]);
      }
      for (let k = 0; k < 26; k++) { // knock out extra walls so there are loops to dodge teddy
        const i = Math.floor(rnd(0, N)), j = Math.floor(rnd(0, N));
        if ((i % 2) !== (j % 2)) open.add(K(i, j));
      }
      const cols = ['#d8342c', '#2f6fd0', '#3c9a4c', '#e08a2c'];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const w = !open.has(K(i, j));
        add(i, j, { solid: w, wall: w, color: cols[(i * 7 + j * 3 + ((i * j) % 3)) % 4] });
      }
      L.tiles.get(K(14, 14)).solid = true; L.tiles.get(K(0, 14)).solid = true;
      const reach = bfs(L.tiles.get('0,0'));
      let ok = true;
      for (const t of L.tiles.values()) if (!t.solid && !reach.has(K(t.i, t.j))) ok = false;
      if (ok && reach.has('14,0')) break;
    }
    L.walls = [...L.tiles.values()].filter(t => t.wall);
    L.start = L.tiles.get('0,0');
    L.chest = { i: 14, j: 14, drawn: true, range: 1.5 };
    L.yellow = { i: 0, j: 14, open: 0, done: false };
    L.enemies.push({ type: 'teddy', i: 14, j: 0, ti: 14, tj: 0, sleep: 2, face: 1 });
  } else if (n === 3) {
    L.ox = 690; L.oy = 255; L.hs = 20; L.hscale = 0; const N = 13;
    const ramps = { '9,3': 1, '4,9': 1, '5,1': 3, '3,5': 3, '1,2': 5, '2,0': 5 };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const d = Math.max(i, j);
      let h = d <= 1 ? 6 : d <= 4 ? 4 : d <= 8 ? 2 : 0;
      const rp = ramps[K(i, j)] !== undefined; if (rp) h = ramps[K(i, j)];
      add(i, j, { h, ramp: rp });
    }
    L.blocks = [...L.tiles.values()];
    L.start = L.tiles.get('11,10');
    L.tiles.get('12,12').solid = true;
    L.chest = { i: 12, j: 12, drawn: true, range: 1.6 };
    L.tiles.get('0,0').solid = true;
    L.wheel = { i: 0, j: 0, spin: 0, used: false };
  } else if (n === 4) {
    flat([[10, 492], [250, 462], [570, 462], [672, 432], [672, 615], [990, 722], [10, 722]]);
    L.start = near(140, 600);
    const c = near(610, 530);
    L.pad = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]].map(([a, b]) => L.tiles.get(K(c.i + a, c.j + b))).filter(Boolean).slice(0, 4);
    L.chest = { i: c.i + 0.4, j: c.j + 0.4, drawn: false, range: 1.5, pad: true, tx: 965, ty: 440 };
    const lv = near(330, 485); lv.solid = true;
    L.lever = { i: lv.i, j: lv.j, t: 0 };
    reserved = L.pad.slice();
    [[90, 550, 3.6], [520, 630, -4.4], [260, 695, 4]].forEach(([x, y, s]) => {
      const t = near(x, y); L.enemies.push({ type: 'ball', i: t.i, j: t.j, s, roll: 0 });
    });
  } else if (n === 5) {
    flat([[250, 460], [1085, 460], [1360, 565], [1360, 714], [16, 714], [16, 550]]);
    L.start = near(250, 650);
    const c = near(850, 482);
    L.chest = { i: c.i, j: c.j, drawn: false, range: 1.5, tx: 850, ty: 440 };
    for (let k = 0; k < 3; k++) { const t = near(rnd(350, 1250), rnd(500, 690)); L.enemies.push({ type: 'dust', i: t.i, j: t.j, ti: t.i, tj: t.j, wait: rnd(0, 2) }); }
  }
  // toys on random reachable tiles
  const reach = [...bfs(L.start).values()].map(v => v.t);
  const taken = new Set();
  const free = (minH = 0) => {
    const c = reach.filter(t => !taken.has(K(t.i, t.j)) && t.h >= minH && !t.ramp && !reserved.includes(t)
      && Math.hypot(t.i - L.start.i, t.j - L.start.j) > 3 && Math.hypot(t.i - L.chest.i, t.j - L.chest.j) > 2.5);
    const t = pick(c); taken.add(K(t.i, t.j)); return t;
  };
  const toy = (type, t, state = 'floor') => L.toys.push({ type, spr: type === 'puzzle' ? pick(SPR.puzzles) : SPR[type], i: t.i, j: t.j, state, bob: rnd(0, 6), ft: 0 });
  if (n === 3) for (let k = 0; k < 8; k++) toy(k % 2 ? 'trainBlue' : 'trainRed', free(k < 6 ? 2 : 0));
  else if (n === 5) for (let k = 0; k < 10; k++) toy('puzzle', free());
  else for (let k = 0; k < 8; k++) toy(TOYSET[(k + n * 2) % TOYSET.length], free());
  if (n === 2) toy('car', L.yellow, 'hidden');
  L.total = L.toys.length;

  P = { i: L.start.i, j: L.start.j, z: L.start.h, face: 1, carry: [], stun: 0, shock: 0, inv: 0, moving: false, path: null, anim: 0 };
  F = { i: L.start.i - 6, j: L.start.j - 6, alt: 300, state: 'idle', t: def.fairy.wait + 2, target: null, face: 1, perch: pick(reach), dizzy: 0 };
  makeFloorLayer();
}

function diamond(c, x, y, s = 1) { c.beginPath(); c.moveTo(x, y - HH * s); c.lineTo(x + HW * s, y); c.lineTo(x, y + HH * s); c.lineTo(x - HW * s, y); c.closePath(); }
function makeFloorLayer() {
  const a = document.createElement('canvas'); a.width = W; a.height = H; const c = a.getContext('2d');
  const n = L.n;
  if (n === 2 || n === 3) { c.fillStyle = 'rgba(8,10,32,0.5)'; c.fillRect(0, 0, W, H); }
  if (n === 3) { // rug shadow under the mountain
    const [x, y] = scr(6, 6); c.fillStyle = 'rgba(10,12,40,0.75)'; diamond(c, x, y, 13.6); c.fill();
  } else for (const t of L.tiles.values()) {
    const [x, y] = scr(t.i, t.j); const alt = (t.i + t.j) & 1;
    diamond(c, x, y);
    if (n === 2) {
      const edge = t.i === 0 || t.j === 0 || t.i === 14 || t.j === 14;
      c.fillStyle = edge ? (alt ? '#8e3b34' : '#a3463c') : (alt ? '#245e6e' : '#2b6c7c'); c.fill();
      c.strokeStyle = 'rgba(10,20,40,0.5)'; c.stroke();
    } else {
      const pad = L.pad && L.pad.includes(t);
      c.fillStyle = pad ? (alt ? 'rgba(255,225,120,0.6)' : 'rgba(230,90,60,0.6)') : alt ? 'rgba(255,236,180,0.05)' : 'rgba(255,236,180,0.11)'; c.fill();
      c.strokeStyle = pad ? CREAM : 'rgba(255,236,190,0.2)'; c.lineWidth = pad ? 2 : 1; c.stroke();
    }
  }
  L.floor = a;
}

// ---------------------------------------------------------------- flow
function startLevel(n) { G.levelScore = G.score; build(n); G.state = 'intro'; G.t = 0; G.pulled = false; }
function say(s, t = 2.4) { G.banner = s; G.bannerT = t; }
function action() {
  if (AC && AC.state === 'suspended') AC.resume();
  if (G.state === 'welcome') { if (G.t > 0.6) { G.state = 'title'; G.t = 0; } }
  else if (G.state === 'thanks') { if (G.t > 1) { G.state = 'title'; G.t = 0; } }
  else if (G.state === 'title') { G.score = 0; G.stars = []; startLevel(1); }
  else if (G.state === 'intro' && G.t > 0.4) { G.state = 'cine'; G.ct = 0; if (L.n === 5) SFX.flap(); }
  else if (G.state === 'cine' && L.n === 1 && !G.pulled) pullMoon();
  else if (G.state === 'won' && G.t > 1) { if (L.n < 5) startLevel(L.n + 1); else finish(); }
  else if (G.state === 'lost' && G.t > 1) { G.score = G.levelScore; startLevel(L.n); }
  else if (G.state === 'end' && G.t > 2) { G.state = 'thanks'; G.t = 0; }
}
function pullMoon() { G.pulled = true; G.ct = 0; SFX.zip(); }
function finish() {
  G.state = 'end'; G.t = 0; G.newHi = G.score > G.hi;
  if (G.newHi) { G.hi = G.score; try { localStorage.setItem('toyfairy_hi', G.hi); } catch (e) { /* no storage */ } }
  SFX.win();
}
function win() {
  const stars = Math.max(1, 3 - L.lost), bonus = stars * 200 + Math.max(0, Math.round(90 - L.time)) * 5;
  L.stars = stars; L.bonus = bonus; G.score += bonus; G.stars[L.n] = stars;
  G.state = 'won'; G.t = 0; SFX.win();
}

// ---------------------------------------------------------------- movement
const PROBE = 0.2;
function valid(i, j) {
  const c = tileAt(i, j); if (!c || c.solid) return false;
  for (const [a, b] of [[PROBE, 0], [-PROBE, 0], [0, PROBE], [0, -PROBE]]) {
    const t = tileAt(i + a, j + b); if (!t || t.solid || Math.abs(t.h - c.h) > 1) return false;
  }
  return true;
}
function canMove(fi, fj, ti, tj) {
  const a = tileAt(fi, fj), b = tileAt(ti, tj);
  if (!b || b.solid || (a && Math.abs(a.h - b.h) > 1)) return false;
  return valid(ti, tj) || !valid(fi, fj);
}
function move(e, di, dj) {
  let m = false;
  if (di && canMove(e.i, e.j, e.i + di, e.j)) { e.i += di; m = true; }
  if (dj && canMove(e.i, e.j, e.i, e.j + dj)) { e.j += dj; m = true; }
  return m;
}
function dropToys() {
  const spots = [...L.tiles.values()].filter(t => !t.solid && Math.hypot(t.i - P.i, t.j - P.j) < 2.6 && Math.hypot(t.i - P.i, t.j - P.j) > 0.9);
  for (const t of P.carry) { const s = spots.length ? pick(spots) : tileAt(P.i, P.j); t.state = 'floor'; t.i = s.i; t.j = s.j; puff(...scr(s.i, s.j, s.h), '#fff', 4); }
  P.carry = [];
}
function puff(x, y, col, n = 10, sp = 90) {
  for (let k = 0; k < n; k++) FX.push({ x, y, vx: rnd(-sp, sp), vy: rnd(-sp, sp * 0.3), life: rnd(.4, .9), max: .9, col, size: rnd(3, 6) });
}
function floatText(s, x, y, col = '#fff') { FX.push({ text: s, x, y, vx: 0, vy: -40, life: 1.3, max: 1.3, col }); }

// ---------------------------------------------------------------- update
function update(dt) {
  G.t += dt; if (G.copied > 0) G.copied -= dt; if (G.bannerT > 0) G.bannerT -= dt; if (G.shake > 0) G.shake -= dt;
  for (const f of FX) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; if (!f.text) f.vy += 120 * dt; }
  FX = FX.filter(f => f.life > 0);
  if (G.state === 'cine') updCine(dt);
  else if (G.state === 'play') updPlay(dt);
  else if (G.state === 'won' || G.state === 'lost') { updToyFlights(dt); if (L.wheel) L.wheel.spin += dt * 2; }
}
function updCine(dt) {
  G.ct += dt; const n = L.n;
  let done = false;
  if (n === 1) {
    if (!G.pulled) { if (G.ct > 4.5) pullMoon(); }
    else {
      const t = G.ct / 1.9;
      if (Math.random() < 0.9) FX.push({ x: -100 + t * (W + 200), y: 190 - Math.sin(t * Math.PI) * 110 + rnd(-12, 12), vx: rnd(-30, 30), vy: rnd(-10, 40), life: .8, max: .8, col: pick(['#b8ff6a', '#fff7a0', '#7dffb0']), size: rnd(3, 7) });
      done = t >= 1.1;
    }
  } else if (n === 3) { L.hscale = easeBack(clamp(G.ct / 1.2, 0, 1)); done = G.ct > 1.5; if (done) L.hscale = 1; }
  else if (n === 5) done = G.ct > 1.7;
  else done = G.ct > 0.5;
  if (done) { G.state = 'play'; G.t = 0; SFX.chime(); }
}
function updToyFlights(dt) {
  for (const t of L.toys) if (t.state === 'fly') {
    t.ft += dt;
    if (t.ft >= t.dur) {
      if (t.toTray) { t.state = 'tray'; t.toTray = false; }
      else { t.state = 'packed'; L.packed++; G.score += 100; SFX.pack(); puff(t.tx, t.ty, GOLD, 8, 70); floatText('+100', t.tx, t.ty - 20, GOLD); }
    }
  }
}
function fling(t, fx, fy, tx, ty, delay = 0, toTray = false) {
  Object.assign(t, { state: 'fly', fx, fy, tx, ty, ft: -delay, dur: 0.55, toTray });
}
function chestTarget() {
  if (L.chest.tx) return [L.chest.tx, L.chest.ty];
  const [x, y] = scr(L.chest.i, L.chest.j, tileAt(L.chest.i, L.chest.j).h); return [x, y - 26];
}

function updPlay(dt) {
  L.time += dt; if (L.tip > 0) L.tip -= dt;
  // ---- player
  P.inv -= dt; P.shock -= dt; P.moving = false;
  if (P.stun > 0) P.stun -= dt;
  else {
    let mx = 0, my = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx--;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx++;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my--;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my++;
    if (mx || my) {
      P.path = null;
      let di = mx + my, dj = my - mx; const len = Math.hypot(di, dj) || 1;
      di = di / len * SPEED * dt; dj = dj / len * SPEED * dt;
      P.moving = move(P, di, dj); if (mx) P.face = mx;
    } else if (P.path && P.path.length) {
      const t = P.path[0], di = t.i - P.i, dj = t.j - P.j, d = Math.hypot(di, dj);
      if (d < 0.06) P.path.shift();
      else {
        const s = Math.min(d, SPEED * dt), oi = P.i, oj = P.j;
        P.moving = move(P, di / d * s, dj / d * s);
        if (!P.moving) { // bumped a corner: re-route from the middle of this square instead of giving up
          P.retry = (P.retry || 0) + 1;
          if (P.dest && P.retry <= 3) { const c = tileAt(P.i, P.j); P.path = [c, ...pathTo(c, P.dest)]; } else P.path = null;
        }
        const sx = (P.i - oi) - (P.j - oj); if (Math.abs(sx) > 0.001) P.face = Math.sign(sx);
      }
    }
  }
  if (P.moving) P.anim += dt;
  const pt = tileAt(P.i, P.j); if (pt) P.z += (pt.h - P.z) * Math.min(1, dt * 14);
  const [px, py] = scr(P.i, P.j, P.z);

  // ---- pick up
  for (const t of L.toys) {
    if (t.state === 'floor' && P.carry.length < CARRY && P.stun <= 0 && Math.hypot(t.i - P.i, t.j - P.j) < 0.75) {
      t.state = 'carry'; P.carry.push(t); SFX.pick();
      if (F.target === t) foil();
    }
  }
  // ---- pack away
  if (P.carry.length && Math.hypot(L.chest.i - P.i, L.chest.j - P.j) < L.chest.range) {
    const [tx, ty] = chestTarget();
    P.carry.forEach((t, k) => {
      if (L.chest.pad) {
        const slot = L.pad[L.toys.filter(o => o.state === 'tray' || (o.state === 'fly' && o.toTray)).length % L.pad.length];
        t.i = slot.i + rnd(-.2, .2); t.j = slot.j + rnd(-.2, .2);
        const [sx, sy] = scr(t.i, t.j); fling(t, px, py - 80, sx, sy - 12, k * 0.1, true);
      } else fling(t, px, py - 80, tx, ty, k * 0.12);
    });
    P.carry = [];
    if (L.chest.pad) { SFX.pick(); if (L.tip <= 0) say('NOW PULL THE LEVER!', 1.6); }
  }
  updToyFlights(dt);
  // ---- level gadgets
  if (L.yellow && !L.yellow.done && Math.hypot(L.yellow.i - P.i, L.yellow.j - P.j) < 1.35) {
    L.yellow.done = true; SFX.flap();
    const car = L.toys.find(t => t.state === 'hidden');
    const spot = [[0, -1], [1, 0], [0, -2], [2, 0]].map(([a, b]) => L.tiles.get(K(L.yellow.i + a, L.yellow.j + b))).find(t => t && !t.solid);
    car.i = spot.i; car.j = spot.j; car.state = 'floor';
    say('YOU FOUND THE LOST RED CAR!'); puff(...scr(L.yellow.i, L.yellow.j), GOLD, 16);
  }
  if (L.yellow && L.yellow.done) L.yellow.open = Math.min(1, L.yellow.open + dt * 2.5);
  if (L.wheel) {
    L.wheel.spin += dt * (F.dizzy > 0 ? 14 : 2);
    if (!L.wheel.used && Math.hypot(P.i - L.wheel.i, P.j - L.wheel.j) < 1.5 && P.z > 5) {
      L.wheel.used = true; F.dizzy = 12; G.score += 300; SFX.chime(); foil(true);
      say('WHEEL SPIN! THE FAIRY IS DIZZY!'); floatText('+300', px, py - 120, GOLD);
    }
  }
  if (L.lever) {
    L.lever.t = Math.max(0, L.lever.t - dt);
    const tray = L.toys.filter(t => t.state === 'tray');
    if (tray.length && L.lever.t <= 0 && Math.hypot(P.i - L.lever.i, P.j - L.lever.j) < 1.4) {
      L.lever.t = 1; SFX.lever();
      if (tray.includes(F.target)) foil();
      tray.forEach((t, k) => { const [sx, sy] = scr(t.i, t.j); fling(t, sx, sy - 12, L.chest.tx + rnd(-40, 40), L.chest.ty, k * 0.12); });
    }
  }
  // ---- enemies
  for (const e of L.enemies) {
    if (e.type === 'ball') {
      const d = Math.SQRT1_2 * Math.sign(e.s), sp = Math.abs(e.s) * dt;
      const a = tileAt(e.i + d * 0.8, e.j - d * 0.8);
      if (!a || a.solid) e.s = -e.s; else { e.i += d * sp; e.j -= d * sp; }
      e.roll += e.s * dt * 2;
    } else if (e.type === 'teddy') {
      if (e.sleep > 0) e.sleep -= dt;
      else {
        const di = e.ti - e.i, dj = e.tj - e.j, d = Math.hypot(di, dj);
        if (d < 0.05) {
          const here = tileAt(e.i, e.j), m = bfs(here), pn = m.get(K(Math.round(P.i), Math.round(P.j)));
          let next = null;
          if (pn && pn.d > 0 && pn.d <= 6) { let node = pn; while (node.prev && node.prev !== here) node = m.get(K(node.prev.i, node.prev.j)); next = node.t; }
          else {
            const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => L.tiles.get(K(here.i + a, here.j + b))).filter(t => t && !t.solid);
            const fwd = opts.filter(t => !(t.i === e.pi && t.j === e.pj));
            next = pick(fwd.length ? fwd : opts);
          }
          if (next) { e.pi = here.i; e.pj = here.j; e.ti = next.i; e.tj = next.j; }
        } else {
          const s = Math.min(d, 1.7 * dt); e.i += di / d * s; e.j += dj / d * s;
          const sx = di - dj; if (Math.abs(sx) > 0.01) e.face = Math.sign(sx);
        }
      }
    } else if (e.type === 'dust') {
      const di = e.ti - e.i, dj = e.tj - e.j, d = Math.hypot(di, dj);
      if (d < 0.05) {
        e.wait -= dt;
        if (e.wait <= 0) {
          const opts = [...L.tiles.values()].filter(t => !t.solid && Math.hypot(t.i - e.i, t.j - e.j) < 5);
          const t = pick(opts); e.ti = t.i; e.tj = t.j; e.wait = rnd(0.3, 1.5);
        }
      } else { const s = Math.min(d, 1.5 * dt); e.i += di / d * s; e.j += dj / d * s; }
    }
    if (P.inv <= 0 && (e.sleep || 0) <= 0 && Math.hypot(e.i - P.i, e.j - P.j) < 0.75) {
      P.inv = 2; P.path = null; SFX.bonk(); G.shake = 0.25;
      if (e.type === 'teddy') { P.stun = 1.5; e.sleep = 5; say('GIANT TEDDY HUG!'); dropToys(); }
      else if (e.type === 'ball') { P.stun = 0.7; say('BONK! WATCH THE ROLLING BALL!', 1.6); dropToys(); }
      else { P.stun = 0.9; floatText('ACHOO!', px, py - 110); puff(px, py - 40, '#aab', 12); }
    }
  }
  // ---- fairy
  updFairy(dt);
  // ---- win / lose
  if (L.lost >= MAXLOST) { G.state = 'lost'; G.t = 0; SFX.lose(); F.state = 'laugh'; return; }
  if (!L.toys.some(t => ['floor', 'carry', 'fly', 'tray', 'hidden'].includes(t.state))) win();
}
function foil(silent) {
  if (F.state !== 'fly' && F.state !== 'cast') return;
  if (F.state === 'cast' && !silent) { G.score += 50; const [x, y] = scr(F.i, F.j); floatText('SAVED! +50', x, y - 110, '#b8ff6a'); SFX.foil(); }
  F.state = 'foiled'; F.t = 1.2; F.target = null;
}
function updFairy(dt) {
  const f = L.def.fairy;
  const go = (ti, tj, sp) => {
    const di = ti - F.i, dj = tj - F.j, d = Math.hypot(di, dj);
    if (d < 0.05) return true;
    const s = Math.min(d, sp * dt); F.i += di / d * s; F.j += dj / d * s;
    const sx = di - dj; if (Math.abs(sx) > 0.05) F.face = Math.sign(sx);
    return false;
  };
  let alt = 62;
  if (F.dizzy > 0) { F.dizzy -= dt; alt = 80; F.state = 'idle'; F.t = Math.max(F.t, 2); F.target = null; }
  else if (F.state === 'idle') {
    if (go(F.perch.i, F.perch.j, f.speed * 0.5)) F.perch = pick([...L.tiles.values()].filter(t => !t.solid));
    F.t -= dt;
    if (F.t <= 0) {
      const c = L.toys.filter(t => t.state === 'floor' || t.state === 'tray');
      if (c.length) { F.target = pick(c); F.state = 'fly'; SFX.warn(); } else F.t = 1;
    }
  } else if (F.state === 'fly') {
    const t = F.target;
    if (!t || (t.state !== 'floor' && t.state !== 'tray')) foil();
    else if (go(t.i - 0.35, t.j + 0.35, f.speed)) { F.state = 'cast'; F.t = f.cast; F.face = 1; }
  } else if (F.state === 'cast') {
    alt = 26; const t = F.target;
    if (!t || (t.state !== 'floor' && t.state !== 'tray')) foil();
    else {
      F.t -= dt;
      if (Math.random() < 0.3) { const [x, y] = scr(t.i, t.j, tileAt(t.i, t.j).h); FX.push({ x: x + rnd(-18, 18), y: y - rnd(0, 30), vx: 0, vy: -70, life: .6, max: .6, col: '#b8ff6a', size: 4 }); }
      if (F.t <= 0) {
        t.state = 'gone'; L.lost++; SFX.steal(); G.shake = 0.3;
        const [x, y] = scr(t.i, t.j, tileAt(t.i, t.j).h); puff(x, y - 14, '#b8ff6a', 22, 130);
        say(`THE FAIRY TOOK YOUR ${(TOYNAME[t.type] || 'toy').toUpperCase()}!`);
        P.shock = 1.1; F.state = 'laugh'; F.t = 1.8; F.target = null;
      }
    }
  } else { F.t -= dt; if (F.t <= 0) { F.state = 'idle'; F.t = f.wait; } }
  F.alt += (alt - F.alt) * Math.min(1, dt * 4);
}

// ---------------------------------------------------------------- drawing helpers
function text(s, x, y, size, col = '#fff', align = 'left', shadow = INK) {
  ctx.font = size + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (shadow) { const o = Math.max(2, Math.round(size / 8)); ctx.fillStyle = shadow; ctx.fillText(s, x + o, y + o); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function wrap(s, maxW, size) {
  ctx.font = size + 'px ' + FONT; const out = []; let line = '';
  for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
function panel(x, y, w, h, fill = CREAM) {
  ctx.fillStyle = INK; ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.fillStyle = '#c9a85a'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
}
function big3d(s, x, y, size, col, side, depth = 6) {
  ctx.font = size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = INK; ctx.fillText(s, x + depth + 3, y + depth + 3);
  ctx.fillStyle = side; for (let k = depth; k > 0; k--) ctx.fillText(s, x + k, y + k);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), c = k => clamp(Math.round(((n >> k) & 255) * f), 0, 255);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
function blockSides(x, y, z0, z1, left, right) { // side faces of an iso block between heights z0..z1 (px)
  ctx.fillStyle = left; ctx.beginPath(); ctx.moveTo(x - HW, y - z0); ctx.lineTo(x, y + HH - z0); ctx.lineTo(x, y + HH - z1); ctx.lineTo(x - HW, y - z1); ctx.fill();
  ctx.fillStyle = right; ctx.beginPath(); ctx.moveTo(x + HW, y - z0); ctx.lineTo(x, y + HH - z0); ctx.lineTo(x, y + HH - z1); ctx.lineTo(x + HW, y - z1); ctx.fill();
}
function block(x, y, h, top, left, right) {
  blockSides(x, y, 0, h, left, right);
  ctx.fillStyle = top; diamond(ctx, x, y - h); ctx.fill();
  ctx.strokeStyle = 'rgba(20,12,40,0.55)'; ctx.lineWidth = 1; ctx.stroke();
}
function shadow(x, y, w = 22, a = 0.35) { ctx.fillStyle = `rgba(8,6,24,${a})`; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.42, 0, 0, 7); ctx.fill(); }
function img(im, x, y, h, flip = false, smooth = true) { // draw anchored bottom-centre at a given height
  if (!im) return;
  const s = h / im.height, w = im.width * s;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (flip) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = smooth; ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
function spr(c, x, y, s = 1) { ctx.imageSmoothingEnabled = false; const w = c.width * s, h = c.height * s; ctx.drawImage(c, Math.round(x - w / 2), Math.round(y - h), w, h); }

const SOCK = ['#3b6fb5', '#c0392b', '#e0a030', '#3e9b4f', '#8a55b0', '#d8d8e8'];
function drawSockBlock(t) {
  const [x, y] = scr(t.i, t.j), band = L.hs * L.hscale, base = (t.i >> 1) + (t.j >> 1) * 2;
  for (let n = 0; n < t.h; n++) {
    const c = SOCK[(base + n) % SOCK.length];
    blockSides(x, y, n * band, (n + 1) * band + 0.5, shade(c, 0.78), shade(c, 0.55));
  }
  const tc = t.ramp ? '#ffd24a' : t.h === 0 ? '#2b6c7c' : SOCK[(base + t.h) % SOCK.length];
  ctx.fillStyle = t.ramp ? tc : shade(tc, t.h === 0 ? ((t.i + t.j) & 1 ? 0.9 : 1) : 1.12);
  diamond(ctx, x, y - t.h * band); ctx.fill();
  ctx.strokeStyle = 'rgba(20,12,40,0.5)'; ctx.lineWidth = 1; ctx.stroke();
  if (t.ramp) { ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 14, y - t.h * band); ctx.lineTo(x + 14, y - t.h * band); ctx.stroke(); }
}
function drawChest(x, y, glow) {
  if (glow) { ctx.fillStyle = `rgba(255,210,74,${0.25 + 0.2 * Math.sin(G.t * 6)})`; diamond(ctx, x, y, 1.9); ctx.fill(); }
  // open lid standing at the back
  ctx.fillStyle = '#b87333'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - HW, y - 30); ctx.lineTo(x, y - 46); ctx.lineTo(x + 6, y - 84); ctx.lineTo(x - 26, y - 68); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a5222'; ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x + HW, y - 30); ctx.lineTo(x + 38, y - 68); ctx.lineTo(x + 6, y - 84); ctx.closePath(); ctx.fill(); ctx.stroke();
  block(x, y, 30, '#2a160c', '#a0612c', '#7c4720');
  ctx.strokeStyle = 'rgba(40,20,8,0.7)'; ctx.lineWidth = 2;
  for (const k of [10, 20]) { ctx.beginPath(); ctx.moveTo(x - HW, y - k); ctx.lineTo(x, y + HH - k); ctx.lineTo(x + HW, y - k); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x - HW, y); ctx.lineTo(x, y + HH); ctx.lineTo(x + HW, y); ctx.lineTo(x + HW, y - 30); ctx.lineTo(x, y - 30 + HH); ctx.lineTo(x - HW, y - 30); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = GOLD; ctx.fillRect(x - 4, y - 12, 8, 10); ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 8, 2, 4);
}
function drawToyAt(t, x, y, s = 1) {
  const targeted = F && F.target === t;
  if (targeted) {
    const p = 0.5 + 0.5 * Math.sin(G.t * 10);
    ctx.fillStyle = `rgba(150,255,90,${0.25 + 0.3 * p})`; diamond(ctx, x, y, 0.9); ctx.fill();
    ctx.strokeStyle = '#b8ff6a'; ctx.lineWidth = 3; diamond(ctx, x, y, 0.9 + 0.1 * p); ctx.stroke();
    if (F.state === 'cast') { x += rnd(-1.5, 1.5); }
  }
  shadow(x, y, 20, 0.3);
  spr(t.spr, x, y + 6 - Math.abs(Math.sin(G.t * 2.5 + t.bob)) * 5, s);
  if (targeted) {
    const k = F.state === 'cast' ? 1 - F.t / L.def.fairy.cast : 0;
    ctx.fillStyle = INK; ctx.fillRect(x - 24, y - 70, 48, 10);
    ctx.fillStyle = k > 0.66 ? '#ff5a4a' : '#b8ff6a'; ctx.fillRect(x - 22, y - 68, 44 * k, 6);
    text('!', x, y - 88 - 4 * Math.sin(G.t * 12), 18, '#b8ff6a', 'center');
  }
}
function drawBoy() {
  const [x, y] = scr(P.i, P.j, P.z);
  shadow(x, y + 2, 20);
  let im = IMG.boy_run2, h = 116;
  if (G.state === 'won') im = IMG.boy_cheer;
  else if (P.stun > 0 || P.shock > 0 || G.state === 'lost') im = IMG.boy_shock;
  else if (P.moving) im = Math.floor(P.anim * 9) % 2 ? IMG.boy_run1 : IMG.boy_run2;
  if (im === IMG.boy_run1) h = 111;
  if (P.inv > 0 && P.stun <= 0 && Math.floor(G.t * 14) % 2) ctx.globalAlpha = 0.5;
  const hop = P.moving ? Math.abs(Math.sin(P.anim * 14)) * 4 : 0;
  img(im, x, y + 6 - hop, h, P.face < 0);
  ctx.globalAlpha = 1;
  P.carry.forEach((t, k) => spr(t.spr, x, y - 116 - k * 30 - hop, 0.7));
}
function fairyFrame() {
  const k = Math.floor(G.t * 7);
  if (F.dizzy > 0 || F.state === 'foiled') return IMG['fairy_hit' + k % 2];
  if (F.state === 'cast') return IMG['fairy_cast' + k % 2];
  if (F.state === 'laugh') return IMG['fairy_laugh' + k % 2];
  return IMG['fairy_hover' + k % 3];
}
function drawFairy() {
  const t = tileAt(F.i, F.j), [x, y] = scr(F.i, F.j, t ? t.h : 0);
  const fy = y - F.alt + Math.sin(G.t * 4) * 6;
  shadow(x, y, 14, 0.25);
  const g = ctx.createRadialGradient(x, fy - 40, 4, x, fy - 40, 70);
  g.addColorStop(0, 'rgba(170,255,110,0.5)'); g.addColorStop(1, 'rgba(170,255,110,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 70, fy - 110, 140, 140);
  ctx.save();
  if (F.dizzy > 0) { ctx.translate(x, fy - 40); ctx.rotate(Math.sin(G.t * 9) * 0.5); ctx.translate(-x, -(fy - 40)); }
  img(fairyFrame(), x, fy, 96, F.face < 0);
  ctx.restore();
  if (F.dizzy > 0) for (let k = 0; k < 3; k++) { const a = G.t * 6 + k * 2.1; text('*', x + Math.cos(a) * 30, fy - 92 + Math.sin(a) * 8, 14, GOLD, 'center'); }
}
function drawEnemy(e) {
  const [x, y] = scr(e.i, e.j);
  if (e.type === 'ball') {
    shadow(x, y + 2, 24);
    ctx.save(); ctx.translate(x, y - 28); ctx.rotate(e.roll); ctx.imageSmoothingEnabled = false; ctx.drawImage(SPR.bigBall, -36, -36, 72, 72); ctx.restore();
  } else if (e.type === 'teddy') {
    shadow(x, y + 2, 26);
    ctx.save(); ctx.translate(x, 0); if (e.face < 0) ctx.scale(-1, 1); spr(SPR.teddy, 0, y + 6 - (e.sleep > 0 ? 0 : Math.abs(Math.sin(G.t * 7)) * 4), 1.15); ctx.restore();
    if (e.sleep > 0) text('Zz', x + 20, y - 80 - Math.sin(G.t * 3) * 5, 14, '#bfe6ff', 'center');
  } else { shadow(x, y, 16, 0.3); spr(SPR.dust, x, y + 4 - Math.abs(Math.sin(G.t * 5 + e.i)) * 5, 0.8); }
}
function drawYellow() {
  const o = L.yellow, [x, y] = scr(o.i, o.j), k = o.open;
  blockSides(x, y, 0, 30, '#d9a81c', '#b0860f');
  ctx.fillStyle = k > 0 ? '#5a4208' : '#f7d21e'; diamond(ctx, x, y - 30); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  if (k > 0) { // the lifted flap
    ctx.fillStyle = '#f7d21e'; ctx.beginPath();
    ctx.moveTo(x - HW, y - 30); ctx.lineTo(x, y - 46); ctx.lineTo(x + k * 10, y - 46 - k * 40); ctx.lineTo(x - HW + k * 10, y - 30 - k * 40); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else text('?', x, y - 30, 16, '#7a5a08', 'center', null);
  if (!o.done) text('v', x, y - 62 - Math.abs(Math.sin(G.t * 5)) * 8, 14, GOLD, 'center');
}
function drawWheel() {
  const w = L.wheel, [x, y] = scr(w.i, w.j, 6);
  ctx.fillStyle = '#7c4720'; ctx.fillRect(x - 3, y - 44, 6, 46); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 44, 6, 46);
  const cols = ['#d8342c', '#ffd24a', '#2f6fd0', '#3c9a4c', '#e08a2c', '#fff', '#8a55b0', '#59c06a'];
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.moveTo(x, y - 62);
    ctx.arc(x, y - 62, 30, w.spin + k * Math.PI / 4, w.spin + (k + 1) * Math.PI / 4); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 62, 30, 0, 7); ctx.stroke();
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(x, y - 62, 5, 0, 7); ctx.fill();
  if (!w.used) text('v', x, y - 106 - Math.abs(Math.sin(G.t * 5)) * 8, 14, GOLD, 'center');
}
function drawLever() {
  const l = L.lever, [x, y] = scr(l.i, l.j), ready = L.toys.some(t => t.state === 'tray');
  if (ready) { ctx.fillStyle = `rgba(255,210,74,${0.25 + 0.2 * Math.sin(G.t * 6)})`; diamond(ctx, x, y, 1.8); ctx.fill(); }
  block(x, y, 14, '#8d8fa3', '#6d6f85', '#4f5168');
  const a = l.t > 0 ? 0.6 : -0.6;
  ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + Math.sin(a) * 42, y - 14 - Math.cos(a) * 42); ctx.stroke();
  ctx.strokeStyle = '#d9d9e6'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#d8342c'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + Math.sin(a) * 42, y - 14 - Math.cos(a) * 42, 9, 0, 7); ctx.fill(); ctx.stroke();
  text('LEVER', x, y + 30, 10, ready ? GOLD : CREAM, 'center');
  if (ready) text('v', x, y - 76 - Math.abs(Math.sin(G.t * 5)) * 8, 14, GOLD, 'center');
}

// ---------------------------------------------------------------- world render
function drawWorld() {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(IMG[L.def.bg], 0, 0, W, H);
  ctx.save();
  if (G.shake > 0) ctx.translate(rnd(-4, 4), rnd(-4, 4));
  ctx.drawImage(L.floor, 0, 0);
  const D = [], push = (d, f) => D.push({ d, f });
  const dep = (i, j) => Math.round(i) + Math.round(j);
  for (const t of L.walls) push(t.i + t.j, () => { const [x, y] = scr(t.i, t.j); block(x, y, 18, shade(t.color, 1.15), shade(t.color, 0.8), shade(t.color, 0.55)); });
  if (L.blocks) for (const t of L.blocks) push(t.i + t.j, () => drawSockBlock(t));
  const carrying = P.carry.length > 0;
  if (L.chest.drawn) push(dep(L.chest.i, L.chest.j) + 0.1, () => { const [x, y] = scr(L.chest.i, L.chest.j); drawChest(x, y, carrying); });
  else if (carrying) push(-99, () => { const [x, y] = scr(L.chest.i, L.chest.j); ctx.fillStyle = `rgba(255,210,74,${0.25 + 0.2 * Math.sin(G.t * 6)})`; diamond(ctx, x, y, 2.2); ctx.fill(); });
  if (L.yellow) push(dep(L.yellow.i, L.yellow.j) + 0.1, drawYellow);
  if (L.wheel) push(0.1, drawWheel);
  if (L.lever) push(dep(L.lever.i, L.lever.j) + 0.1, drawLever);
  for (const t of L.toys) if (t.state === 'floor' || t.state === 'tray')
    push(dep(t.i, t.j) + 0.4, () => { const [x, y] = scr(t.i, t.j, tileAt(t.i, t.j).h); drawToyAt(t, x, y); });
  for (const e of L.enemies) push(dep(e.i, e.j) + 0.5, () => drawEnemy(e));
  push(dep(P.i, P.j) + 0.5, drawBoy);
  if (G.state !== 'cine' && G.state !== 'intro') push(dep(F.i, F.j) + 0.6, drawFairy);
  D.sort((a, b) => a.d - b.d).forEach(o => o.f());
  // flying toys
  for (const t of L.toys) if (t.state === 'fly') {
    const k = clamp(t.ft / t.dur, 0, 1), x = t.fx + (t.tx - t.fx) * k, y = t.fy + (t.ty - t.fy) * k - Math.sin(k * Math.PI) * 90;
    spr(t.spr, x, y + 20, 0.9);
  }
  // chest arrow
  if (carrying && G.state === 'play') { const [x, y] = chestTarget(); text('v', x, y - 70 - Math.abs(Math.sin(G.t * 5)) * 10, 20, GOLD, 'center'); }
  if (L.dark) drawDark();
  for (const f of FX) {
    ctx.globalAlpha = clamp(f.life / f.max * 1.5, 0, 1);
    if (f.text) text(f.text, f.x, f.y, 14, f.col, 'center'); else { ctx.fillStyle = f.col; ctx.fillRect(Math.round(f.x), Math.round(f.y), f.size, f.size); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
let darkCv = null;
function drawDark() {
  if (!darkCv) { darkCv = document.createElement('canvas'); darkCv.width = W; darkCv.height = H; }
  const c = darkCv.getContext('2d');
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(3,4,22,0.86)'; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r) => { const g = c.createRadialGradient(x, y, r * 0.25, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const [px, py] = scr(P.i, P.j); hole(px, py - 40, 210 + Math.sin(G.t * 3) * 6);
  hole(850, 430, 150);
  const [fx, fy] = scr(F.i, F.j); hole(fx, fy - F.alt - 30, 110);
  if (F.target) { const [x, y] = scr(F.target.i, F.target.j); hole(x, y - 10, 80); }
  ctx.drawImage(darkCv, 0, 0);
}
function drawHUD() {
  ctx.fillStyle = 'rgba(16,10,36,0.82)'; ctx.fillRect(0, 0, W, 46);
  ctx.fillStyle = '#c9a85a'; ctx.fillRect(0, 46, W, 3);
  text(`LEVEL ${L.n}`, 16, 24, 16, GOLD);
  text(L.def.name, 150, 24, 12, CREAM);
  text(`PACKED ${L.packed}/${L.total}`, 560, 24, 14, '#9fe8ff');
  text('FAIRY', 850, 24, 12, '#b8ff6a');
  for (let k = 0; k < MAXLOST; k++) {
    const x = 940 + k * 30; ctx.fillStyle = INK; diamond(ctx, x, 23, 0.42); ctx.fill();
    ctx.fillStyle = k < L.lost ? '#7dff4a' : '#3a3358'; diamond(ctx, x, 23, 0.3); ctx.fill();
  }
  text(`SCORE ${String(G.score).padStart(5, '0')}`, W - 16, 24, 14, '#fff', 'right');
  if (G.bannerT > 0 && G.state === 'play') {
    ctx.font = '16px ' + FONT; const w = ctx.measureText(G.banner).width + 40;
    panel(W / 2 - w / 2, 70, w, 40); text(G.banner, W / 2, 91, 16, '#b02a1c', 'center', null);
  } else if (G.state === 'play' && L.tip > 0) {
    ctx.fillStyle = 'rgba(16,10,36,0.75)'; ctx.fillRect(W / 2 - 430, 62, 860, 30);
    text('WASD / ARROWS OR CLICK TO MOVE   R: RESTART   M: SOUND', W / 2, 78, 11, CREAM, 'center');
  }
}

// ---------------------------------------------------------------- screens
function drawIntro() {
  ctx.fillStyle = 'rgba(8,8,30,0.6)'; ctx.fillRect(0, 0, W, H);
  const x = 150, y = 150, w = 800, h = 440, cx = x + w / 2;
  const pop = easeBack(clamp(G.t / 0.35, 0, 1));
  ctx.save(); ctx.translate(cx, y + h / 2); ctx.scale(pop, pop); ctx.translate(-cx, -(y + h / 2));
  panel(x, y, w, h);
  text(`LEVEL ${L.n}`, cx, y + 50, 18, '#b02a1c', 'center', null);
  big3d(L.def.name, cx, y + 108, L.def.name.length > 18 ? 28 : 32, '#2f6fd0', '#16306a', 4);
  L.def.rhyme.forEach((s, k) => text(s, cx, y + 180 + k * 34, 15, INK, 'center', null));
  ctx.fillStyle = '#c9a85a'; ctx.fillRect(x + 60, y + 246, w - 120, 3);
  wrap(L.def.hint, w - 110, 12).forEach((s, k) => text(s, cx, y + 280 + k * 24, 12, '#5a3a1a', 'center', null));
  if (Math.floor(G.t * 2) % 2) text('PRESS SPACE OR CLICK', cx, y + h - 36, 14, '#b02a1c', 'center', null);
  ctx.restore();
  img(IMG.fairy_big, 1130, 640 + Math.sin(G.t * 2.5) * 12, 430);
}
function drawCine() {
  const n = L.n;
  if (n === 1) {
    if (!G.pulled) {
      ctx.fillStyle = `rgba(255,214,140,${0.22})`; ctx.fillRect(0, 0, W, H);
      const b = Math.abs(Math.sin(G.t * 4)) * 10;
      ctx.fillStyle = INK; ctx.fillRect(771, 232, 34, 70 + b); ctx.fillStyle = CREAM; ctx.fillRect(775, 232, 26, 66 + b);
      text('v', 788, 280 + b, 16, '#b02a1c', 'center', null);
      panel(W / 2 - 250, 330, 500, 46); text('PULL THE MOON TAB! (CLICK)', W / 2, 354, 14, '#b02a1c', 'center', null);
    } else {
      const t = G.ct / 1.9, a = Math.max(0, 0.22 * (1 - t * 2));
      ctx.fillStyle = `rgba(255,214,140,${a})`; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(10,10,50,${Math.min(0.25, t * 0.4) * (1 - clamp(t - 0.8, 0, 0.3) / 0.3)})`; ctx.fillRect(0, 0, W, H);
      const x = -100 + t * (W + 200), y = 190 - Math.sin(t * Math.PI) * 110;
      const g = ctx.createRadialGradient(x, y - 50, 5, x, y - 50, 120); g.addColorStop(0, 'rgba(190,255,120,0.7)'); g.addColorStop(1, 'rgba(190,255,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 120, y - 170, 240, 240);
      img(IMG['fairy_hover' + Math.floor(G.t * 10) % 3], x, y, 130);
    }
  } else if (n === 5) { // bed-skirt accordion unfolding away
    const k = 1 - clamp(G.ct / 1.4, 0, 1), pleats = 9, pw = (W / 2) / pleats * k;
    for (const side of [0, 1]) for (let p = 0; p < pleats; p++) {
      const x = side ? W - (p + 1) * pw : p * pw;
      ctx.fillStyle = p % 2 ? '#16224f' : '#22357a'; ctx.fillRect(x, 0, pw + 1, H);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, 0, 3, H);
    }
  }
}
function drawStars(cx, y, n, t) {
  for (let k = 0; k < 3; k++) {
    const on = k < n && t > 0.4 + k * 0.3, s = on ? easeBack(clamp((t - 0.4 - k * 0.3) / 0.3, 0, 1)) : 1, x = cx + (k - 1) * 90;
    ctx.fillStyle = on ? GOLD : '#b8a988'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath();
    for (let p = 0; p < 10; p++) { const r = (p % 2 ? 15 : 34) * s, a = -Math.PI / 2 + p * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.stroke(); ctx.fill();
  }
}
function drawResult() {
  ctx.fillStyle = 'rgba(8,8,30,0.55)'; ctx.fillRect(0, 0, W, H);
  const won = G.state === 'won', w = 760, h = 380, x = W / 2 - w / 2, y = 190, cx = W / 2;
  panel(x, y, w, h);
  if (won) {
    big3d('ROOM TIDY!', cx, y + 64, 40, '#3c9a4c', '#1e5a2a');
    drawStars(cx, y + 150, L.stars, G.t);
    text(`TOYS PACKED ${L.packed}/${L.total}   TAKEN ${L.lost}`, cx, y + 222, 14, INK, 'center', null);
    text(`BONUS +${L.bonus}`, cx, y + 256, 14, '#b02a1c', 'center', null);
    text(`SCORE ${G.score}`, cx, y + 292, 18, '#2f6fd0', 'center', null);
    if (Math.floor(G.t * 2) % 2) text(L.n < 5 ? 'PRESS SPACE FOR THE NEXT LEVEL' : 'PRESS SPACE... TIME FOR BED!', cx, y + h - 34, 13, '#b02a1c', 'center', null);
  } else {
    big3d('OH NO!', cx, y + 64, 40, '#d8342c', '#7a1d12');
    text('The Toy Fairy took too many toys!', cx, y + 140, 15, INK, 'center', null);
    wrap('Pack them away faster - run to the glowing toy to stop her spell.', w - 280, 12).forEach((s, k) => text(s, cx - 60, y + 190 + k * 24, 12, '#5a3a1a', 'center', null));
    img(IMG['fairy_laugh' + Math.floor(G.t * 7) % 2], x + w - 90, y + 300, 150);
    if (Math.floor(G.t * 2) % 2) text('PRESS SPACE TO TRY AGAIN', cx, y + h - 34, 13, '#b02a1c', 'center', null);
  }
}
function drawTitle() {
  ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.bg1, 0, 0, W, H);
  ctx.fillStyle = 'rgba(8,8,34,0.55)'; ctx.fillRect(0, 0, W, H);
  big3d('THE TOY FAIRY', 560, 130, 62, GOLD, '#b0541c', 8);
  text('A BEDTIME TIDY-UP ADVENTURE', 560, 205, 16, '#9fe8ff', 'center');
  panel(140, 270, 840, 300);
  ['When night-time comes, the Toy Fairy takes away', 'any toys that are not packed away!'].forEach((s, k) => text(s, 560, 310 + k * 28, 14, INK, 'center', null));
  [['MOVE', 'WASD / ARROW KEYS, or CLICK where to go'], ['GRAB', 'walk over a toy (carry up to 3)'], ['PACK', 'run to the toy box to put them away'], ['SAVE', 'reach a glowing toy before her spell ends']]
    .forEach(([a, b], k) => { text(a, 190, 396 + k * 34, 14, '#b02a1c', 'left', null); text(b, 300, 396 + k * 34, 12, '#5a3a1a', 'left', null); });
  if (Math.floor(G.t * 2) % 2) text('PRESS SPACE OR CLICK TO START', 560, 640, 18, '#fff', 'center');
  if (G.hi) text(`HIGH SCORE ${G.hi}`, 560, 700, 14, GOLD, 'center');
  img(IMG.fairy_big, 1170, 690 + Math.sin(G.t * 2.5) * 14, 500);
  for (let k = 0; k < 8; k++) { const a = G.t * 1.5 + k * 0.8; text('+', 1010 + Math.cos(a) * 60 + k * 6, 300 + Math.sin(a * 1.3) * 50, 12, k % 2 ? GOLD : '#b8ff6a', 'center', null); }
}
function drawEnd() {
  ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.bg6, 0, 0, W, H);
  const t = G.t;
  // fairy flying off outside the window
  const fx = 830 + ((t * 30) % 190), fy = 150 + Math.sin(t * 2) * 30;
  ctx.save(); ctx.beginPath(); ctx.rect(812, 40, 170, 250); ctx.clip(); ctx.globalAlpha = 0.85; img(IMG['fairy_hover' + Math.floor(t * 7) % 3], fx, fy, 56); ctx.restore();
  // pop-out banner on the cream board
  const s = easeBack(clamp(t / 0.7, 0, 1)), cx = 361, cy = 121;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.rotate(Math.sin(t * 2) * 0.015);
  big3d('LEVEL', 0, -36, 46, '#e8452c', '#7a1d12', 7); big3d('COMPLETE!', 0, 34, 46, '#2f6fd0', '#16306a', 7);
  ctx.restore();
  for (let k = 0; k < 14; k++) { const a = k * 2.4 + t; text(k % 2 ? '+' : '*', 361 + Math.cos(a) * (330 + 20 * Math.sin(t * 3 + k)), 121 + Math.sin(a) * 110, 14, [GOLD, '#b8ff6a', '#ff8a6a', '#9fe8ff'][k % 4], 'center'); }
  // sweet dreams
  for (let k = 0; k < 3; k++) { const p = ((t * 0.5 + k / 3) % 1); ctx.globalAlpha = 1 - p; text('Z', 350 + p * 60 + k * 6, 290 - p * 70, 12 + p * 14, '#bfe6ff', 'center'); } ctx.globalAlpha = 1;
  for (let k = 0; k < 6; k++) { const a = t * 2 + k; text('+', 1185 + Math.cos(a) * 150, 480 + Math.sin(a * 1.4) * 70, 12, GOLD, 'center', null); }
  // score + lesson
  ctx.fillStyle = 'rgba(16,10,36,0.86)'; ctx.fillRect(190, 566, 996, 186); ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 3; ctx.strokeRect(190, 566, 996, 186);
  text('SWEET DREAMS!', W / 2, 594, 20, GOLD, 'center');
  const st = G.stars.reduce((a, b) => a + (b || 0), 0);
  text(`${G.newHi ? 'NEW HIGH SCORE' : 'SCORE'} ${G.score}    STARS ${st}/15    BEST ${G.hi}`, W / 2, 628, 13, '#9fe8ff', 'center');
  wrap(LESSON, 920, 12).forEach((l, k) => text(l, W / 2, 662 + k * 22, 12, CREAM, 'center'));
  if (t > 2 && Math.floor(t * 2) % 2) text('PRESS SPACE TO CONTINUE', W / 2, 734, 12, '#fff', 'center');
}

function drawSupport() { // AdFreeGaming welcome / thank-you screen with the donation wallet
  const end = G.state === 'thanks', t = G.t;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG[end ? 'bg6' : 'bg1'], 0, 0, W, H);
  ctx.fillStyle = 'rgba(8,8,34,0.7)'; ctx.fillRect(0, 0, W, H);
  const x = 138, y = 84, w = 1100, h = 600, cx = x + w / 2;
  panel(x, y, w, h);
  big3d('AdFreeGaming', cx, y + 70, 46, '#2f6fd0', '#16306a', 6);
  text(end ? 'THANK YOU FOR PLAYING!' : 'THANK YOU FOR VISITING!', cx, y + 136, 20, '#b02a1c', 'center', null);
  ctx.fillStyle = '#c9a85a'; ctx.fillRect(x + 60, y + 168, w - 120, 3);
  const lines = end
    ? ['You tidied the whole room with no ads,', 'no pop-ups and no sign-up.', '', 'If that matters to you, please consider', 'donating to my Bitcoin wallet.', 'Every little bit keeps the games ad-free!']
    : ['The games here are free to play, with', 'no ads, no pop-ups and no sign-up.', '', 'If this matters to you, please consider', 'donating to my Bitcoin wallet.', 'Every little bit keeps the games ad-free!'];
  lines.forEach((s, k) => text(s, x + 60, y + 216 + k * 32, 14, k > 2 ? '#5a3a1a' : INK, 'left', null));
  // QR code on a white card
  const q = 250, qx = x + w - q - 76, qy = y + 190;
  ctx.fillStyle = INK; ctx.fillRect(qx - 14, qy - 14, q + 28, q + 28); ctx.fillStyle = '#fff'; ctx.fillRect(qx - 8, qy - 8, q + 16, q + 16);
  if (IMG.qr) { ctx.imageSmoothingEnabled = true; ctx.drawImage(IMG.qr, qx, qy, q, q); ctx.imageSmoothingEnabled = false; }
  text('SCAN TO DONATE', qx + q / 2, qy + q + 34, 12, '#b02a1c', 'center', null);
  // wallet address
  text('BITCOIN WALLET', cx, y + 466, 24, '#b02a1c', 'center', null);
  ctx.fillStyle = INK; ctx.fillRect(cx - 420, y + 490, 840, 40); ctx.fillStyle = '#fff7dc'; ctx.fillRect(cx - 416, y + 494, 832, 32);
  // plain monospace here: the pixel font makes look-alike characters hard to tell apart
  ctx.font = 'bold 24px Consolas, "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = INK; ctx.fillText(WALLET, cx, y + 511);
  text(G.copied > 0 ? 'ADDRESS COPIED!' : 'PRESS C TO COPY THE ADDRESS', cx, y + 548, 10, G.copied > 0 ? '#3c9a4c' : '#5a3a1a', 'center', null);
  if (Math.floor(t * 2) % 2) text(end ? 'PRESS SPACE OR CLICK TO PLAY AGAIN' : 'PRESS SPACE OR CLICK TO PLAY', cx, y + h - 22, 14, '#b02a1c', 'center', null);
  img(IMG[end ? 'boy_cheer' : 'fairy_big'], x + 40, y + 150 + Math.sin(t * 2.5) * 8, end ? 170 : 190);
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (G.state === 'load') { ctx.fillStyle = '#101436'; ctx.fillRect(0, 0, W, H); text('LOADING...', W / 2, H / 2, 20, '#fff', 'center'); return; }
  if (G.state === 'welcome' || G.state === 'thanks') return drawSupport();
  if (G.state === 'title') return drawTitle();
  if (G.state === 'end') return drawEnd();
  drawWorld();
  if (G.state === 'cine') drawCine();
  drawHUD();
  if (G.state === 'intro') drawIntro();
  if (G.state === 'won' || G.state === 'lost') drawResult();
}

// ---------------------------------------------------------------- input
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space' || e.code === 'Enter') action();
  if (e.code === 'KeyM') muted = !muted;
  if (e.code === 'KeyC' && (G.state === 'welcome' || G.state === 'thanks') && navigator.clipboard) navigator.clipboard.writeText(WALLET).then(() => { G.copied = 2; }, () => {});
  if (e.code === 'KeyR' && L && G.state === 'play') { G.score = G.levelScore; startLevel(L.n); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
cv.addEventListener('pointerdown', e => {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
  if (G.state !== 'play') return action();
  let hit = null, bd = 1e9;
  // a tap on a toy's picture means that toy's square (the picture stands taller than its square)
  for (const t of L.toys) if (t.state === 'floor') {
    const tl = tileAt(t.i, t.j), [tx, ty] = scr(t.i, t.j, tl.h);
    if (Math.abs(x - tx) < 40 && y > ty - 84 && y < ty + 22) { const d = Math.hypot(x - tx, y - (ty - 26)); if (d < bd) { bd = d; hit = tl; } }
  }
  if (!hit) { // ...and the same for the toy box and the lever
    const [cx, cy] = chestTarget();
    if (Math.hypot(x - cx, y - cy) < (L.chest.drawn ? 64 : 120)) hit = tileAt(L.chest.i, L.chest.j);
    else if (L.lever) { const [lx, ly] = scr(L.lever.i, L.lever.j); if (Math.abs(x - lx) < 44 && y > ly - 80 && y < ly + 44) hit = tileAt(L.lever.i, L.lever.j); }
  }
  if (!hit) {
    let top = -1;
    for (const t of L.tiles.values()) { // front-most tile whose top face contains the click
      const [tx, ty] = scr(t.i, t.j, t.h);
      if (Math.abs(x - tx) / HW + Math.abs(y - ty) / HH <= 1 && t.i + t.j > top) { top = t.i + t.j; hit = t; }
    }
  }
  if (!hit) hit = near(x, y);
  if (!(hit === P.dest && P.path && P.path.length)) { // same square while already walking there: keep the current path
    P.dest = hit; P.retry = 0; P.path = pathTo(tileAt(P.i, P.j), hit);
  }
  FX.push({ text: 'x', x, y, vx: 0, vy: 0, life: .35, max: .35, col: CREAM });
});

// ---------------------------------------------------------------- boot
let last = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  update(dt); render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
const fontReady = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('16px "Press Start 2P"'), new Promise(r => setTimeout(r, 2500))]).catch(() => {}) : Promise.resolve();
Promise.all([loadAll(), fontReady]).then(() => { makeSprites(); G.state = 'welcome'; G.t = 0; });
window.__toyfairy = { G, startLevel, finish, get L() { return L; }, get P() { return P; }, get F() { return F; } }; // debug handle
})();
