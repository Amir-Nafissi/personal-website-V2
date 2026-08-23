/* Turns the public-domain engravings in sources/ into the luminance maps
   that mary.js renders as ASCII.

   Pipeline (run in headless Chrome so we get a real image decoder and a
   good resampler, with no npm dependencies):

     source jpeg
       -> trim the paper margin to the plate content
       -> optional manual crop (captions, plate marks)
       -> two-step downscale to roughly the character grid
       -> auto-levels, gamma, contrast
       -> unsharp, to put the burin lines back after downscaling
       -> invert  (engraving is dark ink on white paper; a phosphor
                   terminal wants ink to be the bright thing)
       -> posterize to 24 levels so the PNG compresses hard
       -> grayscale PNG

   The PNGs are emitted twice: as files under assets/mary/ for reference,
   and inlined as data: URIs into assets/js/mary-frames.js. The inlined
   copy is what ships — a canvas drawn from a file:// <img> is tainted,
   so getImageData() would throw for anyone opening index.html straight
   off disk. data: URIs are same-origin and keep that working.

   Run: node tools/asciify.mjs                                         */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = new URL('../', import.meta.url);
const OUTDIR = new URL('assets/mary/', ROOT);
const PROFILE = 'C:/Users/amirn/AppData/Local/Temp/claude/asciify-profile';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9366;

mkdirSync(OUTDIR, { recursive: true });

/* The six chosen plates. `crop` is [x, y, w, h] in fractions of the
   trimmed plate, used to cut captions and inscription bands. */
/* Isolated figures on blank paper. Plates with a fully worked background
   (skies, architecture) invert into a bright rectangular slab that reads
   as a block behind the text instead of a figure floating in the dark. */
const PLATES = [
  { id: '367006', name: 'theotokos',  crop: [0.02, 0.01, 0.96, 0.97], gamma: 1.05, contrast: 1.30, vignette: 0.40 },
  { id: '402829', name: 'annunciate', crop: [0.03, 0.02, 0.94, 0.95], gamma: 1.05, contrast: 1.30, vignette: 0.40 },
  { id: '367025', name: 'lampbearer', crop: [0.04, 0.02, 0.92, 0.94], gamma: 1.05, contrast: 1.28, vignette: 0.45 },
  { id: '367028', name: 'vigil',      crop: [0.04, 0.02, 0.92, 0.94], gamma: 1.05, contrast: 1.28, vignette: 0.45 },
  { id: '367029', name: 'halffigure', crop: [0.03, 0.02, 0.94, 0.95], gamma: 1.02, contrast: 1.30, vignette: 0.42 },
  { id: '342533', name: 'cloudthrone',crop: [0.04, 0.02, 0.92, 0.93], gamma: 1.15, contrast: 1.26, vignette: 0.60 }
];

const TARGET_H = 224;      // rows of luminance; the char grid is <= 140
const LEVELS = 18;         // posterisation steps

/* ---------- runs inside the page ---------------------------------- */
function pageWorker() {
  window.__process = async function (opts) {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('load failed'));
      i.src = opts.url;
    });

    // 1. working copy, capped so huge scans stay fast
    const cap = 1400;
    const s0 = Math.min(1, cap / Math.max(img.width, img.height));
    let w = Math.round(img.width * s0), h = Math.round(img.height * s0);
    let cv = new OffscreenCanvas(w, h);
    let cx = cv.getContext('2d', { willReadFrequently: true });
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, w, h);

    // 2. trim the paper margin: find the bbox of anything darker than the page
    let d = cx.getImageData(0, 0, w, h).data;
    const lumAt = (x, y) => {
      const i = (y * w + x) * 4;
      return (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    };
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    const step = Math.max(1, Math.floor(Math.min(w, h) / 400));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (lumAt(x, y) < 0.82) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0 || y1 <= y0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
    let cw = x1 - x0 + 1, ch = y1 - y0 + 1;

    // 3. manual crop, in fractions of the trimmed plate
    const c = opts.crop || [0, 0, 1, 1];
    const rx = Math.round(x0 + c[0] * cw), ry = Math.round(y0 + c[1] * ch);
    const rw = Math.round(c[2] * cw), rh = Math.round(c[3] * ch);

    // 4. two-step downscale (halving first) for a clean resample
    const th = opts.targetH;
    const tw = Math.max(8, Math.round((rw / rh) * th));
    let src = cv, sx = rx, sy = ry, sw = rw, sh = rh;
    while (sw > tw * 2 && sh > th * 2) {
      const hw = Math.max(tw, Math.round(sw / 2)), hh = Math.max(th, Math.round(sh / 2));
      const half = new OffscreenCanvas(hw, hh);
      const hc = half.getContext('2d', { willReadFrequently: true });
      hc.imageSmoothingQuality = 'high';
      hc.drawImage(src, sx, sy, sw, sh, 0, 0, hw, hh);
      src = half; sx = 0; sy = 0; sw = hw; sh = hh;
    }
    const out = new OffscreenCanvas(tw, th);
    const oc = out.getContext('2d', { willReadFrequently: true });
    oc.imageSmoothingQuality = 'high';
    oc.drawImage(src, sx, sy, sw, sh, 0, 0, tw, th);

    // 5. to a float luminance buffer
    const px = oc.getImageData(0, 0, tw, th);
    const p = px.data;
    const n = tw * th;
    const L = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      L[i] = (p[i * 4] * 0.299 + p[i * 4 + 1] * 0.587 + p[i * 4 + 2] * 0.114) / 255;
    }

    // auto-levels on percentiles, so a foxed or toned sheet still maps full range
    const sorted = Float32Array.from(L).sort();
    const lo = sorted[Math.floor(n * 0.005)], hi = sorted[Math.floor(n * 0.995)];
    const span = Math.max(0.06, hi - lo);
    for (let i = 0; i < n; i++) L[i] = Math.min(1, Math.max(0, (L[i] - lo) / span));

    // 6. unsharp: downscaling averaged the hatching into flat grey,
    //    this puts the line structure back
    const blur = new Float32Array(n);
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        let sum = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= tw || yy >= th) continue;
            sum += L[yy * tw + xx]; cnt++;
          }
        }
        blur[y * tw + x] = sum / cnt;
      }
    }
    const amount = opts.unsharp == null ? 0.55 : opts.unsharp;
    for (let i = 0; i < n; i++) L[i] = Math.min(1, Math.max(0, L[i] + amount * (L[i] - blur[i])));

    // 7. gamma, contrast, invert, vignette, posterise
    //    The vignette matters more than it sounds: several plates have
    //    densely hatched skies and architecture that invert into a solid
    //    bright slab. Falling off towards the edges isolates the figure,
    //    and the flat black border compresses to almost nothing.
    const g = opts.gamma || 1, k = opts.contrast || 1, steps = opts.levels;
    const vig = opts.vignette == null ? 0.55 : opts.vignette;
    const floor_ = opts.floor == null ? 0.06 : opts.floor;
    for (let i = 0; i < n; i++) {
      let v = Math.pow(L[i], g);
      v = Math.min(1, Math.max(0, (v - 0.5) * k + 0.5));
      v = 1 - v;                                   // ink becomes light

      if (vig > 0) {
        const x = (i % tw) / tw - 0.5, y = Math.floor(i / tw) / th - 0.5;
        const r = Math.sqrt((x * x) / 0.26 + (y * y) / 0.30);
        v *= 1 - vig * Math.max(0, Math.min(1, (r - 0.55) / 0.62));
      }
      if (v < floor_) v = 0;                       // clamp the field to true black
      L[i] = Math.round(v * (steps - 1)) / (steps - 1);
    }

    for (let i = 0; i < n; i++) {
      const v = Math.round(L[i] * 255);
      p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = v;
      p[i * 4 + 3] = 255;
    }
    oc.putImageData(px, 0, 0);

    const blob = await out.convertToBlob({ type: 'image/png' });
    const buf = await blob.arrayBuffer();
    let bin = '';
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return { w: tw, h: th, png: btoa(bin) };
  };
}

/* ---------- CDP plumbing ------------------------------------------ */
const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--mute-audio', '--no-first-run',
  '--allow-file-access-from-files',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, 'about:blank'
], { stdio: 'ignore' });

let url;
for (let i = 0; i < 80 && !url; i++) {
  try { url = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
  catch { await sleep(250); }
}
const ws = new WebSocket(url);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
};
const send = (method, params = {}, sessionId) => {
  const m = { id: ++id, method, params, ...(sessionId ? { sessionId } : {}) };
  ws.send(JSON.stringify(m));
  return new Promise((res, rej) => pending.set(m.id, { res, rej }));
};

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, S);
await send('Runtime.enable', {}, S);
await send('Page.navigate', { url: ROOT.href + 'index.html' }, S);
await sleep(2500);
await send('Runtime.evaluate', { expression: `(${pageWorker.toString()})()` }, S);

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, S);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
};

/* ---------- convert ------------------------------------------------ */
const credits = JSON.parse(readFileSync(new URL('sources/manifest.json', ROOT), 'utf8'));
const frames = [];

for (const plate of PLATES) {
  const meta = credits.find((c) => c.file === plate.id + '.jpg') || {};
  const opts = {
    url: ROOT.href + 'sources/' + plate.id + '.jpg',
    crop: plate.crop,
    targetH: TARGET_H,
    levels: LEVELS,
    gamma: plate.gamma,
    contrast: plate.contrast,
    unsharp: plate.unsharp
  };
  const r = await evaluate(`window.__process(${JSON.stringify(opts)})`);
  writeFileSync(new URL(plate.name + '.png', OUTDIR), Buffer.from(r.png, 'base64'));
  frames.push({
    name: plate.name,
    w: r.w,
    h: r.h,
    png: r.png,
    title: meta.title,
    artist: meta.artist,
    date: meta.date,
    url: meta.url
  });
  console.log(`${plate.name.padEnd(13)} ${r.w}x${r.h}  ${(r.png.length / 1024).toFixed(1)}KB b64  ${meta.artist} — ${meta.title}`);
}

/* inline module */
const js = `/* =============================================================
   mary-frames.js — GENERATED by tools/asciify.mjs. Do not edit.

   Luminance maps for the background, derived from public-domain
   engravings in the Metropolitan Museum of Art Open Access collection
   (CC0). Inlined as data: URIs so the canvas stays untainted when
   index.html is opened directly from disk.
   ============================================================= */
window.MARY_FRAMES = [
${frames.map((f) => `  {
    name: ${JSON.stringify(f.name)},
    w: ${f.w}, h: ${f.h},
    credit: ${JSON.stringify(`${f.artist}, ${f.title} (${f.date})`)},
    src: 'data:image/png;base64,${f.png}'
  }`).join(',\n')}
];
`;
writeFileSync(new URL('assets/js/mary-frames.js', ROOT), js);
writeFileSync(new URL('credits.json', OUTDIR), JSON.stringify(
  frames.map(({ name, title, artist, date, url }) => ({ name, title, artist, date, url })), null, 2));

console.log(`\nwrote assets/js/mary-frames.js  ${(js.length / 1024).toFixed(0)}KB`);

ws.close(); child.kill(); await sleep(400);
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(0);
