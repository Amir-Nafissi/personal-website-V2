/* =============================================================
   mary.js — rotating ASCII Saint Mary background.

   The frames are real Renaissance engravings (Schongauer, Goltzius,
   Galle) from the Met's Open Access collection, preprocessed offline by
   tools/asciify.mjs into inverted grayscale luminance maps and inlined
   as data: URIs in mary-frames.js.

   Why engravings rather than drawn shapes: the look depends entirely on
   burin work — parallel hatching that swells and tapers, cross-hatch in
   the shadows, stipple flicks in the half-tones. That texture is what
   survives quantisation to a character grid, and it is not something
   bezier curves can fake.

   Each frame is drawn into a canvas whose pixel grid *is* the character
   grid, then sampled twice: luminance picks a glyph from a ramp, and a
   Sobel pass promotes strong edges to directional glyphs so contours
   stay crisp. Results are cached per frame, so a transition costs one
   string build per painted frame.
   ============================================================= */
(function (global) {
  'use strict';

  var RAMP = ' .`,:;-~=+ox*O#%@';
  var HATCH = ['-', '\\', '|', '/'];
  var BURN = ['*', '+', '.', '·'];

  var BIG = 1.85;          // plate height as a multiple of the viewport
  var MAXW = 1.0;          // ...but never wider than this share of the grid
  var TRAVEL = 0.28;       // guaranteed pan range, as a share of viewport height
  var EASE = 0.12;         // parallax follow rate, per painted frame
  var HOLD = 9000;         // ms per pose
  var FADE = 2200;         // ms crossfade
  var FPS = 24;

  var el, pre, cvs, ctx;
  var cols = 0, rows = 0;  // viewport, in characters
  var bufRows = 0;         // rendered plate height; bufRows - rows is the pan travel
  var panTarget = 0, panCur = 0, panPainted = -1;
  var cellW = 8, cellH = 16;
  var images = [];         // decoded HTMLImageElements
  var poses = [];          // cached char arrays, parallel to images
  var noise = null;        // per-cell dissolve threshold
  var current = 0, nextIdx = 1;
  var transT = 1;          // 1 = settled
  var lastFrame = 0, lastSwap = 0;
  var running = true, reduced = false, ready = false;
  var rafId = 0;

  /* ---------------------------------------------------------- */
  /* Rasterise a plate into the character grid                   */
  /* ---------------------------------------------------------- */

  /* A character cell is taller than it is wide, so a plate of ratio w/h
     needs w/h * cellH/cellW columns for every row to stay square. */
  function plateRatio(img) {
    return (img.naturalWidth / img.naturalHeight) * (cellH / cellW);
  }

  /* Blown up to BIG times the viewport, unless that would run off the
     sides — on a tall narrow phone a portrait plate is width-bound long
     before it is height-bound. */
  function plateHeight(img) {
    return Math.min(rows * BIG, (cols * MAXW) / plateRatio(img));
  }

  /* Each plate is rasterised once into a buffer taller than the viewport.
     Scrolling slides a rows-high window down that buffer, which is pure
     index arithmetic — no redraw, no resample, no getImageData per frame.

     The buffer is tall enough for the largest plate, and never shorter
     than the viewport plus TRAVEL, so there is always something to pan
     even where the plate itself ends up smaller than the screen. */
  function renderPose(img) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cols, bufRows);

    // A character cell is taller than it is wide, so a plate of ratio
    // w/h needs w/h * cellH/cellW columns for every row to stay square.
    var h = plateHeight(img);
    var w = h * plateRatio(img);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (cols - w) / 2, (bufRows - h) / 2, w, h);

    var data = ctx.getImageData(0, 0, cols, bufRows).data;
    var n = cols * bufRows;
    var L = new Float32Array(n);
    for (var i = 0; i < n; i++) L[i] = data[i * 4] / 255;
    return toChars(L);
  }

  function toChars(L) {
    var n = cols * bufRows;
    var out = new Array(n);
    var last = RAMP.length - 1;
    for (var y = 0; y < bufRows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = y * cols + x;
        var l = L[i];
        if (l < 0.045) { out[i] = ' '; continue; }

        var gx = 0, gy = 0;
        if (x > 0 && x < cols - 1 && y > 0 && y < bufRows - 1) {
          var tl = L[i - cols - 1], t = L[i - cols], tr = L[i - cols + 1];
          var ll = L[i - 1], rr = L[i + 1];
          var bl = L[i + cols - 1], b = L[i + cols], br = L[i + cols + 1];
          gx = (tr + 2 * rr + br) - (tl + 2 * ll + bl);
          gy = (bl + 2 * b + br) - (tl + 2 * t + tr);
        }
        var mag = Math.sqrt(gx * gx + gy * gy);

        // Strong edges become directional glyphs. The threshold is high
        // because the plates already carry their own line texture — a
        // low one turns every hatched passage into noise.
        if (mag > 0.85 && l > 0.10 && l < 0.92) {
          var a = Math.atan2(gy, gx) + Math.PI / 2;
          var k = Math.round(((a % Math.PI) + Math.PI) % Math.PI / (Math.PI / 4)) % 4;
          out[i] = HATCH[k];
          continue;
        }

        // Stipple the deep half-tones rather than laying down a flat
        // character, so shadow passages read as tone.
        if (l < 0.26) {
          if (hash2(x, y) > (l - 0.045) / 0.215) { out[i] = ' '; continue; }
          out[i] = l < 0.16 ? '.' : ':';
          continue;
        }
        out[i] = RAMP[Math.min(last, Math.round(Math.pow(l, 0.88) * last))];
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
    probe.textContent = new Array(51).join('M');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';
    probe.className = 'mary-probe';
    pre.appendChild(probe);
    var r = probe.getBoundingClientRect();
    cellW = r.width / 50 || 8;
    cellH = r.height || 16;
    pre.removeChild(probe);
  }

  function layout() {
    if (!images.length) return;
    measure();
    var w = el.clientWidth, h = el.clientHeight;
    cols = Math.max(40, Math.min(260, Math.floor(w / cellW) + 1));
    rows = Math.max(24, Math.min(140, Math.floor(h / cellH) + 1));
    var tallest = 0;
    images.forEach(function (img) { tallest = Math.max(tallest, plateHeight(img)); });
    bufRows = Math.min(420, Math.max(Math.round(rows * (1 + TRAVEL)), Math.round(tallest)));
    cvs.width = cols; cvs.height = bufRows;
    ctx = cvs.getContext('2d', { willReadFrequently: true });

    // The dissolve pattern is keyed to the screen, not to the plate, so a
    // transition sweeps the viewport rather than sliding with the parallax.
    noise = new Float32Array(cols * rows);
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        // bias the dissolve so it sweeps diagonally rather than randomly
        var sweep = (x / cols) * 0.35 + (y / rows) * 0.25;
        noise[y * cols + x] = Math.min(0.999, sweep * 0.7 + hash2(x, y) * 0.62);
      }
    }
    poses = images.map(renderPose);
    transT = 1;
    readScroll();
    panCur = panTarget;
    panPainted = -1;
    paint(1);
  }

  /* Page scroll position drives which slice of the plate is on screen. */
  function readScroll() {
    var d = document.documentElement;
    var max = d.scrollHeight - d.clientHeight;
    var p = max > 8 ? Math.min(1, Math.max(0, d.scrollTop / max)) : 0;
    if (reduced) p = 0.5;
    panTarget = p * Math.max(0, bufRows - rows);
  }

  /* ---------------------------------------------------------- */
  /* Painting                                                    */
  /* ---------------------------------------------------------- */

  function paint(t) {
    var A = poses[current], B = poses[nextIdx];
    if (!A || !B) return;
    var off = Math.round(panCur) * cols;   // parallax, in whole character rows
    var lines = new Array(rows);
    var p = 0;                             // screen index, for the dissolve
    for (var y = 0; y < rows; y++) {
      var row = '';
      for (var x = 0; x < cols; x++, p++) {
        var s = p + off;                   // plate index
        var th = noise[p];
        var ch;
        if (t >= 1) ch = B[s];
        else if (t <= 0) ch = A[s];
        else if (Math.abs(th - t) < 0.045) {
          var src = th < t ? B[s] : A[s];
          ch = src === ' ' ? ' ' : BURN[(p + (t * 97 | 0)) & 3];
        } else ch = th < t ? B[s] : A[s];
        row += ch;
      }
      lines[y] = row;
    }
    pre.textContent = lines.join('\n');
    panPainted = Math.round(panCur);
  }

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function tick(ts) {
    rafId = requestAnimationFrame(tick);
    if (!running || !ready) return;
    if (!lastSwap) { lastSwap = ts; lastFrame = ts; }
    if (ts - lastFrame < 1000 / FPS) return;
    lastFrame = ts;

    // ease the parallax towards the scroll position so flicks glide
    // instead of snapping; it settles to exact once the delta is sub-cell
    var d = panTarget - panCur;
    if (Math.abs(d) > 0.01) panCur += d * EASE; else panCur = panTarget;

    if (transT < 1) {
      transT = Math.min(1, transT + (1000 / FPS) / FADE);
      paint(easeInOut(transT));
      if (transT >= 1) { current = nextIdx; lastSwap = ts; }
    } else if (Math.round(panCur) !== panPainted) {
      paint(1);
    } else if (ts - lastSwap > HOLD && !reduced) {
      advance();
    }
  }

  function advance(target) {
    if (transT < 1 || poses.length < 2) return;
    nextIdx = target == null ? (current + 1) % poses.length : target % poses.length;
    if (nextIdx === current) nextIdx = (current + 1) % poses.length;
    transT = 0.0001;
  }

  /* ---------------------------------------------------------- */

  function loadFrames(done) {
    var defs = global.MARY_FRAMES || [];
    if (!defs.length) { done(); return; }
    var pending = defs.length;
    defs.forEach(function (def, i) {
      var img = new Image();
      img.onload = img.onerror = function () {
        if (img.naturalWidth) images[i] = img;
        if (--pending === 0) {
          images = images.filter(Boolean);
          done();
        }
      };
      img.src = def.src;
    });
  }

  function init() {
    el = document.getElementById('mary-bg');
    pre = document.getElementById('mary-pre');
    if (!el || !pre) return;
    cvs = document.createElement('canvas');
    ctx = cvs.getContext('2d', { willReadFrequently: true });

    reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    loadFrames(function () {
      if (!images.length) return;
      layout();
      ready = true;
    });

    var t;
    global.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(layout, 220);
    });
    global.addEventListener('scroll', readScroll, { passive: true });
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
    count: function () { return poses.length; },
    index: function () { return current; },
    credit: function () {
      var d = (global.MARY_FRAMES || [])[current];
      return d ? d.credit : '';
    },
    pause: function () { running = false; },
    resume: function () { running = true; lastFrame = 0; lastSwap = 0; }
  };
})(window);
