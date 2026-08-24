/* =============================================================
   main.js — boot, stage machine, status bar, input.
   -------------------------------------------------------------
   The page has three stages and main.js owns the transitions
   between them:

     boot   the log types out
     eyes   the eyes fade up, centred and alone
     shell  the eyes step aside, the terminal opens
     open   the stage lifts and scales, the deck rises under it

   Stage is a single attribute on <html>; every movement is a CSS
   transform keyed off it (see the STAGE MACHINE block in
   style.css). Nothing here animates layout.
   ============================================================= */
(function () {
  'use strict';

  var S = window.SITE;
  var F = window.AsciiFont;
  var $ = function (s) { return document.querySelector(s); };
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  var eyes = null;
  var THEMES = ['mocha', 'gruvbox', 'tokyo'];

  function stage(name) { root.dataset.stage = name; }
  function stageIs(name) { return root.dataset.stage === name; }

  /* ==========================================================
     AUDIO — opt-in, silent until toggled
     ========================================================== */
  var Snd = (function () {
    var actx = null, on = false;
    function ensure() {
      if (!actx && window.AudioContext) actx = new AudioContext();
      if (actx && actx.state === 'suspended') actx.resume();
    }
    return {
      toggle: function () { on = !on; if (on) ensure(); return on; },
      isOn: function () { return on; },
      click: function (freq, dur, vol) {
        if (!on || !actx) return;
        var t = actx.currentTime;
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(freq || 1100, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol || 0.03, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.04));
        o.connect(g); g.connect(actx.destination);
        o.start(t); o.stop(t + (dur || 0.04) + 0.02);
      }
    };
  })();

  /* ==========================================================
     THEME
     ========================================================== */
  function setTheme(name) {
    if (THEMES.indexOf(name) < 0) name = THEMES[0];
    root.dataset.theme = name;
    var v = $('#mod-theme .mod-v');
    if (v) v.textContent = name;
    try { localStorage.setItem('rice-theme', name); } catch (e) {}
    return name;
  }
  function cycleTheme() {
    var i = THEMES.indexOf(root.dataset.theme);
    return setTheme(THEMES[(i + 1) % THEMES.length]);
  }
  /* `theme`, `theme tokyo` — both reachable from the shell */
  function themeCmd(arg) {
    arg = (arg || '').trim().toLowerCase();
    if (!arg) return 'theme: ' + cycleTheme() + '   (' + THEMES.join(' · ') + ')';
    if (THEMES.indexOf(arg) < 0) return 'no such theme: ' + arg + '   (' + THEMES.join(' · ') + ')';
    return 'theme: ' + setTheme(arg);
  }

  /* ==========================================================
     STATUS BAR
     ========================================================== */
  function initBar() {
    var clock = $('#mod-clock');
    function tick() {
      var d = new Date();
      clock.textContent =
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');
    }
    tick();
    setInterval(tick, 15000);

    /* A cpu meter that is honestly decorative — it walks a small
       random walk rather than pretending to measure anything. */
    var bar = $('#mod-cpu .mod-bar');
    var mem = $('#mod-mem .mod-v');
    var GL = '▁▂▃▄▅▆▇█';
    var vals = [3, 2, 4, 3, 5], m = 56;
    if (!REDUCED) {
      setInterval(function () {
        vals.shift();
        vals.push(Math.max(0, Math.min(7,
          vals[vals.length - 1] + Math.round((Math.random() - 0.5) * 4))));
        bar.textContent = vals.map(function (v) { return GL.charAt(v); }).join('');
        m = Math.max(38, Math.min(88, m + Math.round((Math.random() - 0.5) * 6)));
        mem.textContent = m + '%';
      }, 1400);
    }

    $('#mod-theme').addEventListener('click', function () {
      cycleTheme(); Snd.click(880, 0.05);
    });

    var snd = $('#mod-snd');
    snd.addEventListener('click', function () {
      var on = Snd.toggle();
      snd.setAttribute('aria-pressed', on ? 'true' : 'false');
      snd.querySelector('.mod-v').textContent = on ? 'on' : 'off';
      Snd.click(1400, 0.05);
    });

    Array.prototype.forEach.call(document.querySelectorAll('.ws-b'), function (b) {
      b.addEventListener('click', function () {
        Snd.click(1300, 0.03);
        go(b.dataset.cmd === 'home' ? null : b.dataset.cmd, true);
      });
    });
  }

  function markWs(key) {
    Array.prototype.forEach.call(document.querySelectorAll('.ws-b'), function (b) {
      b.classList.toggle('on', b.dataset.cmd === (key || 'home'));
    });
    var t = $('#bar-title');
    if (t) {
      t.textContent = key
        ? 'amir@kanso: ' + S.sections[key].path + ' — ' + S.sections[key].title.toLowerCase()
        : 'amir@kanso: ~';
    }
  }

  /* ==========================================================
     STAGE TRANSITIONS
     ========================================================== */

  /* How far the stage lifts, and how much it shrinks, when the
     deck comes up. Both are measured rather than guessed: the
     terminal's height depends on how many chip rows wrapped, and
     a fixed lift either overlaps the deck or leaves a hole.

     The stage is centred in whatever room is left above the deck,
     so k and the lift fall out of the same two numbers. */
  function fitStage() {
    var desk = $('#desk'), deckEl = $('#deck');
    var termEl = $('#term-win'), eyesEl = $('#eyes');
    if (!desk || !deckEl) return;

    var deskH = desk.clientHeight;
    var deckH = deckEl.offsetHeight;
    var pad = 16;
    var avail = Math.max(120, deskH - deckH - pad);

    /* The taller of the two things the stage carries — except on
       narrow screens, where the eyes are faded out once the deck
       is up and must not reserve room. */
    var narrow = window.matchMedia('(max-width: 900px)').matches;
    var content = narrow
      ? Math.max(termEl.offsetHeight, 1)
      : Math.max(termEl.offsetHeight, eyesEl.offsetHeight, 1);

    var k = Math.max(0.46, Math.min(0.84, avail / content));
    var lift = deskH / 2 - avail / 2;

    root.style.setProperty('--stage-k', k.toFixed(3));
    root.style.setProperty('--lift', Math.max(0, Math.round(lift)) + 'px');
  }

  /* One entry point for "show this section" / "show none", from
     the shell, the workspace pills and the keyboard alike. */
  function go(key, echo) {
    if (!key) {
      if (window.Deck.current()) window.Deck.close();
      if (!stageIs('boot')) stage('shell');
      markWs(null);
      window.Shell.mark(null);
      return;
    }
    if (!S.sections[key]) return;
    if (echo && window.Deck.current() !== key) {
      /* came from a click, not from typing — echo it in the shell
         so the terminal stays the record of what happened */
      window.Shell.run(key);
      return;
    }
    window.Deck.open(key);
    fitStage();
    stage('open');
    markWs(key);
    window.Shell.mark(key);
  }

  /* ==========================================================
     LIGHTBOX
     ========================================================== */
  var Lb = (function () {
    var box, img, titleEl, metaEl, countEl, idx = 0, lastFocus = null;

    function show(i) {
      var list = window.Deck.arts();
      if (!list.length) return;
      idx = (i + list.length) % list.length;
      var a = list[idx];
      img.src = a.src;
      img.alt = a.title;
      titleEl.textContent = a.title;
      metaEl.textContent = a.meta;
      countEl.textContent = pad2(idx + 1) + ' / ' + pad2(list.length);
    }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    function open(i) {
      lastFocus = document.activeElement;
      box.hidden = false;
      show(i);
      $('#lb-close').focus();
    }
    function close() {
      box.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function isOpen() { return box && !box.hidden; }

    return {
      init: function () {
        box = $('#lb'); img = $('#lb-img');
        titleEl = $('#lb-title'); metaEl = $('#lb-meta'); countEl = $('#lb-count');
        $('#lb-prev').addEventListener('click', function () { show(idx - 1); });
        $('#lb-next').addEventListener('click', function () { show(idx + 1); });
        $('#lb-close').addEventListener('click', close);
        box.addEventListener('click', function (e) { if (e.target === box) close(); });
        window.Deck.openArt = open;
      },
      close: close, isOpen: isOpen,
      step: function (d) { show(idx + d); }
    };
  })();

  /* ==========================================================
     KEYBOARD
     ========================================================== */
  function initKeys() {
    var input = $('#term-in');
    document.addEventListener('keydown', function (e) {
      if (Lb.isOpen()) {
        if (e.key === 'Escape') { e.preventDefault(); Lb.close(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); Lb.step(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); Lb.step(-1); }
        return;
      }

      var typing = document.activeElement === input;

      if (e.key === 'Escape') {
        e.preventDefault();
        go(null);
        return;
      }
      if (e.key === '/' && !typing) {
        e.preventDefault();
        window.Shell.focus();
        return;
      }
      if (typing) return;

      if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var b = document.querySelector('.ws-b[data-n="' + e.key + '"]');
        if (b) { e.preventDefault(); b.click(); }
        return;
      }
      if (window.Deck.current()) {
        if (e.key === 'ArrowRight') { e.preventDefault(); window.Deck.step(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); window.Deck.step(-1); }
      }
    });

    /* clicking empty desktop returns focus to the prompt */
    $('#desk').addEventListener('mousedown', function (e) {
      if (e.target.id === 'desk' || e.target.id === 'stage') window.Shell.focus();
    });
    $('#deck-x').addEventListener('click', function () {
      Snd.click(700, 0.05);
      window.Shell.run('clear');
    });
  }

  /* ==========================================================
     BOOT
     ========================================================== */
  function boot(done) {
    var el = $('#boot'), log = $('#boot-log'), skip = $('#boot-skip');
    var logo = F ? F.banner('KANSO') : '';
    var seed = [
      'ricelinux 6.9.4-zen1 (tty1)',
      '',
      'loading glyph tables ............ 96 ascii + 32 block',
      'starting compositor ............. hyprland',
      'mounting /dev/rice .............. OK',
      'rasterising eyes ................ 2 vector, 1 buffer',
      'calibrating gaze ................ sobel / 4-way',
      'starting bar .................... waybar',
      'starting shell .................. zsh',
      '',
      'ready.'
    ];
    var i = 0, outStr = '', finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      el.classList.add('done');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 520);
      done();
    }

    if (REDUCED) {
      log.textContent = logo + '\n' + seed.join('\n');
      setTimeout(finish, 350);
    } else {
      (function step() {
        if (finished) return;
        if (i >= seed.length) { setTimeout(finish, 460); return; }
        outStr += (outStr ? '\n' : '') + seed[i++];
        log.textContent = logo + '\n' + outStr;
        Snd.click(1600, 0.02, 0.014);
        setTimeout(step, 95 + Math.random() * 110);
      })();
    }

    skip.addEventListener('click', finish);
    el.addEventListener('click', finish);
    window.addEventListener('keydown', finish, { once: true });
  }

  /* ==========================================================
     INIT
     ========================================================== */
  function ready() {
    try {
      var saved = localStorage.getItem('rice-theme');
      if (saved) setTheme(saved); else setTheme(THEMES[0]);
    } catch (e) { setTheme(THEMES[0]); }

    window.Deck.init();
    Lb.init();
    window.Shell.init({
      onSection: function (key) { go(key); },
      onTheme: themeCmd,
      onKey: function (f) { Snd.click(f, 0.02, 0.02); }
    });
    initBar();
    initKeys();

    boot(function () {
      stage('eyes');
      window.Wall.init();

      eyes = window.AsciiEyes.mount($('#eyes'), { edge: 1.55 });
      var cells = eyes.cols() * eyes.rows() + window.Wall.cells();
      $('#keys-chars').textContent = cells.toLocaleString();

      /* Hold on the eyes alone, then let the terminal in. Any
         click or keypress takes the shortcut. */
      var opened = false;
      function toShell() {
        if (opened) return;
        opened = true;
        clearTimeout(timer);
        stage('shell');
        setTimeout(function () {
          window.Shell.greet();
          if (!('ontouchstart' in window)) window.Shell.focus();
        }, 420);
      }
      var timer = setTimeout(toShell, REDUCED ? 600 : 3200);
      window.addEventListener('keydown', toShell, { once: true });
      window.addEventListener('mousedown', toShell, { once: true });

      window.addEventListener('resize', function () {
        if (eyes) eyes.resize();
        fitStage();
      });
      fitStage();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
