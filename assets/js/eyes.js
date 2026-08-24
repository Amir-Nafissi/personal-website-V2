/* =============================================================
   eyes.js — ASCII EYE ENGINE                      window.AsciiEyes
   -------------------------------------------------------------
   A pair of anime eyes drawn as characters, that follow the
   cursor. No images, no dependencies, no build step.

   HOW IT WORKS
   ------------
   1. The eye is *vector* geometry: a variable-width lash ribbon
      (a cubic bezier offset along its own normal so the stroke
      swells and tapers like a brush), a lower lid, a lash fan, a
      lid crease, an iris disc with radial striations, a pupil,
      and two specular highlights.
   2. That geometry is rasterised into an offscreen canvas whose
      aspect ratio matches the on-screen character block, at SS
      samples per cell horizontally (and SS*CELL_A vertically, so
      a circle drawn as a circle *reads* as a circle once it is
      back on the character grid).
   3. Two quantities are painted at once, in two colour channels:
        R = ink      how dark the mark is        -> glyph ramp
        G = material 0 line / 1 iris / 2 pupil   -> colour layer
      Ink accumulates with 'lighter' (additive); highlights are
      punched out with 'destination-out', which clears both
      channels at once — exactly what a specular should do.
   4. Each cell box-filters its samples down to one (ink, mat)
      pair. Ink picks a glyph from RAMP; a Sobel pass over the
      cell grid promotes cells that sit on a strong edge to a
      directional glyph, which is what makes curves read as
      *lines* rather than as dithering.
   5. Three <pre> layers are emitted, stacked and aligned: line,
      iris, pupil. That gives per-material colour for the price
      of three string builds a frame instead of 3000 spans.

   Gaze, blink, squint and saccade are just parameters of step 1,
   so tracking the cursor costs one re-render — about 1ms.

   USAGE
   -----
     var eyes = AsciiEyes.mount(document.querySelector('#eyes'), {
       cols:   150,          // character columns (default: fit host)
       aspect: 0.45,         // block height / block width
       ramp:   ' .:-=+*#%@', // sparse -> dense; [0] must be a space
       edge:   1.55,         // Sobel threshold for directional glyphs
       rest:   0.11,         // permanent partial lid; 0 = wide open
       brow:   false         // draw eyebrows
     });
     eyes.look(clientX, clientY);   // or leave it: it listens
     eyes.blink();                  // force one
     eyes.wink(1);                  // 0 = left eye, 1 = right
     eyes.setGaze(0, 0);            // -1..1, manual override
     eyes.resize();                 // after a layout change
     eyes.canvas;                   // the raw two-channel raster
     eyes.destroy();

   The host needs three stacked, pixel-aligned <pre> layers; see
   the .eye-layer / .eye-line / .eye-iris / .eye-pupil rules.
   ============================================================= */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Glyph ramp, sparse -> dense. Index 0 must be a space. */
  var RAMP = ' .:-=+*#%@';
  /* Directional glyphs for cells that sit on a strong edge,
     indexed by gradient angle octant. */
  var DIRS = ['-', '\\', '|', '/', '-', '\\', '|', '/'];

  var SS = 4;            /* horizontal samples per character cell */
  var FPS = 30;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* Deterministic per-index noise — no Math.random in the render
     path, so a given state always rasterises identically. */
  function hash(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /* ==========================================================
     GEOMETRY HELPERS
     ========================================================== */

  /* Cubic bezier point and tangent at t. */
  function bezP(p, t) {
    var m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0],
            a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
  }
  function bezT(p, t) {
    var m = 1 - t, a = 3 * m * m, b = 6 * m * t, c = 3 * t * t;
    return [a * (p[1][0] - p[0][0]) + b * (p[2][0] - p[1][0]) + c * (p[3][0] - p[2][0]),
            a * (p[1][1] - p[0][1]) + b * (p[2][1] - p[1][1]) + c * (p[3][1] - p[2][1])];
  }

  /* Offset a bezier along its normal by half of widthFn(t) each
     side and fill the resulting polygon: a stroke that can swell
     and taper. Canvas cannot do this with lineWidth. */
  function ribbon(ctx, p, widthFn, steps) {
    steps = steps || 40;
    var left = [], right = [], i, t, pt, tg, len, nx, ny, w;
    for (i = 0; i <= steps; i++) {
      t = i / steps;
      pt = bezP(p, t); tg = bezT(p, t);
      len = Math.sqrt(tg[0] * tg[0] + tg[1] * tg[1]) || 1;
      nx = -tg[1] / len; ny = tg[0] / len;
      w = Math.max(0, widthFn(t)) * 0.5;
      left.push([pt[0] + nx * w, pt[1] + ny * w]);
      right.push([pt[0] - nx * w, pt[1] - ny * w]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  /* Path (no fill) of a bezier offset by offFn(t) — used to build
     the lid-to-lid clipping region for the eye opening. */
  function offsetPath(p, offFn, steps, out) {
    var i, t, pt, tg, len, nx, ny, o;
    for (i = 0; i <= steps; i++) {
      t = i / steps;
      pt = bezP(p, t); tg = bezT(p, t);
      len = Math.sqrt(tg[0] * tg[0] + tg[1] * tg[1]) || 1;
      nx = -tg[1] / len; ny = tg[0] / len;
      o = offFn(t);
      out.push([pt[0] + nx * o, pt[1] + ny * o]);
    }
    return out;
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  /* Ink into R, material into G — but G is scaled BY the ink, so
     a cell's material is the ink-weighted mean (sum G / sum R)
     rather than an area mean. Without that, a cell holding one
     thin iris stroke on an empty ground averages its material
     down to nearly zero and gets coloured as a line. */
  var MAT = { LINE: 0, IRIS: 0.5, PUPIL: 1 };
  function paint(ink, mat) {
    var i = clamp(ink, 0, 1);
    return 'rgba(' + Math.round(i * 255) + ','
                   + Math.round(i * clamp(mat, 0, 1) * 255) + ',0,1)';
  }

  /* ==========================================================
     ONE EYE
     ----------------------------------------------------------
     cx, cy   centre in canvas px
     hw, hh   half width / half height in canvas px
     s        +1 or -1 — mirrors the *shape* (never the gaze)
     gx, gy   gaze, -1..1
     blink    0 open .. 1 closed
     ========================================================== */
  function drawEye(ctx, e) {
    var s = e.s, cx = e.cx, cy = e.cy, hw = e.hw, hh = e.hh;
    var b = e.blink;
    /* Local (u,v) -> canvas px. u is mirrored, v never is. */
    function X(u) { return cx + s * u * hw; }
    function Y(v) { return cy + v * hh; }

    /* The lid drops toward the lower lid as the eye closes, and
       tracks the gaze a little — looking down lowers the lid. */
    /* `rest` is a permanent partial lid: the eye sits half-closed
       rather than wide open, which is what reads as relaxed
       instead of startled. */
    var drop = b * 1.34 + (e.rest == null ? 0.11 : e.rest)
             + Math.max(0, e.gy) * 0.09;
    var rise = b * 0.18;

    /* The corners sit nearly level. A big lift on the outer corner
       reads as a cat-eye flick and rotates the whole face; the eye
       only needs the slight natural drop toward the tear duct. */
    var upper = [
      [X(-1.04), Y(-0.08)],
      [X(-0.60), Y(-1.10 + drop)],
      [X(0.16), Y(-0.92 + drop)],
      [X(1.00), Y(0.16)]
    ];
    var lower = [
      [X(-1.00), Y(-0.02)],
      [X(-0.50), Y(0.60 - rise)],
      [X(0.34), Y(0.54 - rise)],
      [X(0.96), Y(0.18)]
    ];

    /* Lash line thickness: peaks in the outer third, tapers to a
       point at both corners. This single curve carries most of
       the character of the eye. */
    var wmax = hh * 0.172;
    function upperW(t) {
      var f = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.70)), 0.72);
      return wmax * f * (1.12 - 0.32 * t);
    }
    function lowerW(t) {
      if (t > 0.72) return 0;
      var f = Math.pow(Math.sin(Math.PI * (t / 0.72)), 0.75);
      return hh * 0.062 * f * (0.55 + 0.60 * t);
    }

    /* ---- eye opening, used as the clip for everything wet ---- */
    /* Hold the wet part clear of the lids by half the ribbon plus a
       fixed margin. Without that margin the limbal ring — which is
       full ink — sits flush against the liner, a single cell
       straddles both, and its ink-weighted material tips to iris:
       the iris colour bleeds along the whole lash line. */
    /* The offsets are signed by `s`. offsetPath pushes along the
       curve's own normal, and the mirrored eye walks its bezier
       right-to-left, so that normal points the other way — unsigned,
       the inset expands the opening UP INTO the liner on one eye
       and the iris colour floods its lash line. */
    var open = [];
    offsetPath(upper, function (t) {
      return s * (upperW(t) * 0.5 + hh * 0.055);
    }, 34, open);
    var lowPts = offsetPath(lower, function (t) {
      return -s * (lowerW(t) * 0.5 + hh * 0.040);
    }, 34, []);
    for (var i = lowPts.length - 1; i >= 0; i--) open.push(lowPts[i]);

    ctx.save();
    poly(ctx, open);
    ctx.clip();

    ctx.globalCompositeOperation = 'lighter';

    /* No sclera shading. A character cell is a coarse sample; a
       faint wash over the white of the eye lands right on the
       ramp's first step and speckles the whole opening. */

    /* ---- iris ------------------------------------------------
       The body stays FAINT. On a dark ground the ink is the mark,
       not the shade: a solidly filled iris rasterises to a block
       of '@' and the eye stops being a drawing. The rim, the
       striations and the pupil carry it; the body only tints. */
    var R = hh * 0.74;
    var ix = cx + e.gx * hw * 0.34;
    var iy = cy + e.gy * hh * 0.26 - hh * 0.06;

    var g = ctx.createLinearGradient(0, iy - R, 0, iy + R);
    g.addColorStop(0.00, paint(0.13, MAT.IRIS));
    g.addColorStop(0.55, paint(0.05, MAT.IRIS));
    g.addColorStop(1.00, paint(0.00, MAT.IRIS));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ix, iy, R, 0, 6.2832); ctx.fill();

    /* radial striations */
    ctx.lineCap = 'butt';
    /* Striation count follows the *vertical* cell resolution —
       that is the scarce axis on a character grid. Too many and
       they alias into a solid mesh; too few and the iris is bald. */
    var irisRows = R / (e.cellH || 6);
    var n = Math.max(10, Math.min(44, Math.round(irisRows * 2.0)));
    var k, ang, r0, r1, jit;
    ctx.strokeStyle = paint(0.95, MAT.IRIS);
    ctx.lineWidth = Math.max(1.4, R * 0.055);
    for (k = 0; k < n; k++) {
      jit = hash(k + e.phase);
      ang = (k / n) * 6.2832 + e.phase * 0.11;
      /* Ticks hugging the rim, not spokes across the disc: the
         interior has to stay empty or the iris fills in solid. */
      r0 = R * (0.66 + 0.09 * jit);
      r1 = R * (0.86 + 0.05 * hash(k * 3.1 + 7));
      ctx.beginPath();
      ctx.moveTo(ix + Math.cos(ang) * r0, iy + Math.sin(ang) * r0);
      ctx.lineTo(ix + Math.cos(ang) * r1, iy + Math.sin(ang) * r1);
      ctx.stroke();
    }

    /* limbal ring — the dark rim that makes the iris feel deep */
    ctx.strokeStyle = paint(1.0, MAT.IRIS);
    ctx.lineWidth = Math.max(1.2, R * 0.115);
    ctx.beginPath(); ctx.arc(ix, iy, R * 0.94, 0, 6.2832); ctx.stroke();

    /* inner ring */
    ctx.strokeStyle = paint(0.72, MAT.IRIS);
    ctx.lineWidth = Math.max(1, R * 0.045);
    ctx.beginPath(); ctx.arc(ix, iy, R * 0.52, 0, 6.2832); ctx.stroke();

    /* ---- pupil ---------------------------------------------- */
    ctx.fillStyle = paint(1.0, MAT.PUPIL);
    ctx.beginPath();
    ctx.ellipse(ix, iy, R * 0.25, R * 0.34, 0, 0, 6.2832);
    ctx.fill();

    /* ---- specular highlights: punched clean through --------- */
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ix - R * 0.36 * s, iy - R * 0.38, R * 0.29, R * 0.26, 0, 0, 6.2832);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ix + R * 0.38 * s, iy + R * 0.38, R * 0.14, R * 0.12, 0, 0, 6.2832);
    ctx.fill();

    ctx.restore();

    /* ---- lids, lashes, crease — drawn over everything ------- */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    ctx.fillStyle = paint(1.0, MAT.LINE);
    ribbon(ctx, upper, upperW, 46);

    ctx.fillStyle = paint(0.52, MAT.LINE);
    ribbon(ctx, lower, lowerW, 34);

    /* lid crease: a thin arc riding above the lash */
    if (b < 0.55) {
      var cr = [
        [X(-0.80), Y(-0.66 + drop * 0.72)],
        [X(-0.44), Y(-1.24 + drop * 0.72)],
        [X(0.18), Y(-1.18 + drop * 0.72)],
        [X(0.76), Y(-0.56 + drop * 0.72)]
      ];
      ctx.fillStyle = paint(0.34 * (1 - b / 0.55), MAT.LINE);
      ribbon(ctx, cr, function (t) {
        return hh * 0.05 * Math.pow(Math.sin(Math.PI * t), 0.6);
      }, 28);
    }

    /* Lash fans. Each entry is [t along the lid, reach in hw,
       rise in hh]; `sign` flips the rise so the same table draws
       the lower set. Strands are graduated — longest and flattest
       at the outer corner, shorter and steeper along the lid. */
    function fan(curve, list, thick, sign) {
      var j, q, ddx, ddy, lp;
      for (j = 0; j < list.length; j++) {
        q = bezP(curve, list[j][0]);
        ddx = -s * list[j][1] * hw;
        ddy = sign * list[j][2] * hh;
        lp = [
          [q[0], q[1]],
          [q[0] + ddx * 0.32, q[1] + ddy * 0.44],
          [q[0] + ddx * 0.72, q[1] + ddy * 0.86],
          [q[0] + ddx, q[1] + ddy]
        ];
        ribbon(ctx, lp, function (t) {
          return hh * thick * Math.pow(1 - t, 1.5);
        }, 20);
      }
    }

    ctx.fillStyle = paint(1.0, MAT.LINE);
    /* Each strand roots inside the liner, so only the part that
       clears it is visible — they need real reach or the fan just
       thickens the lid. */
    fan(upper, [
      [0.000, 0.52, 0.11],
      [0.045, 0.47, 0.24],
      [0.100, 0.40, 0.33],
      [0.165, 0.32, 0.38],
      [0.245, 0.23, 0.38],
      [0.335, 0.14, 0.33]
    ], 0.105, -1);

    /* a couple under the outer end of the lower lid */
    ctx.fillStyle = paint(0.88, MAT.LINE);
    fan(lower, [
      [0.050, 0.28, 0.17],
      [0.135, 0.20, 0.21]
    ], 0.082, 1);

    /* tear duct at the inner corner */
    ctx.fillStyle = paint(0.55, MAT.LINE);
    ctx.beginPath();
    ctx.moveTo(X(0.88), Y(0.08));
    ctx.lineTo(X(1.04), Y(0.24));
    ctx.lineTo(X(0.84), Y(0.28));
    ctx.closePath();
    ctx.fill();

    /* brow — a light, high arc; anime shorthand for a face */
    if (e.brow) {
      var bw = [
        [X(-1.04), Y(-1.62)],
        [X(-0.58), Y(-2.16)],
        [X(0.24), Y(-2.06)],
        [X(0.96), Y(-1.58)]
      ];
      ctx.fillStyle = paint(0.62, MAT.LINE);
      ribbon(ctx, bw, function (t) {
        return hh * 0.13 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.8) * (1.1 - 0.4 * t);
      }, 30);
    }
    ctx.restore();
  }

  /* ==========================================================
     INSTANCE
     ========================================================== */
  function mount(host, opts) {
    opts = opts || {};
    var ramp = opts.ramp || RAMP;
    var ss = opts.ss || SS;
    var edge = opts.edge == null ? 1.55 : opts.edge;

    var cv = document.createElement('canvas');
    var ctx = cv.getContext('2d', { willReadFrequently: true });

    var layers = [];
    ['eye-line', 'eye-iris', 'eye-pupil'].forEach(function (cls) {
      var pre = document.createElement('pre');
      pre.className = 'eye-layer ' + cls;
      pre.setAttribute('aria-hidden', 'true');
      host.appendChild(pre);
      layers.push(pre);
    });
    host.setAttribute('role', 'img');
    if (!host.getAttribute('aria-label')) {
      host.setAttribute('aria-label', 'A pair of ASCII anime eyes that follow the cursor');
    }

    var cols = 0, rows = 0, cw = 8, ch = 16, cellA = 2;
    var W = 0, H = 0;

    /* animation state */
    var st = {
      gx: 0, gy: 0, tgx: 0, tgy: 0,
      blink: 0, blinkPh: -1, blinkT: 0, winkSide: -1,
      nextBlink: 1400 + Math.random() * 2600,
      phase: 0, open: 0
    };
    var mouse = { x: -1, y: -1, has: false };
    var raf = 0, last = 0, acc = 0, sig = '', alive = true;
    var idleT = 0, sacc = { x: 0, y: 0, t: 0 };

    function measure() {
      var probe = document.createElement('span');
      /* The probe borrows the layer's font, but must not inherit
         its absolute-fill box or it measures the host instead. */
      probe.className = 'eye-layer';
      probe.style.cssText = 'position:absolute!important;inset:auto!important;' +
        'left:0;top:0;width:auto!important;height:auto!important;' +
        'visibility:hidden;white-space:pre;padding:0;margin:0;';
      probe.textContent = 'MMMMMMMMMMMMMMMMMMMM\nM\nM\nM\nM';
      host.appendChild(probe);
      var r = probe.getBoundingClientRect();
      cw = (r.width / 20) || 8;
      ch = (r.height / 5) || 16;
      host.removeChild(probe);
      cellA = ch / cw;
    }

    function layout() {
      measure();
      var boxW = host.clientWidth || 640;
      cols = opts.cols || Math.max(28, Math.floor(boxW / cw));
      /* With no explicit aspect, fill the host box: the grid is
         however many whole rows fit in its height. */
      rows = opts.aspect
        ? Math.max(8, Math.round(cols * cw * opts.aspect / ch))
        : Math.max(8, Math.floor((host.clientHeight || 300) / ch));
      W = cols * ss;
      H = Math.round(rows * ss * cellA);
      cv.width = W; cv.height = H;
      sig = '';
    }

    /* ---- rasterise one frame into characters ---------------- */
    var ink, mat, chars;

    function render() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);

      /* The eye opening runs v = -0.86 .. 0.60 and u = -1 .. 1,
         so hw/hh fixes the opening's aspect. 0.88 lands on the
         ~1.2:1 that reads as an anime eye rather than a slot. */
      /* hw/hh sets how flat the opening is. 1.15 gives roughly a
         2.2:1 opening — relaxed and almond, not round and startled. */
      var hw = W * 0.166;
      var hh = hw / 1.05;
      if (hh > H * 0.32) { hh = H * 0.32; hw = hh * 1.05; }

      var cy = H * 0.60;
      /* The lash flick runs to ~1.64*hw past centre, so the gap has
         to leave room or the outer lashes clip. */
      var gap = hw * 1.32;

      var bl = st.blink, bw = st.blink;
      if (st.winkSide === 0) bw = 0;
      if (st.winkSide === 1) bl = 0;

      drawEye(ctx, {
        s: 1, cx: W * 0.5 - gap, cy: cy, hw: hw, hh: hh, cellH: H / rows,
        gx: st.gx, gy: st.gy, blink: bl, phase: 0, brow: opts.brow, rest: opts.rest
      });
      drawEye(ctx, {
        s: -1, cx: W * 0.5 + gap, cy: cy, hw: hw, hh: hh, cellH: H / rows,
        gx: st.gx, gy: st.gy, blink: bw, phase: 17, brow: opts.brow, rest: opts.rest
      });

      var img = ctx.getImageData(0, 0, W, H).data;
      var cellW = ss, cellH = H / rows;
      var n = cols * rows;
      if (!ink || ink.length !== n) {
        ink = new Float32Array(n); mat = new Float32Array(n); chars = new Array(n);
      }

      var r, c, y0, y1, x0, x1, x, y, si, sr, sg, cnt, idx;
      for (r = 0; r < rows; r++) {
        y0 = Math.floor(r * cellH); y1 = Math.min(H, Math.floor((r + 1) * cellH));
        if (y1 <= y0) y1 = y0 + 1;
        for (c = 0; c < cols; c++) {
          x0 = c * cellW; x1 = x0 + cellW;
          sr = 0; sg = 0; cnt = 0;
          for (y = y0; y < y1; y++) {
            si = (y * W + x0) * 4;
            for (x = x0; x < x1; x++) {
              sr += img[si]; sg += img[si + 1]; si += 4; cnt++;
            }
          }
          idx = r * cols + c;
          ink[idx] = cnt ? sr / (cnt * 255) : 0;
          mat[idx] = sr > 0 ? sg / sr : 0;
        }
      }

      /* Every antialiased stroke carries a halo of partial cells.
         Mapped straight onto the ramp that halo doubles the
         apparent width of every line and the drawing turns to
         mush, so ink is first pushed through a contrast window:
         below LO is nothing, above HI is solid. */
      var top = ramp.length - 1;
      var LO = 0.20, HI = 0.72, SPAN = HI - LO;
      for (r = 0; r < rows; r++) {
        for (c = 0; c < cols; c++) {
          idx = r * cols + c;
          var v = ink[idx];
          if (v < LO) { chars[idx] = ' '; continue; }
          v = Math.min(1, (v - LO) / SPAN);
          ink[idx] = v;
          var lv = Math.min(top, Math.max(1, Math.round(v * top)));
          var g0 = ramp.charAt(lv);
          /* Promote to a directional glyph only on a genuine
             boundary: a cell with real ink in it, not yet solid,
             sitting on a strong gradient. Without the ink gate
             every faint texture in the iris turns into hatching
             and the drawing collapses into a mesh. */
          if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1 && v > 0.16 && v < 0.86) {
            var a = ink, w0 = (r - 1) * cols + c, w1 = r * cols + c, w2 = (r + 1) * cols + c;
            var gxs = (a[w0 + 1] + 2 * a[w1 + 1] + a[w2 + 1]) - (a[w0 - 1] + 2 * a[w1 - 1] + a[w2 - 1]);
            var gys = (a[w2 - 1] + 2 * a[w2] + a[w2 + 1]) - (a[w0 - 1] + 2 * a[w0] + a[w0 + 1]);
            var mg = Math.sqrt(gxs * gxs + gys * gys);
            if (mg > edge) {
              var ang = Math.atan2(gys, gxs) + Math.PI / 2;   /* tangent */
              var oct = Math.round(((ang + Math.PI * 2) % Math.PI) / (Math.PI / 4)) % 4;
              g0 = DIRS[oct];
            }
          }
          chars[idx] = g0;
        }
      }

      /* three aligned layers, split by material */
      var L = [], I = [], P = [];
      for (r = 0; r < rows; r++) {
        var lr = '', ir = '', pr = '';
        for (c = 0; c < cols; c++) {
          idx = r * cols + c;
          var g1 = chars[idx], m = mat[idx];
          if (g1 === ' ') { lr += ' '; ir += ' '; pr += ' '; }
          /* Thresholds sit above the midpoint of each material step
             (0 / .5 / 1) so a cell has to be *mostly* iris or pupil
             to take that colour. Splitting at the midpoint hands
             every boundary cell to the wetter material. */
          else if (m >= 0.78) { lr += ' '; ir += ' '; pr += g1; }
          else if (m >= 0.33) { lr += ' '; ir += g1; pr += ' '; }
          else { lr += g1; ir += ' '; pr += ' '; }
        }
        L.push(lr); I.push(ir); P.push(pr);
      }
      layers[0].textContent = L.join('\n');
      layers[1].textContent = I.join('\n');
      layers[2].textContent = P.join('\n');
    }

    /* ---- gaze ------------------------------------------------ */
    function setTargetFromMouse() {
      if (!mouse.has) { st.tgx = 0; st.tgy = 0; return; }
      var r = host.getBoundingClientRect();
      var ex = r.left + r.width * 0.5;
      var ey = r.top + r.height * 0.52;
      var dx = (mouse.x - ex) / Math.max(220, r.width * 0.85);
      var dy = (mouse.y - ey) / Math.max(180, window.innerHeight * 0.42);
      /* smooth saturation: near the eyes it is nearly linear, far
         away it flattens instead of pinning to the corner. */
      st.tgx = clamp(dx / (1 + Math.abs(dx) * 0.55), -1, 1);
      st.tgy = clamp(dy / (1 + Math.abs(dy) * 0.55), -1, 1);
    }

    function frame(ts) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (!last) last = ts;
      var dt = Math.min(80, ts - last);
      last = ts;
      acc += dt;
      if (acc < 1000 / FPS) return;
      acc = 0;

      setTargetFromMouse();

      /* micro-saccades keep the eyes alive when the cursor is not */
      if (!REDUCED) {
        idleT += dt;
        sacc.t -= dt;
        if (sacc.t <= 0) {
          sacc.t = 700 + Math.random() * 1800;
          var amp = idleT > 2500 ? 0.075 : 0.02;
          sacc.x = (Math.random() * 2 - 1) * amp;
          sacc.y = (Math.random() * 2 - 1) * amp * 0.7;
        }
      }

      var k = REDUCED ? 0.45 : 0.16;
      st.gx = lerp(st.gx, clamp(st.tgx + sacc.x, -1, 1), k);
      st.gy = lerp(st.gy, clamp(st.tgy + sacc.y, -1, 1), k);

      /* blink state machine: close fast, hold, open slower */
      if (!REDUCED) {
        if (st.blinkPh < 0) {
          st.nextBlink -= dt;
          if (st.nextBlink <= 0) { st.blinkPh = 0; st.blinkT = 0; }
        } else {
          st.blinkT += dt;
          if (st.blinkPh === 0) {
            st.blink = clamp(st.blinkT / 90, 0, 1);
            if (st.blinkT >= 90) { st.blinkPh = 1; st.blinkT = 0; }
          } else if (st.blinkPh === 1) {
            st.blink = 1;
            if (st.blinkT >= 55) { st.blinkPh = 2; st.blinkT = 0; }
          } else {
            st.blink = 1 - clamp(st.blinkT / 170, 0, 1);
            if (st.blinkT >= 170) {
              st.blinkPh = -1; st.blink = 0; st.winkSide = -1;
              /* occasional double blink */
              st.nextBlink = Math.random() < 0.16
                ? 220
                : 2200 + Math.random() * 5200;
            }
          }
        }
      }

      st.phase += 0.006;

      /* opening animation, driven from outside via .reveal() */
      var s2 = [
        st.gx.toFixed(3), st.gy.toFixed(3), st.blink.toFixed(3),
        st.winkSide, st.open.toFixed(3), cols, rows
      ].join('|');
      if (s2 === sig) return;
      sig = s2;
      render();
    }

    /* ---- listeners ------------------------------------------ */
    function onMove(e) {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.has = true; idleT = 0;
    }
    function onTouch(e) {
      if (!e.touches || !e.touches.length) return;
      mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY;
      mouse.has = true; idleT = 0;
    }
    function onLeave() { mouse.has = false; }
    var ro = null;

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    layout();
    render();
    raf = requestAnimationFrame(frame);

    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { layout(); sig = ''; render(); });
      ro.observe(host);
    }

    return {
      el: host,
      canvas: cv,
      cols: function () { return cols; },
      rows: function () { return rows; },
      look: function (x, y) { mouse.x = x; mouse.y = y; mouse.has = true; idleT = 0; },
      setGaze: function (x, y) { st.tgx = clamp(x, -1, 1); st.tgy = clamp(y, -1, 1); mouse.has = false; },
      blink: function () { if (st.blinkPh < 0) { st.blinkPh = 0; st.blinkT = 0; st.winkSide = -1; } },
      wink: function (side) { if (st.blinkPh < 0) { st.blinkPh = 0; st.blinkT = 0; st.winkSide = side; } },
      resize: function () { layout(); sig = ''; render(); },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('touchmove', onTouch);
        document.removeEventListener('mouseleave', onLeave);
        if (ro) ro.disconnect();
        layers.forEach(function (l) { if (l.parentNode) l.parentNode.removeChild(l); });
      }
    };
  }

  window.AsciiEyes = { mount: mount, RAMP: RAMP, VERSION: '1.0.0' };
})();
