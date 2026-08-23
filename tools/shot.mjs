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
await sleep(Number(process.argv[3] || 5000));

/* ---- probes ------------------------------------------------- */
const probe = await evaluate(`(() => {
  const q = (s) => document.querySelector(s);
  return {
    bootGone: !q('#boot'),
    heroRole: (q('.hero-role')||{}).textContent,
    heroTag: (q('.hero-tag span[data-tw]')||{}).textContent,
    eduSub: (q('#education .sec-sub')||{}).textContent,
    maryLines: (q('#mary-pre').textContent.match(/\\n/g)||[]).length + 1,
    maryChars: q('#mary-pre').textContent.length,
    maryInk: (q('#mary-pre').textContent.replace(/[ \\n]/g,'')).length,
    eduBoxes: document.querySelectorAll('.edu-win').length,
    eduFirstLine: (q('.edu-win')||{textContent:''}).textContent.split('\\n')[0],
    projects: document.querySelectorAll('.proj-card').length,
    projTitleRows: (q('.proj-title')||{textContent:''}).textContent.split('\\n').length,
    galItems: document.querySelectorAll('.gal-item').length,
    imgsLoaded: [...document.images].filter(i=>i.complete && i.naturalWidth>0).length,
    imgsTotal: document.images.length,
    skillFirst: (q('.skill-row')||{textContent:''}).textContent,
    specsLines: (q('#specs').textContent.split('\\n').length),
    docHeight: document.documentElement.scrollHeight
  };
})()`);
console.log('PROBE', JSON.stringify(probe, null, 2));

await shot('01-hero');

/* scroll through sections */
for (const id of ['education', 'experience', 'projects', 'context', 'gallery']) {
  await evaluate(`document.getElementById('${id}').scrollIntoView()`);
  await sleep(2600);
  await shot('sec-' + id);
}

/* lightbox */
await evaluate(`document.querySelectorAll('.gal-item')[0].click()`);
await sleep(1200);
await shot('lightbox');
const lb = await evaluate(`(() => {
  const l = document.querySelector('#lb');
  return { open: !l.hidden, count: document.querySelector('#lb-count').textContent,
           titleRows: document.querySelector('#lb-title').textContent.split('\\n').length,
           imgOk: (()=>{const i=document.querySelector('#lb-img'); return i.complete && i.naturalWidth>0;})() };
})()`);
console.log('LIGHTBOX', JSON.stringify(lb));
await evaluate(`document.querySelector('#lb-close').click()`);

/* konami */
await evaluate(`(() => {
  const seq=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  seq.forEach(k => document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true})));
  return true;
})()`);
await sleep(1400);
await shot('konami');
const kn = await evaluate(`!document.querySelector('#konami').hidden`);
console.log('KONAMI open:', kn);
await evaluate(`document.querySelector('#konami').click()`);

/* command bar */
await evaluate(`(() => {
  const i = document.querySelector('#cmd-input');
  i.value = 'goto projects';
  i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  return true;
})()`);
await sleep(900);
console.log('CMD OUT:', await evaluate(`document.querySelector('#cmd-out').textContent`));

/* amber theme + background pose advance */
await evaluate(`document.querySelector('#btn-theme').click(); window.MaryBG.next();`);
await evaluate(`document.getElementById('home').scrollIntoView()`);
await sleep(3000);
await shot('amber');

/* mobile */
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true
}, session);
await evaluate(`document.querySelector('#btn-theme').click(); window.dispatchEvent(new Event('resize'))`);
await sleep(2500);
await evaluate(`document.getElementById('education').scrollIntoView()`);
await sleep(1500);
await shot('mobile-edu');
await evaluate(`document.getElementById('home').scrollIntoView()`);
await sleep(1200);
await shot('mobile-hero');

console.log('CONSOLE:', logs.length ? logs.join('\n') : '(clean)');

ws.close();
child.kill();
await sleep(400);
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(0);
