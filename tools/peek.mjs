/* Generic real-time CDP screenshotter.
     node tools/peek.mjs <file-or-url> <outPng> [waitMs] [w] [h] [--js="expr"]...
   Real time, not virtual time: IntersectionObserver and rAF actually run.
   Prints any console output; "(clean)" means none.                      */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9341;

const [target, out, waitMs = '3000', W = '1440', H = '950'] = process.argv.slice(2);
const evals = process.argv.slice(2).filter((a) => a.startsWith('--js=')).map((a) => a.slice(5));
if (!target || !out) {
  console.error('usage: node tools/peek.mjs <file|url> <out.png> [waitMs] [w] [h] [--js=expr]');
  process.exit(1);
}
const url = /^https?:|^file:/.test(target)
  ? target
  : 'file:///' + resolve(target).replace(/\\/g, '/');

mkdirSync(dirname(resolve(out)), { recursive: true });
const PROFILE = resolve(out) + '.chrome';

const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
  '--window-size=' + W + ',' + H, 'about:blank'
], { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map();
const logs = [];
const send = (method, params = {}, sessionId) => {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
};

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('chrome did not start');
}

let session;
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result.value;
}

ws = new WebSocket(await connect());
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
await send('Page.navigate', { url }, session);
await sleep(Number(waitMs) || 3000);

for (const expr of evals) {
  try { console.log('JS>', JSON.stringify(await evaluate(expr))); }
  catch (e) { console.log('JS! ', e.message); }
}

const shot = await send('Page.captureScreenshot', { format: 'png' }, session);
writeFileSync(resolve(out), Buffer.from(shot.data, 'base64'));
console.log('shot ->', resolve(out));
console.log('CONSOLE:', logs.length ? logs.join('\n') : '(clean)');

ws.close();
child.kill();
await sleep(400);
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(0);
