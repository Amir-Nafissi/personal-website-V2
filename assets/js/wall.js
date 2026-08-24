/* =============================================================
   wall.js — ambient ASCII wallpaper                window.Wall
   -------------------------------------------------------------
   A slow interference pattern of three sine waves sampled onto
   the character grid. It sits at 8% opacity behind everything,
   so its whole job is to give the background a weave instead of
   a flat fill. Cheap on purpose: one string build every other
   frame at 12fps, and it stops entirely when the tab is hidden
   or the user asked for reduced motion.
   ============================================================= */
(function () {
  'use strict';

  var RAMP = ' .:-=+*';
  var FPS = 12;

  var pre, cols = 0, rows = 0, cw = 8, ch = 16;
  var t = 0, raf = 0, acc = 0, last = 0, running = false;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function measure() {
    var p = document.createElement('span');
    p.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;' +
      'font:inherit;padding:0;margin:0;';
    p.textContent = 'MMMMMMMMMMMMMMMMMMMM\nM\nM\nM\nM';
    pre.appendChild(p);
    var r = p.getBoundingClientRect();
    cw = (r.width / 20) || 8;
    ch = (r.height / 5) || 16;
    pre.removeChild(p);
  }

  function layout() {
    measure();
    cols = Math.ceil(window.innerWidth / cw) + 2;
    rows = Math.ceil(window.innerHeight / ch) + 2;
  }

  function paint() {
    var out = [], r, c, v, s = '';
    var top = RAMP.length - 1;
    for (r = 0; r < rows; r++) {
      s = '';
      for (c = 0; c < cols; c++) {
        /* three drifting waves; the product keeps the field sparse
           instead of banding into stripes */
        v = Math.sin(c * 0.118 + t) *
            Math.sin(r * 0.205 - t * 0.62) *
            Math.sin((c * 0.62 + r * 1.15) * 0.082 + t * 0.4);
        v = (v + 1) * 0.5;
        v = Math.pow(v, 4.2);
        s += RAMP.charAt(Math.min(top, Math.round(v * top)));
      }
      out.push(s);
    }
    pre.textContent = out.join('\n');
  }

  function frame(ts) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    acc += ts - last; last = ts;
    if (acc < 1000 / FPS) return;
    acc = 0;
    t += 0.05;
    paint();
  }

  function start() {
    if (running || REDUCED) return;
    running = true; last = 0; acc = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  window.Wall = {
    init: function () {
      pre = document.getElementById('wall-pre');
      if (!pre) return;
      layout();
      paint();
      start();

      var rt;
      window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(function () { layout(); paint(); }, 180);
      });
      document.addEventListener('visibilitychange', function () {
        document.hidden ? stop() : start();
      });
    },
    cells: function () { return cols * rows; },
    stop: stop,
    start: start
  };
})();
