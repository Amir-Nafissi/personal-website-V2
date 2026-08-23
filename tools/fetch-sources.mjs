/* Finds and downloads public-domain Renaissance engravings of Marian
   subjects from the Met Museum Open Access collection (all CC0).

   Writes  sources/<id>.jpg  plus  sources/manifest.json  with credits.
   Run:  node tools/fetch-sources.mjs                                  */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const API = 'https://collectionapi.metmuseum.org/public/collection/v1';
const DIR = new URL('../sources/', import.meta.url);
mkdirSync(DIR, { recursive: true });

const QUERIES = [
  'Durer Life of the Virgin',
  'Schongauer Virgin',
  'Annunciation engraving',
  'Virgin and Child engraving',
  'Assumption of the Virgin engraving',
  'Pieta engraving',
  'Immaculate Conception engraving',
  'Madonna engraving',
  'Virgin sorrows engraving',
  'Coronation of the Virgin engraving'
];

/* The Met throttles hard; back off and retry rather than hammering. */
async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'ascii-scriptorium/1.0' } });
      if (r.status === 403 || r.status === 429 || r.status >= 500) throw new Error('http ' + r.status);
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('json')) throw new Error('non-json ' + ct);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(900 * (i + 1));
    }
  }
}

const CACHE = new URL('./.met-cache.json', DIR);
let cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

async function object(id) {
  if (cache[id]) return cache[id];
  const o = await get(`${API}/objects/${id}`);
  cache[id] = {
    id,
    title: o.title,
    artist: o.artistDisplayName || 'Anonymous',
    date: o.objectDate,
    medium: o.medium,
    classification: o.classification,
    pd: o.isPublicDomain,
    img: o.primaryImage,
    small: o.primaryImageSmall,
    credit: o.creditLine,
    url: o.objectURL
  };
  writeFileSync(CACHE, JSON.stringify(cache));
  await sleep(180);
  return cache[id];
}

const ids = new Set();
for (const q of QUERIES) {
  const s = await get(`${API}/search?hasImages=true&q=${encodeURIComponent(q)}`);
  (s.objectIDs || []).slice(0, 18).forEach((i) => ids.add(i));
  await sleep(300);
  console.log(`search "${q}" -> ${s.total}`);
}
console.log('candidates:', ids.size);

const picks = [];
for (const id of ids) {
  let o;
  try { o = await object(id); } catch { continue; }
  if (!o.pd || !o.img) continue;
  if (!/engrav|woodcut|etch/i.test(`${o.classification} ${o.medium}`)) continue;
  picks.push(o);
}

console.log('\npublic-domain prints found:', picks.length);
picks.forEach((o) => console.log(`  ${o.id}  ${o.artist} — ${o.title} (${o.date})`));

/* download */
const manifest = [];
for (const o of picks) {
  const file = new URL(`${o.id}.jpg`, DIR);
  if (!existsSync(file)) {
    try {
      const r = await fetch(o.img, { headers: { 'User-Agent': 'ascii-scriptorium/1.0' } });
      if (!r.ok) { console.log('skip', o.id, r.status); continue; }
      writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      await sleep(250);
    } catch (e) { console.log('skip', o.id, e.message); continue; }
  }
  manifest.push({ file: `${o.id}.jpg`, title: o.title, artist: o.artist, date: o.date, credit: o.credit, url: o.url });
  console.log('have', o.id);
}
writeFileSync(new URL('manifest.json', DIR), JSON.stringify(manifest, null, 2));
console.log('\nwrote sources/manifest.json —', manifest.length, 'images');
