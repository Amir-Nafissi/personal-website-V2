/* Tiny CDP driver: real-time screenshots + JS probes.
   Usage: node tools/shot.mjs <outDir> [waitMs]                  */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = process.argv[2];
const PORT = 9333;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL_ = 'file:///C:/Users/amirn/Downloads/ascii-website/index.html';
const PROFILE = OUT + '/.chrome';

mkdirSync(OUT, { recursive: true });

const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
  '--window-size=1440,950', 'about:blank'
], { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map();
const logs = [];

function send(method, params = {}, sessionId) {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
}

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      return j.webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('chrome did not start');
}

let session;
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true
  }, session);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' }, session);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'));
  return `${OUT}/${name}.png`;
}

const wsUrl = await connect();
ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  } else if (m.method === 'Runtime.consoleAPICalled') {
    logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  } else if (m.method === 'Runtime.exceptionThrown') {
    logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  }
};

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
({ sessionId: session } = await send('Target.attachToTarget', { targetId, flatten: true }));
await send('Page.enable', {}, session);
await send('Runtime.enable', {}, session);
await send('Page.navigate', { url: URL_ }, session);
await sleep(Number(process.argv[3] || 9000));

/* ---- probes ------------------------------------------------- */
const sleepJs = (ms) => `new Promise(r=>setTimeout(r,${ms}))`;

const probe = await evaluate(`(() => {
  const q = (s) => document.querySelector(s);
  const eyeRows = (q('.eye-line')||{textContent:''}).textContent.split(String.fromCharCode(10));
  return {
    bootGone:  !q('#boot'),
    stage:     document.documentElement.dataset.stage,
    theme:     document.documentElement.dataset.theme,
    eyeCols:   eyeRows[0] ? eyeRows[0].length : 0,
    eyeRows:   eyeRows.length,
    eyeInk:    (q('.eye-line').textContent + q('.eye-iris').textContent +
                q('.eye-pupil').textContent).replace(/[^!-~]/g, '').length,
    wallCells: window.Wall.cells(),
    chips:     document.querySelectorAll('.chip').length,
    motd:      (q('#term-out')||{textContent:''}).textContent.trim().slice(0, 40),
    barTitle:  (q('#bar-title')||{}).textContent
  };
})()`);
console.log('PROBE', JSON.stringify(probe, null, 2));

await shot('01-shell');

/* the eyes alone, and gaze tracking */
await evaluate(`(async () => {
  document.documentElement.dataset.stage = 'eyes';
  await ${sleepJs(1200)};
})()`);
await shot('02-eyes');

const gaze = await evaluate(`(async () => {
  const at = (x, y) => window.dispatchEvent(
    new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
  const grab = () => document.querySelector('.eye-pupil').textContent;
  at(60, 60);            await ${sleepJs(900)};  const a = grab();
  at(innerWidth - 60, innerHeight - 60); await ${sleepJs(900)}; const b = grab();
  document.documentElement.dataset.stage = 'shell';
  return { tracks: a !== b };
})()`);
console.log('GAZE', JSON.stringify(gaze));

/* The two eyes are mirrors, so their per-material cell counts must
   match closely. They diverge when something in drawEye ignores the
   `s` mirror — the clip offsets did, and the iris colour flooded one
   eye's lash line.

   Measure with the gaze CENTRED. Off-centre, the mirrored lids
   legitimately crop different amounts of iris and the skew is real. */
await evaluate(`window.Eyes.setGaze(0, 0)`);
await sleep(1000);
const sym = await evaluate(`(() => {
  const g = (q) => document.querySelector(q).textContent.split(String.fromCharCode(10));
  const L = g('.eye-line'), I = g('.eye-iris'), P = g('.eye-pupil');
  const W = L[0].length, half = Math.floor(W / 2);
  const n = (A, lo, hi) => {
    let k = 0;
    for (let r = 0; r < A.length; r++)
      for (let c = lo; c < hi; c++) if (A[r][c] && A[r][c] !== ' ') k++;
    return k;
  };
  const cmp = (A) => {
    const a = n(A, 0, half), b = n(A, half, W);
    return { l: a, r: b, skew: +(Math.abs(a - b) / Math.max(1, a, b)).toFixed(3) };
  };
  return { line: cmp(L), iris: cmp(I), pupil: cmp(P) };
})()`);
const worst = Math.max(sym.line.skew, sym.iris.skew, sym.pupil.skew);
console.log('EYE SYMMETRY', JSON.stringify(sym), worst > 0.12 ? 'FAIL' : 'ok');

/* mid-blink: the lids must meet without the upper curve crossing
   under the lower one */
const blink = await evaluate(`(async () => {
  const n = (q) => document.querySelector(q).textContent.replace(/[^!-~]/g, '').length;
  window.Eyes.blink();
  await new Promise((r) => setTimeout(r, 120));
  const shut = { line: n('.eye-line'), iris: n('.eye-iris'), pupil: n('.eye-pupil') };
  await new Promise((r) => setTimeout(r, 420));
  const back = { line: n('.eye-line'), iris: n('.eye-iris'), pupil: n('.eye-pupil') };
  return { shut, back };
})()`);
/* A shut eye must show NO wet material. Any iris or pupil left here
   means the opening's clip inverted as the lids crossed, and the
   iris colour is painting over the lashes. */
console.log('BLINK', JSON.stringify(blink),
  (blink.shut.iris || blink.shut.pupil) ? 'FAIL: wet material while shut'
  : (blink.back.iris > 0 ? 'ok' : 'FAIL: did not reopen'));
await evaluate(`window.Eyes.blink()`);
await sleep(120);
await shot('03-blink');
await sleep(900);

/* every section, through the shell */
for (const cmd of ['education', 'work', 'projects', 'creations']) {
  await evaluate(`window.Shell.run(${JSON.stringify(cmd)})`);
  await sleep(2600);
  const st = await evaluate(`({
    stage: document.documentElement.dataset.stage,
    deck: window.Deck.current(),
    cards: document.querySelectorAll('.card').length,
    shown: document.querySelectorAll('.card.in').length
  })`);
  console.log('SECTION', cmd, JSON.stringify(st));
  await shot('sec-' + cmd);
}

/* horizontal rail actually moves */
const rail = await evaluate(`(async () => {
  const r = document.querySelector('#rail');
  const before = r.scrollLeft;
  r.dispatchEvent(new WheelEvent('wheel', { deltaY: 600, bubbles: true, cancelable: true }));
  await ${sleepJs(900)};
  return { before, after: r.scrollLeft, max: r.scrollWidth - r.clientWidth };
})()`);
console.log('RAIL', JSON.stringify(rail));
await shot('rail-scrolled');

/* lightbox over a creation */
await evaluate(`document.querySelectorAll('.card-figure')[0].click()`);
await sleep(1100);
await shot('lightbox');
console.log('LIGHTBOX', await evaluate(`(() => {
  const l = document.querySelector('#lb');
  const i = document.querySelector('#lb-img');
  return { open: !l.hidden, count: document.querySelector('#lb-count').textContent,
           imgOk: i.complete && i.naturalWidth > 0 };
})()`));
await evaluate(`document.querySelector('#lb-close').click()`);

/* clear resets the terminal AND the deck */
await evaluate(`window.Shell.run('clear')`);
await sleep(1800);
console.log('CLEAR', await evaluate(`({
  stage: document.documentElement.dataset.stage,
  deck: window.Deck.current(),
  out: document.querySelector('#term-out').textContent.trim().length
})`));
await shot('cleared');

/* neofetch + the other themes */
await evaluate(`window.Shell.run('neofetch')`);
await sleep(2200);
await shot('neofetch');

for (const t of ['gruvbox', 'tokyo']) {
  await evaluate(`window.Shell.run('theme ${t}')`);
  await sleep(1400);
  await shot('theme-' + t);
}
await evaluate(`window.Shell.run('theme mocha')`);
await sleep(1000);

/* mobile */
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true
}, session);
await evaluate(`window.dispatchEvent(new Event('resize'))`);
await sleep(1600);
await shot('mobile-shell');
await evaluate(`window.Shell.run('work')`);
await sleep(2600);
await shot('mobile-work');

console.log('CONSOLE:', logs.length ? logs.join('\n') : '(clean)');

ws.close();
child.kill();
await sleep(400);
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(0);
