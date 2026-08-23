/* Screenshots each Saint Mary pose at full opacity, for art review.
   Usage: node tools/poses.mjs <outDir>                            */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = process.argv[2];
const PORT = 9344;
const PROFILE = OUT + '/.chrome';
mkdirSync(OUT, { recursive: true });

const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
  '--window-size=1280,900', 'about:blank'
], { stdio: 'ignore' });

let ws, id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => {
  const msg = { id: ++id, method, params, ...(sessionId ? { sessionId } : {}) };
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
};

let url;
for (let i = 0; i < 60 && !url; i++) {
  try { url = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
  catch { await sleep(250); }
}
ws = new WebSocket(url);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
};

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, s);
await send('Runtime.enable', {}, s);
await send('Page.navigate', { url: 'file:///C:/Users/amirn/Downloads/ascii-website/index.html' }, s);
await sleep(4000);

const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true }, s)
  .then((r) => r.result.value);

/* strip everything but the background, and crank it up */
await ev(`(() => {
  document.documentElement.style.setProperty('--mary-op','1');
  const p = document.querySelector('#mary-pre');
  p.style.webkitMaskImage='none'; p.style.maskImage='none'; p.style.textShadow='none';
  ['#main','.ftr','.hdr','.cmdbar','.crt-scanlines','.crt-vignette','.crt-flicker','#trail','#boot']
    .forEach(sel => document.querySelectorAll(sel).forEach(e => e.remove()));
  return true;
})()`);

for (let i = 0; i < 6; i++) {
  await ev(`window.MaryBG.go(${i})`);
  await sleep(3000);
  const r = await send('Page.captureScreenshot', { format: 'png' }, s);
  writeFileSync(`${OUT}/pose-${i}.png`, Buffer.from(r.data, 'base64'));
  const ink = await ev(`(() => { const t=document.querySelector('#mary-pre').textContent;
    return Math.round(100*t.replace(/[ \\n]/g,'').length/t.replace(/\\n/g,'').length); })()`);
  console.log('pose', i, 'ink', ink + '%');
}

ws.close(); child.kill(); await sleep(400);
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(0);
