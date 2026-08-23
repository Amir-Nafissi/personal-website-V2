/* =============================================================
   mary.js — rotating ASCII "Saint Mary" background slideshow.

   How it works
   ------------
   1. Six poses are drawn procedurally as grayscale vector scenes
      into a tiny offscreen canvas whose pixel grid == character
      grid (one pixel per character cell).
   2. Each scene is sampled: luminance picks a glyph from a ramp,
      and a Sobel pass overrides mid-tones with directional
      hatch glyphs ( | / - \ ) so shading reads as cross-hatching.
   3. Poses are cached as char grids. Transitions are a per-cell
      noise dissolve with a bright "burn" edge — cheap enough to
      run at 24fps on one string write per frame.
   ============================================================= */
(function (global) {
  'use strict';

  var RAMP = ' .`,:;-~=+ox*O#%@';
  var HATCH = ['-', '\\', '|', '/'];
  var BURN = ['*', '+', '.', '·'];

  var el, pre, cvs, ctx;
  var cols = 0, rows = 0;
  var cellW = 8, cellH = 16;
  var poses = [];          // cached char arrays
  var noise = null;        // per-cell dissolve threshold
  var current = 0, nextIdx = 1;
  var transT = 1;          // 1 = settled
  var lastFrame = 0, lastSwap = 0;
  var running = true, reduced = false;
  var HOLD = 9000;         // ms per pose
  var FADE = 2200;         // ms crossfade
  var FPS = 24;
  var rafId = 0;

  /* ---------------------------------------------------------- */
  /* Drawing primitives. Scene space: x in [-0.5,0.5], y in [0,1]
     A character cell is a coarse pixel, so tonal masses turn to
     mud. Everything is therefore drawn as an icon painter would:
     dark bodies, bright continuous contours, a few decisive folds.
     ---------------------------------------------------------- */

  function grad(c, x0, y0, r0, x1, y1, r1, stops) {
    var gr = c.createRadialGradient(x0, y0, r0, x1, y1, r1);
    for (var i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
    return gr;
  }
  function lum(v) {
    v = Math.max(0, Math.min(1, v));
    var n = Math.round(v * 255);
    return 'rgb(' + n + ',' + n + ',' + n + ')';
  }

  /* Fill the current path with a dark, upper-left-lit body tone. */
  function body(c, cx, cy, r, hi, lo) {
    hi = hi == null ? 0.11 : hi;
    lo = lo == null ? 0.006 : lo;
    c.fillStyle = grad(c, cx - r * 0.4, cy - r * 0.5, r * 0.04, cx, cy, r * 1.2,
      [[0, lum(hi)], [0.5, lum((hi + lo) * 0.5)], [1, lum(lo)]]);
    c.fill();
  }

  /* Stroke the current path as a contour. Widths are in scene units;
     0.012 is roughly one character cell tall. */
  function ink(c, w, a) {
    c.save();
    c.globalAlpha = a == null ? 1 : a;
    c.strokeStyle = '#fff';
    c.lineWidth = w == null ? 0.014 : w;
    c.stroke();
    c.restore();
  }

  function curve(c, pts, w, a) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i + 2 < pts.length; i += 3) {
      c.bezierCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i + 2][0], pts[i + 2][1]);
    }
    ink(c, w, a);
  }

  /* -------- the draped figure ------------------------------- */

  /* One continuous silhouette: veil crown → shoulders → hem. */
  function drapePath(c, cx, hy, hr, botY, halfW, lean) {
    lean = lean || 0;
    var sh = hy + hr * 2.4;                 // shoulder line
    c.beginPath();
    c.moveTo(cx - halfW, botY);
    c.bezierCurveTo(cx - halfW * 0.96, sh + (botY - sh) * 0.35,
                    cx - hr * 2.35, sh - hr * 0.35,
                    cx - hr * 1.52 + lean, hy + hr * 0.35);
    c.bezierCurveTo(cx - hr * 1.62 + lean, hy - hr * 1.85,
                    cx + hr * 1.62 + lean, hy - hr * 1.85,
                    cx + hr * 1.52 + lean, hy + hr * 0.35);
    c.bezierCurveTo(cx + hr * 2.35, sh - hr * 0.35,
                    cx + halfW * 0.96, sh + (botY - sh) * 0.35,
                    cx + halfW, botY);
    c.closePath();
  }

  /* Veil opening — the arc that frames the face. */
  function veilEdge(c, cx, hy, hr, lean) {
    lean = lean || 0;
    c.beginPath();
    c.moveTo(cx - hr * 1.2 + lean, hy + hr * 1.15);
    c.bezierCurveTo(cx - hr * 1.34 + lean, hy - hr * 1.2,
                    cx + hr * 1.34 + lean, hy - hr * 1.2,
                    cx + hr * 1.2 + lean, hy + hr * 1.15);
    ink(c, 0.011, 0.95);
  }

  function face(c, cx, hy, hr, lean) {
    lean = lean || 0;
    var x = cx + lean;
    c.beginPath();
    c.ellipse(x, hy, hr * 0.74, hr * 0.98, 0, 0, Math.PI * 2);
    c.fillStyle = grad(c, x - hr * 0.3, hy - hr * 0.4, hr * 0.05, x, hy, hr * 1.15,
      [[0, lum(0.92)], [0.6, lum(0.5)], [1, lum(0.16)]]);
    c.fill();
    ink(c, 0.009, 0.7);
    // downcast eyes and nose, drawn as three small marks
    c.save();
    c.globalAlpha = 0.9;
    c.strokeStyle = lum(0.05);
    c.lineWidth = 0.009;
    c.beginPath();
    c.moveTo(x - hr * 0.46, hy - hr * 0.12); c.quadraticCurveTo(x - hr * 0.28, hy - hr * 0.28, x - hr * 0.1, hy - hr * 0.1);
    c.moveTo(x + hr * 0.1, hy - hr * 0.1); c.quadraticCurveTo(x + hr * 0.28, hy - hr * 0.28, x + hr * 0.46, hy - hr * 0.12);
    c.moveTo(x, hy - hr * 0.06); c.lineTo(x + hr * 0.05, hy + hr * 0.3);
    c.stroke();
    c.restore();
  }

  /* Folds: a few decisive lines from the shoulder to the hem. */
  function folds(c, cx, hy, hr, botY, halfW, n, seed) {
    var sh = hy + hr * 2.6;
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n - 0.5;
      var x0 = cx + t * halfW * 0.5;
      var x1 = cx + t * halfW * 1.72;
      var y0 = sh + (botY - sh) * 0.18;
      c.beginPath();
      c.moveTo(x0, y0);
      c.bezierCurveTo(x0 + (x1 - x0) * 0.35, y0 + (botY - y0) * 0.45,
                      x1, y0 + (botY - y0) * 0.75, x1, botY);
      ink(c, 0.010, 0.20 + 0.28 * Math.abs(Math.sin(i * 2.1 + (seed || 0))));
    }
    // hem
    c.beginPath();
    c.moveTo(cx - halfW, botY);
    c.quadraticCurveTo(cx, botY - (botY - sh) * 0.09, cx + halfW, botY);
    ink(c, 0.012, 0.6);
  }

  /** A complete veiled figure. Returns nothing; draws in place. */
  function figure(c, o) {
    var cx = o.x, hy = o.headY, hr = o.headR, botY = o.bot, halfW = o.w, lean = o.lean || 0;
    drapePath(c, cx, hy, hr, botY, halfW, lean);
    body(c, cx, hy + hr * 3, Math.max(halfW, botY - hy), o.hi, o.lo);
    drapePath(c, cx, hy, hr, botY, halfW, lean);
    ink(c, 0.016, 0.95);
    folds(c, cx, hy, hr, botY, halfW, o.folds == null ? 4 : o.folds, o.seed);
    veilEdge(c, cx, hy, hr, lean);
    face(c, cx, hy, hr, lean);
    // shoulder line
    c.beginPath();
    c.moveTo(cx - hr * 2.1, hy + hr * 2.5);
    c.quadraticCurveTo(cx, hy + hr * 1.95, cx + hr * 2.1, hy + hr * 2.5);
    ink(c, 0.010, 0.45);
  }

  /* -------- attributes -------------------------------------- */

  function halo(c, x, y, r, bright) {
    bright = bright == null ? 0.95 : bright;
    c.save();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    ink(c, 0.014, bright);
    c.beginPath();
    c.arc(x, y, r * 0.9, 0, Math.PI * 2);
    ink(c, 0.008, bright * 0.45);
    c.restore();
  }

  function rays(c, x, y, n, r0, r1, alpha) {
    c.save();
    c.globalAlpha = alpha == null ? 0.55 : alpha;
    c.strokeStyle = '#fff';
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + 0.13;
      var len = r1 * (i % 4 === 0 ? 1 : i % 2 === 0 ? 0.72 : 0.5);
      c.lineWidth = i % 4 === 0 ? 0.013 : 0.008;
      c.beginPath();
      c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      c.stroke();
    }
    c.restore();
  }

  function starRing(c, x, y, r, n) {
    c.save();
    c.strokeStyle = '#fff';
    c.lineWidth = 0.010;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      var sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r;
      c.beginPath();
      c.moveTo(sx - 0.017, sy); c.lineTo(sx + 0.017, sy);
      c.moveTo(sx, sy - 0.017); c.lineTo(sx, sy + 0.017);
      c.stroke();
    }
    c.restore();
  }

  function hands(c, x, y, r, spread) {
    c.save();
    c.beginPath();
    c.moveTo(x - r * (spread || 0.55), y + r * 0.95);
    c.bezierCurveTo(x - r * 0.85, y - r * 0.3, x - r * 0.3, y - r * 1.1, x, y - r * 1.1);
    c.bezierCurveTo(x + r * 0.3, y - r * 1.1, x + r * 0.85, y - r * 0.3, x + r * (spread || 0.55), y + r * 0.95);
    c.closePath();
    body(c, x - r * 0.2, y - r * 0.3, r * 1.5, 0.55, 0.1);
    ink(c, 0.010, 0.85);
    c.strokeStyle = lum(0.08);
    c.lineWidth = 0.007;
    c.beginPath();
    for (var i = -1; i <= 1; i++) {
      c.moveTo(x + i * r * 0.26, y - r * 0.85);
      c.lineTo(x + i * r * 0.3, y + r * 0.55);
    }
    c.stroke();
    c.restore();
  }

  function crescent(c, x, y, r) {
    c.save();
    c.beginPath();
    c.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);
    c.arc(x, y - r * 0.42, r * 0.95, 0.78 * Math.PI, 0.22 * Math.PI, true);
    c.closePath();
    body(c, x - r * 0.3, y, r, 0.5, 0.08);
    ink(c, 0.013, 0.9);
    c.restore();
  }

  function arch(c) {
    c.save();
    c.beginPath();
    c.moveTo(-0.455, 1.0);
    c.lineTo(-0.455, 0.52);
    c.quadraticCurveTo(0, 0.05, 0.455, 0.52);
    c.lineTo(0.455, 1.0);
    ink(c, 0.012, 0.5);
    c.beginPath();
    c.moveTo(-0.40, 1.0);
    c.lineTo(-0.40, 0.55);
    c.quadraticCurveTo(0, 0.145, 0.40, 0.55);
    c.lineTo(0.40, 1.0);
    ink(c, 0.008, 0.26);
    // impost blocks
    [-0.4275, 0.4275].forEach(function (x) {
      c.beginPath();
      c.rect(x - 0.038, 0.52, 0.076, 0.028);
      ink(c, 0.008, 0.45);
    });
    c.restore();
  }

  function clouds(c, list) {
    c.save();
    list.forEach(function (p) {
      c.beginPath();
      c.ellipse(p[0], p[1], p[2], p[2] * 0.4, 0, Math.PI, 0);
      c.closePath();
      body(c, p[0], p[1] - p[2] * 0.2, p[2], 0.3, 0.03);
      ink(c, 0.009, 0.5);
    });
    c.restore();
  }

  /* ---------------------------------------------------------- */
  /* The six poses                                               */
  /* ---------------------------------------------------------- */

  var POSES = [
    // 1 — Theotokos: Madonna and Child
    function (c) {
      arch(c);
      halo(c, -0.03, 0.285, 0.265);
      figure(c, { x: -0.01, headY: 0.29, headR: 0.145, bot: 1.02, w: 0.40, lean: -0.012, folds: 5, seed: 1 });
      halo(c, 0.255, 0.645, 0.14, 0.85);
      figure(c, { x: 0.26, headY: 0.65, headR: 0.078, bot: 1.02, w: 0.19, lean: 0.006, folds: 2, seed: 4, hi: 0.2 });
      // the arm that holds him
      curve(c, [[-0.24, 0.70], [-0.14, 0.90], [0.04, 0.94], [0.17, 0.87]], 0.015, 0.85);
      curve(c, [[-0.25, 0.77], [-0.15, 0.96], [0.03, 1.00], [0.16, 0.94]], 0.010, 0.4);
    },

    // 2 — Orans: arms raised in prayer
    function (c) {
      rays(c, 0, 0.33, 28, 0.36, 0.72, 0.30);
      halo(c, 0, 0.31, 0.26);
      starRing(c, 0, 0.31, 0.315, 12);
      figure(c, { x: 0, headY: 0.31, headR: 0.14, bot: 1.02, w: 0.36, folds: 4, seed: 3 });
      [-1, 1].forEach(function (s) {
        curve(c, [[s * 0.20, 0.72], [s * 0.38, 0.66], [s * 0.42, 0.52], [s * 0.375, 0.44]], 0.015, 0.9);
        curve(c, [[s * 0.15, 0.80], [s * 0.33, 0.74], [s * 0.365, 0.56], [s * 0.315, 0.46]], 0.011, 0.5);
        hands(c, s * 0.345, 0.415, 0.058, 0.5);
      });
    },

    // 3 — Immaculata: crescent moon and twelve stars
    function (c) {
      rays(c, 0, 0.44, 40, 0.26, 0.82, 0.24);
      halo(c, 0, 0.245, 0.21);
      starRing(c, 0, 0.245, 0.265, 12);
      figure(c, { x: 0, headY: 0.25, headR: 0.115, bot: 0.78, w: 0.30, folds: 5, seed: 5 });
      hands(c, 0, 0.565, 0.058, 0.45);
      crescent(c, 0, 0.865, 0.165);
    },

    // 4 — Annunciata: the dove, the lily, the bowed head
    function (c) {
      c.save();
      c.beginPath();
      c.ellipse(-0.36, 0.17, 0.05, 0.027, -0.32, 0, Math.PI * 2);
      body(c, -0.37, 0.16, 0.055, 0.85, 0.2);
      ink(c, 0.011, 0.95);
      c.beginPath();
      c.moveTo(-0.38, 0.16);
      c.quadraticCurveTo(-0.33, 0.06, -0.25, 0.08);
      c.quadraticCurveTo(-0.31, 0.13, -0.32, 0.185);
      c.closePath();
      body(c, -0.33, 0.12, 0.06, 0.6, 0.1);
      ink(c, 0.009, 0.8);
      c.restore();
      rays(c, -0.36, 0.17, 16, 0.08, 0.40, 0.4);

      arch(c);
      halo(c, 0.055, 0.325, 0.245);
      figure(c, { x: 0.05, headY: 0.33, headR: 0.135, bot: 1.02, w: 0.38, lean: 0.02, folds: 4, seed: 7 });
      hands(c, -0.055, 0.755, 0.06, 0.5);
      // the lily
      curve(c, [[0.40, 1.0], [0.385, 0.83], [0.375, 0.69], [0.355, 0.555]], 0.011, 0.75);
      [[0.355, 0.52, -0.35], [0.405, 0.585, 0.5], [0.312, 0.595, -1.1]].forEach(function (p) {
        c.beginPath();
        c.ellipse(p[0], p[1], 0.026, 0.046, p[2], 0, Math.PI * 2);
        body(c, p[0], p[1], 0.05, 0.4, 0.04);
        ink(c, 0.009, 0.85);
      });
    },

    // 5 — Pietà: a triangle of grief
    function (c) {
      halo(c, -0.05, 0.235, 0.195);
      figure(c, { x: -0.01, headY: 0.24, headR: 0.11, bot: 1.02, w: 0.44, lean: -0.014, folds: 6, seed: 11 });
      c.save();
      c.beginPath();
      c.moveTo(-0.44, 0.845);
      c.bezierCurveTo(-0.21, 0.725, 0.13, 0.705, 0.43, 0.795);
      c.bezierCurveTo(0.45, 0.855, 0.42, 0.90, 0.375, 0.912);
      c.bezierCurveTo(0.07, 0.825, -0.20, 0.845, -0.41, 0.93);
      c.closePath();
      body(c, -0.05, 0.80, 0.42, 0.22, 0.015);
      ink(c, 0.015, 0.9);
      c.beginPath();
      c.ellipse(-0.445, 0.833, 0.055, 0.046, -0.3, 0, Math.PI * 2);
      body(c, -0.465, 0.818, 0.065, 0.75, 0.15);
      ink(c, 0.010, 0.9);
      c.restore();
      curve(c, [[-0.26, 0.60], [-0.39, 0.70], [-0.43, 0.78], [-0.41, 0.85]], 0.013, 0.75);
    },

    // 6 — Assumpta: taken up in a mandorla of light
    function (c) {
      c.save();
      c.beginPath();
      c.ellipse(0, 0.50, 0.31, 0.47, 0, 0, Math.PI * 2);
      ink(c, 0.016, 0.85);
      c.beginPath();
      c.ellipse(0, 0.50, 0.27, 0.43, 0, 0, Math.PI * 2);
      ink(c, 0.008, 0.4);
      c.restore();
      rays(c, 0, 0.50, 34, 0.33, 0.60, 0.26);
      halo(c, 0, 0.29, 0.185);
      figure(c, { x: 0, headY: 0.295, headR: 0.105, bot: 0.845, w: 0.245, folds: 4, seed: 13 });
      hands(c, 0, 0.63, 0.055, 0.45);
      clouds(c, [[-0.23, 0.90, 0.14], [0.02, 0.945, 0.18], [0.26, 0.885, 0.13], [-0.06, 0.865, 0.10]]);
    }
  ];

  /* ---------------------------------------------------------- */
  /* Rasterise → char grid                                       */
  /* ---------------------------------------------------------- */

  function renderPose(fn) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cols, rows);

    // Scene space: vertical extent S rows; 1 visual unit across == S * (cellH/cellW) columns
    var aspect = cellH / cellW;
    var S = Math.min(rows * 0.94, (cols / aspect) * 0.86);
    var cx = cols / 2, cyTop = (rows - S) / 2;
    ctx.save();
    ctx.translate(cx, cyTop);
    ctx.scale(S * aspect, S);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    fn(ctx);
    ctx.restore();

    var img = ctx.getImageData(0, 0, cols, rows).data;
    var n = cols * rows;
    var L = new Float32Array(n);
    for (var i = 0; i < n; i++) L[i] = img[i * 4] / 255;

    return toChars(L);
  }

  function toChars(L) {
    var n = cols * rows;
    var out = new Array(n);
    var last = RAMP.length - 1;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = y * cols + x;
        var l = L[i];
        if (l < 0.05) { out[i] = ' '; continue; }

        // Sobel
        var gx = 0, gy = 0;
        if (x > 0 && x < cols - 1 && y > 0 && y < rows - 1) {
          var tl = L[i - cols - 1], t = L[i - cols], tr = L[i - cols + 1];
          var ll = L[i - 1], rr = L[i + 1];
          var bl = L[i + cols - 1], b = L[i + cols], br = L[i + cols + 1];
          gx = (tr + 2 * rr + br) - (tl + 2 * ll + bl);
          gy = (bl + 2 * b + br) - (tl + 2 * t + tr);
        }
        var mag = Math.sqrt(gx * gx + gy * gy);

        if (mag > 0.42 && l > 0.06 && l < 0.94) {
          // stroke runs perpendicular to the gradient
          var a = Math.atan2(gy, gx) + Math.PI / 2;
          var k = Math.round(((a % Math.PI) + Math.PI) % Math.PI / (Math.PI / 4)) % 4;
          out[i] = HATCH[k];
          continue;
        }

        if (l < 0.24) {
          // stipple the deep half-tones so the drapery reads as tone, not mass
          if (hash2(x, y) > (l - 0.05) / 0.19) { out[i] = ' '; continue; }
          out[i] = l < 0.15 ? '.' : ':';
          continue;
        }
        out[i] = RAMP[Math.min(last, Math.round(Math.pow(l, 0.9) * last))];
      }
    }
    return out;
  }

  function hash2(x, y) {
    var h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  /* ---------------------------------------------------------- */
  /* Layout                                                      */
  /* ---------------------------------------------------------- */

  function measure() {
    var probe = document.createElement('span');
    probe.textContent = 'M'.repeat(50);
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';
    probe.className = 'mary-probe';
    pre.appendChild(probe);
    var r = probe.getBoundingClientRect();
    cellW = r.width / 50 || 8;
    cellH = r.height || 16;
    pre.removeChild(probe);
  }

  function layout() {
    measure();
    var w = el.clientWidth, h = el.clientHeight;
    cols = Math.max(40, Math.min(260, Math.floor(w / cellW) + 1));
    rows = Math.max(24, Math.min(140, Math.floor(h / cellH) + 1));
    cvs.width = cols; cvs.height = rows;
    ctx = cvs.getContext('2d', { willReadFrequently: true });

    noise = new Float32Array(cols * rows);
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        // bias the dissolve so it sweeps diagonally rather than randomly
        var sweep = (x / cols) * 0.35 + (y / rows) * 0.25;
        noise[y * cols + x] = Math.min(0.999, sweep * 0.7 + hash2(x, y) * 0.62);
      }
    }
    poses = POSES.map(renderPose);
    transT = 1;
    paint(1);
  }

  /* ---------------------------------------------------------- */
  /* Painting                                                    */
  /* ---------------------------------------------------------- */

  var buf = [];
  function paint(t) {
    var A = poses[current], B = poses[nextIdx];
    if (!A) return;
    var n = cols * rows;
    var lines = new Array(rows);
    var p = 0;
    for (var y = 0; y < rows; y++) {
      var row = '';
      for (var x = 0; x < cols; x++, p++) {
        var th = noise[p];
        var ch;
        if (t >= 1) ch = B[p];
        else if (t <= 0) ch = A[p];
        else if (Math.abs(th - t) < 0.045) {
          var src = th < t ? B[p] : A[p];
          ch = src === ' ' ? ' ' : BURN[(p + (t * 97 | 0)) & 3];
        } else ch = th < t ? B[p] : A[p];
        row += ch;
      }
      lines[y] = row;
    }
    pre.textContent = lines.join('\n');
  }

  function tick(ts) {
    rafId = requestAnimationFrame(tick);
    if (!running) return;
    if (!lastSwap) { lastSwap = ts; lastFrame = ts; }
    if (ts - lastFrame < 1000 / FPS) return;
    lastFrame = ts;

    if (transT < 1) {
      transT = Math.min(1, transT + (1000 / FPS) / FADE);
      paint(easeInOut(transT));
      if (transT >= 1) {
        current = nextIdx;
        lastSwap = ts;
      }
    } else if (ts - lastSwap > HOLD && !reduced) {
      advance();
    }
  }

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function advance(target) {
    if (transT < 1) return;
    nextIdx = target == null ? (current + 1) % poses.length : target % poses.length;
    if (nextIdx === current) nextIdx = (current + 1) % poses.length;
    transT = 0.0001;
  }

  /* ---------------------------------------------------------- */

  function init() {
    el = document.getElementById('mary-bg');
    pre = document.getElementById('mary-pre');
    if (!el || !pre) return;
    cvs = document.createElement('canvas');
    ctx = cvs.getContext('2d', { willReadFrequently: true });

    reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    layout();
    var t;
    global.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(layout, 220);
    });
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      lastFrame = 0; lastSwap = 0;
    });
    rafId = requestAnimationFrame(tick);
  }

  global.MaryBG = {
    init: init,
    next: function () { advance(); },
    go: function (i) { advance(i); },
    count: function () { return POSES.length; },
    index: function () { return current; },
    pause: function () { running = false; },
    resume: function () { running = true; lastFrame = 0; lastSwap = 0; }
  };
})(window);
