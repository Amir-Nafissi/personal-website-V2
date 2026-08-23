/* Generates 8 placeholder artworks for assets/art/.
   These are the ONLY non-ASCII elements on the site — swap them
   for your own images and update assets/js/content.js.
   Run: node tools/gen-art.mjs                                   */
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../assets/art/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const F = (n, d = 2) => Number(n).toFixed(d);

function shell(w, h, body, pal, seed) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
  <linearGradient id="paper" x1="0" y1="0" x2="0.7" y2="1">
    <stop offset="0" stop-color="${pal.bg0}"/><stop offset="1" stop-color="${pal.bg1}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.42" cy="0.32" r="0.75">
    <stop offset="0" stop-color="${pal.glow}" stop-opacity=".85"/>
    <stop offset="1" stop-color="${pal.glow}" stop-opacity="0"/>
  </radialGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${seed}"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope=".16"/></feComponentTransfer>
    <feBlend in2="SourceGraphic" mode="multiply"/>
  </filter>
  <filter id="soft"><feGaussianBlur stdDeviation="${F(Math.min(w, h) / 90)}"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#paper)"/>
<rect width="${w}" height="${h}" fill="url(#glow)"/>
${body}
<rect width="${w}" height="${h}" filter="url(#grain)" opacity=".5" fill="${pal.bg1}"/>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" fill="none" stroke="${pal.ink}" stroke-opacity=".35"/>
</svg>`;
}

const PALETTES = {
  umber:     { bg0: '#241d15', bg1: '#0d0a07', ink: '#e8d3a9', glow: '#c9954a', accent: '#8f6b3a' },
  verdigris: { bg0: '#13201a', bg1: '#070c09', ink: '#cfe6cf', glow: '#4f8f6a', accent: '#2f6248' },
  ash:       { bg0: '#1c1c1e', bg1: '#0a0a0b', ink: '#e6e3dc', glow: '#9aa0a6', accent: '#5a5f66' },
  bole:      { bg0: '#2a1616', bg1: '#0d0606', ink: '#f0d8c6', glow: '#b6553c', accent: '#7c3a2c' }
};

/* Parallel hatch field, lightly jittered like a pen. */
function hatch(w, h, angleDeg, gap, pal, op, r) {
  const a = (angleDeg * Math.PI) / 180;
  const len = w + h;
  let out = `<g stroke="${pal.ink}" stroke-opacity="${op}" stroke-width=".7">`;
  for (let t = -len; t < len; t += gap) {
    const jitter = (r() - 0.5) * gap * 0.4;
    const x = Math.cos(a), y = Math.sin(a);
    const cx = w / 2 + -y * (t + jitter), cy = h / 2 + x * (t + jitter);
    out += `<line x1="${F(cx - x * len)}" y1="${F(cy - y * len)}" x2="${F(cx + x * len)}" y2="${F(cy + y * len)}"/>`;
  }
  return out + '</g>';
}

const PIECES = [
  // 01 ANNUNCIATION — arch, light shaft, two presences
  () => {
    const p = PALETTES.umber, w = 900, h = 640, r = rng(11);
    let g = '<g>';
    g += `<path d="M170 ${h} L170 300 Q450 60 730 300 L730 ${h} Z" fill="none" stroke="${p.ink}" stroke-opacity=".5" stroke-width="2"/>`;
    g += `<path d="M210 ${h} L210 315 Q450 105 690 315 L690 ${h} Z" fill="${p.bg0}" fill-opacity=".55" stroke="${p.ink}" stroke-opacity=".22"/>`;
    g += `<path d="M120 0 L360 0 L640 ${h} L300 ${h} Z" fill="${p.glow}" fill-opacity=".14" filter="url(#soft)"/>`;
    g += `<ellipse cx="330" cy="430" rx="62" ry="150" fill="${p.ink}" fill-opacity=".13"/>`;
    g += `<circle cx="330" cy="272" r="44" fill="none" stroke="${p.glow}" stroke-opacity=".8" stroke-width="2"/>`;
    g += `<ellipse cx="330" cy="290" rx="34" ry="42" fill="${p.ink}" fill-opacity=".3"/>`;
    g += `<ellipse cx="572" cy="440" rx="72" ry="142" fill="${p.ink}" fill-opacity=".18"/>`;
    g += `<circle cx="572" cy="296" r="40" fill="none" stroke="${p.glow}" stroke-opacity=".55"/>`;
    g += `<ellipse cx="572" cy="310" rx="30" ry="38" fill="${p.ink}" fill-opacity=".26"/>`;
    for (let i = 0; i < 26; i++) {
      const x = 120 + r() * 660, y = 60 + r() * 200;
      g += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(0.6 + r() * 1.8)}" fill="${p.glow}" fill-opacity="${F(0.2 + r() * 0.6)}"/>`;
    }
    g += hatch(w, h, 28, 9, p, 0.07, r);
    return shell(w, h, g + '</g>', p, 3);
  },

  // 02 STUDY I — silverpoint head, tall
  () => {
    const p = PALETTES.ash, w = 520, h = 720, r = rng(29);
    let g = '<g>';
    g += `<ellipse cx="260" cy="330" rx="132" ry="176" fill="${p.ink}" fill-opacity=".09"/>`;
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2, rad = Math.pow(r(), 0.6);
      const x = 260 + Math.cos(a) * rad * 130, y = 330 + Math.sin(a) * rad * 172;
      const len = 8 + r() * 26;
      g += `<line x1="${F(x)}" y1="${F(y)}" x2="${F(x + len * 0.7)}" y2="${F(y + len)}" stroke="${p.ink}" stroke-opacity="${F(0.05 + r() * 0.22)}" stroke-width=".8"/>`;
    }
    g += `<path d="M175 300 q28 -34 60 -6" fill="none" stroke="${p.ink}" stroke-opacity=".5"/>`;
    g += `<path d="M285 294 q28 -34 60 -6" fill="none" stroke="${p.ink}" stroke-opacity=".5"/>`;
    g += `<path d="M258 330 q-10 44 12 56" fill="none" stroke="${p.ink}" stroke-opacity=".45"/>`;
    g += `<path d="M222 430 q40 16 78 -6" fill="none" stroke="${p.ink}" stroke-opacity=".4"/>`;
    g += `<path d="M200 520 q60 60 130 0 l40 200 h-210 z" fill="${p.ink}" fill-opacity=".07" stroke="${p.ink}" stroke-opacity=".25"/>`;
    g += hatch(w, h, 62, 11, p, 0.05, r);
    return shell(w, h, g + '</g>', p, 7);
  },

  // 03 ORCHARD — flow field
  () => {
    const p = PALETTES.verdigris, w = 620, h = 620, r = rng(53);
    let g = `<g stroke="${p.ink}" fill="none">`;
    for (let i = 0; i < 240; i++) {
      let x = r() * w, y = r() * h;
      let d = `M${F(x)} ${F(y)}`;
      for (let s = 0; s < 26; s++) {
        const a = Math.sin(x * 0.011) * 1.7 + Math.cos(y * 0.009) * 1.4 + Math.sin((x + y) * 0.004) * 2;
        x += Math.cos(a) * 6; y += Math.sin(a) * 6;
        d += ` L${F(x)} ${F(y)}`;
      }
      g += `<path d="${d}" stroke-opacity="${F(0.06 + r() * 0.3)}" stroke-width="${F(0.5 + r() * 0.9)}"/>`;
    }
    g += '</g>';
    g += `<circle cx="430" cy="190" r="72" fill="${p.glow}" fill-opacity=".16"/>`;
    g += `<circle cx="430" cy="190" r="72" fill="none" stroke="${p.ink}" stroke-opacity=".4"/>`;
    return shell(w, h, g, p, 13);
  },

  // 04 REREDOS — gothic tracery panels, wide
  () => {
    const p = PALETTES.umber, w = 980, h = 560, r = rng(71);
    let g = '<g>';
    for (let i = 0; i < 5; i++) {
      const x = 70 + i * 172, bw = 132;
      g += `<path d="M${x} ${h - 50} L${x} 250 Q${x + bw / 2} 90 ${x + bw} 250 L${x + bw} ${h - 50} Z" fill="${p.bg0}" fill-opacity=".6" stroke="${p.ink}" stroke-opacity=".45"/>`;
      g += `<circle cx="${x + bw / 2}" cy="215" r="30" fill="none" stroke="${p.ink}" stroke-opacity=".4"/>`;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        g += `<circle cx="${F(x + bw / 2 + Math.cos(a) * 30)}" cy="${F(215 + Math.sin(a) * 30)}" r="11" fill="none" stroke="${p.ink}" stroke-opacity=".3"/>`;
      }
      g += `<ellipse cx="${x + bw / 2}" cy="${h - 150}" rx="30" ry="76" fill="${p.glow}" fill-opacity="${F(0.08 + r() * 0.12)}"/>`;
      g += `<line x1="${x}" y1="${h - 50}" x2="${x + bw}" y2="${h - 50}" stroke="${p.ink}" stroke-opacity=".5"/>`;
    }
    g += `<rect x="40" y="${h - 44}" width="${w - 80}" height="10" fill="${p.accent}" fill-opacity=".5"/>`;
    g += hatch(w, h, 105, 8, p, 0.06, r);
    return shell(w, h, g + '</g>', p, 19);
  },

  // 05 MADONNA — charcoal, soft
  () => {
    const p = PALETTES.bole, w = 560, h = 700, r = rng(97);
    let g = '<g>';
    g += `<circle cx="280" cy="250" r="130" fill="${p.glow}" fill-opacity=".22" filter="url(#soft)"/>`;
    g += `<circle cx="280" cy="250" r="112" fill="none" stroke="${p.ink}" stroke-opacity=".55" stroke-width="1.5"/>`;
    g += `<path d="M120 ${h} q10 -300 160 -330 q150 30 160 330 z" fill="${p.ink}" fill-opacity=".12" stroke="${p.ink}" stroke-opacity=".3"/>`;
    g += `<ellipse cx="280" cy="262" rx="62" ry="80" fill="${p.ink}" fill-opacity=".2"/>`;
    g += `<ellipse cx="352" cy="470" rx="52" ry="66" fill="${p.ink}" fill-opacity=".16" transform="rotate(-24 352 470)"/>`;
    g += `<circle cx="356" cy="424" r="34" fill="none" stroke="${p.glow}" stroke-opacity=".6"/>`;
    for (let i = 0; i < 90; i++) {
      const x = 110 + r() * 340, y = 340 + r() * 340;
      g += `<line x1="${F(x)}" y1="${F(y)}" x2="${F(x + 16 + r() * 22)}" y2="${F(y + 26 + r() * 26)}" stroke="${p.ink}" stroke-opacity="${F(0.04 + r() * 0.14)}"/>`;
    }
    return shell(w, h, g + '</g>', p, 23);
  },

  // 06 TRACERY — rosette
  () => {
    const p = PALETTES.verdigris, w = 640, h = 640, r = rng(131);
    const cx = 320, cy = 320;
    let g = `<g fill="none" stroke="${p.ink}">`;
    for (let ring = 1; ring <= 5; ring++) {
      const rad = ring * 52;
      const n = ring * 8;
      g += `<circle cx="${cx}" cy="${cy}" r="${rad}" stroke-opacity=".28"/>`;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + ring * 0.2;
        const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
        g += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(rad / (n / 3.4))}" stroke-opacity="${F(0.18 + r() * 0.3)}"/>`;
      }
    }
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      g += `<line x1="${F(cx + Math.cos(a) * 40)}" y1="${F(cy + Math.sin(a) * 40)}" x2="${F(cx + Math.cos(a) * 300)}" y2="${F(cy + Math.sin(a) * 300)}" stroke-opacity=".14"/>`;
    }
    g += '</g>';
    g += `<circle cx="${cx}" cy="${cy}" r="34" fill="${p.glow}" fill-opacity=".5"/>`;
    return shell(w, h, g, p, 29);
  },

  // 07 VESPERS — horizon
  () => {
    const p = PALETTES.umber, w = 720, h = 480, r = rng(163);
    let g = '<g>';
    g += `<circle cx="470" cy="196" r="86" fill="${p.glow}" fill-opacity=".55"/>`;
    g += `<circle cx="470" cy="196" r="86" fill="none" stroke="${p.ink}" stroke-opacity=".4"/>`;
    for (let i = 0; i < 46; i++) {
      const y = 250 + i * 5.2;
      const op = 0.05 + (i / 46) * 0.35;
      g += `<line x1="0" y1="${F(y)}" x2="${w}" y2="${F(y + (r() - 0.5) * 3)}" stroke="${p.ink}" stroke-opacity="${F(op)}" stroke-width="${F(0.6 + r())}"/>`;
    }
    g += `<path d="M0 250 L${w} 250" stroke="${p.ink}" stroke-opacity=".6"/>`;
    for (let i = 0; i < 6; i++) {
      const x = 40 + r() * 640;
      g += `<path d="M${F(x)} 250 l-4 -${F(30 + r() * 70)} l8 0 z" fill="${p.ink}" fill-opacity=".3"/>`;
    }
    return shell(w, h, g + '</g>', p, 37);
  },

  // 08 CODEX — glyph grid
  () => {
    const p = PALETTES.ash, w = 600, h = 780, r = rng(197);
    let g = `<g stroke="${p.ink}" fill="none" stroke-width="1.2">`;
    const cols = 9, rows = 13, m = 64;
    const cw = (w - m * 2) / cols, chh = (h - m * 2) / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ox = m + x * cw + cw * 0.2, oy = m + y * chh + chh * 0.2;
        const sw = cw * 0.6, sh = chh * 0.6;
        const t = (r() * 5) | 0;
        const op = F(0.12 + r() * 0.55);
        if (t === 0) g += `<path d="M${F(ox)} ${F(oy + sh)} L${F(ox + sw / 2)} ${F(oy)} L${F(ox + sw)} ${F(oy + sh)}" stroke-opacity="${op}"/>`;
        else if (t === 1) g += `<circle cx="${F(ox + sw / 2)}" cy="${F(oy + sh / 2)}" r="${F(sw / 2.4)}" stroke-opacity="${op}"/>`;
        else if (t === 2) g += `<path d="M${F(ox)} ${F(oy)} h${F(sw)} v${F(sh)}" stroke-opacity="${op}"/>`;
        else if (t === 3) g += `<path d="M${F(ox)} ${F(oy + sh / 2)} q${F(sw / 2)} ${F(-sh)} ${F(sw)} 0" stroke-opacity="${op}"/>`;
        else g += `<path d="M${F(ox)} ${F(oy)} l${F(sw)} ${F(sh)} M${F(ox + sw)} ${F(oy)} l${F(-sw)} ${F(sh)}" stroke-opacity="${op}"/>`;
      }
    }
    g += '</g>';
    g += `<rect x="${m - 18}" y="${m - 18}" width="${w - (m - 18) * 2}" height="${h - (m - 18) * 2}" fill="none" stroke="${p.glow}" stroke-opacity=".45"/>`;
    return shell(w, h, g, p, 43);
  }
];

PIECES.forEach((fn, i) => {
  const name = String(i + 1).padStart(2, '0') + '.svg';
  writeFileSync(new URL(name, OUT), fn());
  console.log('wrote assets/art/' + name);
});
