/* =============================================================
   main.js — everything that isn't the background engine.
   Rendering, typewriters, terminal, gallery, konami, input.
   ============================================================= */
(function () {
  'use strict';

  var S = window.SITE;
  var F = window.AsciiFont;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var rep = F.repeat;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================
     TEXT UTILITIES
     ========================================================== */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function pad(s, n) { s = String(s); return s + rep(' ', Math.max(0, n - s.length)); }
  function wrap(text, w) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (word) {
      if (!cur.length) { cur = word; return; }
      if ((cur + ' ' + word).length <= w) cur += ' ' + word;
      else { lines.push(cur); cur = word; }
    });
    if (cur.length) lines.push(cur);
    return lines;
  }

  /* Character metrics for the primary mono face at body size. */
  var CW = 8, CH = 16;
  function measure() {
    var p = document.createElement('span');
    p.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';
    p.textContent = rep('M', 100);
    document.body.appendChild(p);
    var r = p.getBoundingClientRect();
    CW = (r.width / 100) || 8;
    CH = r.height || 16;
    document.body.removeChild(p);
  }
  function fitCols(el, max, min) {
    var w = el ? el.clientWidth : 600;
    return Math.max(min || 28, Math.min(max || 96, Math.floor(w / CW) - 1));
  }

  /* Shrink a banner until it fits its box. Measured rather than modelled:
     scrollWidth scales linearly with font-size (em letter-spacing included),
     so one probe render gives the exact ratio for any face. */
  function fitBanner(el) {
    var max = parseFloat(el.dataset.fsMax) || 10;
    var avail = el.clientWidth;
    if (!avail) return;
    el.style.fontSize = max + 'px';
    var w = el.scrollWidth;
    if (w > avail) {
      el.style.fontSize = Math.max(3.4, max * (avail / w) * 0.985).toFixed(2) + 'px';
    }
  }
  function fitBanners() { $$('[data-fs-max]').forEach(fitBanner); }

  /* ==========================================================
     AUDIO — tiny terminal clicks
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
        g.gain.exponentialRampToValueAtTime(vol || 0.035, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.045));
        o.connect(g); g.connect(actx.destination);
        o.start(t); o.stop(t + (dur || 0.045) + 0.02);
      }
    };
  })();

  /* ==========================================================
     TYPEWRITER
     ========================================================== */
  function typeInto(el, text, opts) {
    opts = opts || {};
    var speed = opts.speed || 18;
    var i = 0;
    el.textContent = '';
    if (REDUCED) { el.textContent = text; if (opts.done) opts.done(); return; }
    (function step() {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, speed + (Math.random() * speed * 0.7));
      else if (opts.done) opts.done();
    })();
  }

  function armTypewriters() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        var text = el.dataset.twText;
        setTimeout(function () { typeInto(el, text, { speed: 14 }); },
          parseInt(el.dataset.twDelay || '0', 10));
      });
    }, { threshold: 0.2 });
    $$('[data-tw]').forEach(function (el) {
      el.dataset.twText = el.textContent;
      el.textContent = '';
      io.observe(el);
    });
  }

  /* ==========================================================
     REVEAL ON SCROLL
     ========================================================== */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -5% 0px' });
  function reveal(el, delay) {
    el.classList.add('reveal');
    if (delay) el.style.transitionDelay = delay + 'ms';
    revealIO.observe(el);
  }

  /* ==========================================================
     BANNERS
     ========================================================== */
  function paintBanners() {
    var hero = $('#hero-banner');
    if (hero) {
      hero.textContent = F.banner(S.identity.name);
      hero.dataset.fsMax = '17';
    }
    $$('[data-banner]').forEach(function (el) {
      el.textContent = F.banner(el.dataset.banner);
      el.dataset.fsMax = '13';
    });
    fitBanners();
  }

  /* ==========================================================
     HERO
     ========================================================== */
  function buildHero() {
    var card = $('#hero-card');
    var id = S.identity;
    var cols = Math.min(66, fitCols(card, 66, 30));
    var rows = [
      ['status', 'available for interesting problems'],
      ['location', id.location],
      ['mail', id.email],
      ['render', 'ascii / 7-bit, zero images above the fold']
    ];
    var inner = cols - 2;
    var out = ['┌' + rep('─', inner) + '┐'];
    rows.forEach(function (r) {
      var label = pad(r[0], 8) + ' : ';
      wrap(r[1], Math.max(8, inner - 2 - label.length)).forEach(function (l, i) {
        out.push('│ ' + pad((i ? rep(' ', label.length) : label) + l, inner - 2) + ' │');
      });
    });
    out.push('└' + rep('─', inner) + '┘');
    card.textContent = out.join('\n');

    $('#hero-links').innerHTML = id.links.map(function (l) {
      return '<a href="' + esc(l.href) + '" target="_blank" rel="noopener">&gt; ' + esc(l.label) + '</a>';
    }).join('');
  }

  /* ==========================================================
     EDUCATION — box-drawn terminal windows on a timeline
     ========================================================== */
  function buildEducation() {
    var host = $('#edu-list');
    host.innerHTML = '';
    S.education.forEach(function (e, i) {
      var item = document.createElement('article');
      item.className = 'edu-item';

      var spine = document.createElement('pre');
      spine.className = 'edu-spine';
      item.appendChild(spine);

      var win = document.createElement('pre');
      win.className = 'edu-win';
      item.appendChild(win);
      host.appendChild(item);

      var cols = Math.min(84, fitCols(win, 84, 30));
      var inner = cols - 2;
      var title = ' edu[' + i + '] ── ' + e.dates + ' ';
      if (title.length > inner) title = ' ' + e.dates + ' ';
      var lines = [];
      lines.push('┌' + title + rep('─', Math.max(0, inner - title.length)) + '┐');
      lines.push('│ ' + pad(e.degree, inner - 2) + ' │');
      lines.push('│ ' + pad(e.institution, inner - 2) + ' │');
      lines.push('├' + rep('─', inner) + '┤');
      wrap(e.note, inner - 2).forEach(function (l) {
        lines.push('│ ' + pad(l, inner - 2) + ' │');
      });
      lines.push('│ ' + pad('', inner - 2) + ' │');
      lines.push('│ ' + pad('coursework:', inner - 2) + ' │');
      e.coursework.forEach(function (c, k) {
        var mark = (k === e.coursework.length - 1) ? '  └─ ' : '  ├─ ';
        lines.push('│ ' + pad((mark + c).slice(0, inner - 2), inner - 2) + ' │');
      });
      lines.push('└' + rep('─', inner) + '┘');
      win.textContent = lines.join('\n');

      var sp = [];
      for (var k = 0; k < lines.length + 1; k++) sp.push(k === 0 ? '◆' : '│');
      spine.textContent = sp.join('\n');

      reveal(item, i * 90);
    });
  }

  /* ==========================================================
     EXPERIENCE
     ========================================================== */
  function buildExperience() {
    var host = $('#exp-list');
    host.innerHTML = '';
    S.experience.forEach(function (x, i) {
      var item = document.createElement('article');
      item.className = 'exp-item';

      var spine = document.createElement('pre');
      spine.className = 'exp-spine';
      spine.setAttribute('aria-hidden', 'true');
      spine.textContent = '●';

      var body = document.createElement('div');
      body.className = 'exp-body';

      var bannerPre = document.createElement('pre');
      bannerPre.className = 'banner banner-sm';
      bannerPre.setAttribute('aria-label', x.company);
      bannerPre.textContent = F.banner(x.company);
      bannerPre.dataset.fsMax = '10';

      var head = document.createElement('div');
      head.className = 'exp-head';
      head.innerHTML = '<span class="exp-role">' + esc(x.role) + '</span>' +
        '<span>│ ' + esc(x.dates) + '</span><span>│ ' + esc(x.location) + '</span>';

      var ul = document.createElement('ul');
      ul.className = 'exp-duty';
      ul.innerHTML = x.duties.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('');

      var stack = document.createElement('div');
      stack.className = 'exp-stack';
      stack.innerHTML = x.stack.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');

      body.appendChild(bannerPre);
      body.appendChild(head);
      body.appendChild(ul);
      body.appendChild(stack);
      item.appendChild(spine);
      item.appendChild(body);
      host.appendChild(item);
      reveal(item, i * 80);
    });
    fitSpines();
  }

  /* Draw each timeline connector to the exact height of its entry. */
  function fitSpines() {
    $$('.exp-item').forEach(function (item, i, all) {
      var spine = $('.exp-spine', item);
      var body = $('.exp-body', item);
      var lh = parseFloat(getComputedStyle(spine).lineHeight) || CH;
      var n = Math.max(2, Math.round(body.getBoundingClientRect().height / lh) - 1);
      var glyphs = ['●'];
      for (var k = 1; k < n; k++) glyphs.push('│');
      glyphs.push(i === all.length - 1 ? '╵' : '│');
      spine.textContent = glyphs.join('\n');
    });
  }

  function buildSkills() {
    var host = $('#skill-bars');
    host.innerHTML = '';
    var nameW = 0;
    S.skills.forEach(function (s) { nameW = Math.max(nameW, s.name.length); });
    S.skills.forEach(function (s, i) {
      var row = document.createElement('div');
      row.className = 'skill-row';
      row.innerHTML = '<span class="skill-name">' + esc(pad(s.name, nameW)) + '</span> ' +
        '<span class="skill-bar">[' + rep('░', 20) + ']</span> ' +
        '<span class="skill-pct">  0%</span>';
      host.appendChild(row);
      animateBar(row, s.value, i * 140);
    });
  }

  function animateBar(row, value, delay) {
    var bar = $('.skill-bar', row), pct = $('.skill-pct', row);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        setTimeout(function () {
          var start = performance.now(), dur = REDUCED ? 1 : 900;
          (function step(t) {
            var k = Math.min(1, (t - start) / dur);
            var v = Math.round(value * (1 - Math.pow(1 - k, 3)));
            var full = Math.round((v / 100) * 20);
            bar.textContent = '[' + rep('█', full) + rep('░', 20 - full) + ']';
            pct.textContent = rep(' ', 3 - String(v).length) + v + '%';
            if (k < 1) requestAnimationFrame(step);
          })(start);
        }, delay);
      });
    }, { threshold: 0.4 });
    io.observe(row);
  }

  /* ==========================================================
     PROJECT ICONS
     ========================================================== */
  var ICONS = {
    eye: [
      "   .-'''''-.   ",
      " .'  _____  '. ",
      "/  .'     '.  \\",
      "| |   ###   | |",
      "\\  '.  #  .'  /",
      " '.  '---'  .' ",
      "   '-.....-'   "
    ],
    scroll: [
      " ______________ ",
      "/\\             \\",
      "\\_| ~~~~~~~~~~ |",
      "  | ~~~~~~~~~~ |",
      "  | ~~~~~~~~~~ |",
      "  |   ________ |",
      "  \\__/_________/"
    ],
    tower: [
      "      /\\       ",
      "     /##\\      ",
      "    /####\\     ",
      "   |[]  []|    ",
      "   |  ##  |    ",
      "   |[]  []|    ",
      "  /________\\   "
    ],
    pen: [
      "         __/\\  ",
      "       _/  //  ",
      "     _/   //   ",
      "   _/    //    ",
      "  /\\    //     ",
      "  \\ \\  //      ",
      "   \\_\\//       "
    ],
    arch: [
      "     _____     ",
      "   /       \\   ",
      "  /  /~~~\\  \\  ",
      " |  |  o  |  | ",
      " |  |     |  | ",
      " |  |     |  | ",
      " |__|_____|__| "
    ],
    quill: [
      "          ,    ",
      "         /|    ",
      "        / |    ",
      "       /  |    ",
      "      /___|    ",
      "     //        ",
      "  ~~~          "
    ]
  };

  function buildProjects() {
    var grid = $('#proj-grid');
    grid.innerHTML = '';
    S.projects.forEach(function (p, i) {
      var card = document.createElement('article');
      card.className = 'proj-card';
      card.tabIndex = 0;

      var icon = document.createElement('pre');
      icon.className = 'proj-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = (ICONS[p.icon] || ICONS.scroll).join('\n');

      var title = document.createElement('pre');
      title.className = 'proj-title';
      title.setAttribute('aria-label', p.title);
      title.textContent = F.banner(p.title);
      title.dataset.fsMax = '9';

      var sub = document.createElement('p');
      sub.className = 'proj-sub';
      sub.textContent = '// ' + p.subtitle;

      var desc = document.createElement('p');
      desc.className = 'proj-desc';

      var tags = document.createElement('p');
      tags.className = 'proj-tags';
      tags.textContent = p.tags.map(function (t) { return '[' + t + ']'; }).join(' ');

      var links = document.createElement('nav');
      links.className = 'proj-links';
      links.innerHTML = p.links.map(function (l) {
        var ext = l.href.charAt(0) === '#' ? '' : ' target="_blank" rel="noopener"';
        return '<a href="' + esc(l.href) + '"' + ext + '>' + esc(l.cmd) + '</a>';
      }).join('');

      var chead = document.createElement('div');
      chead.className = 'proj-head';
      chead.appendChild(title);
      chead.appendChild(icon);

      card.appendChild(chead);
      card.appendChild(sub);
      card.appendChild(desc);
      card.appendChild(tags);
      card.appendChild(links);
      grid.appendChild(card);
      reveal(card, (i % 3) * 90);

      var typed = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting || typed) return;
          typed = true; io.disconnect();
          setTimeout(function () { typeInto(desc, p.desc, { speed: 9 }); }, 250 + (i % 3) * 200);
        });
      }, { threshold: 0.25 });
      io.observe(card);
    });
  }

  /* ==========================================================
     CONTEXT TERMINAL
     ========================================================== */
  var Term = (function () {
    var body, queue = [], busy = false;

    function line(text, cls) {
      var d = document.createElement('div');
      if (cls) d.className = cls;
      d.textContent = text;
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
      return d;
    }

    function typedLine(text, cls, speed) {
      return new Promise(function (res) {
        var d = line('', cls);
        typeInto(d, text, {
          speed: speed || 8,
          done: function () { body.scrollTop = body.scrollHeight; res(); }
        });
      });
    }

    function pump() {
      if (busy || !queue.length) return;
      busy = true;
      queue.shift()().then(function () { busy = false; pump(); });
    }
    function push(fn) { queue.push(fn); pump(); }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, REDUCED ? 0 : ms); }); }

    function outLines(arr, cls, speed) {
      var p = Promise.resolve();
      arr.forEach(function (l) {
        p = p.then(function () { return typedLine(l, cls, speed || 4); });
      });
      return p;
    }

    function output(cmd) {
      var c = S.context;
      var base = cmd.trim().toLowerCase();
      if (base === 'clear') { body.innerHTML = ''; return Promise.resolve(); }
      if (base === 'whoami') {
        return outLines([S.identity.name.toLowerCase().replace(/\s+/g, '.') + '  —  ' + S.identity.role, '']
          .concat(c.whoami), 'ln-hi');
      }
      if (base.indexOf('cat interests') === 0) {
        return outLines(c.interests.map(function (t, i) {
          return (i === c.interests.length - 1 ? ' └─ ' : ' ├─ ') + t;
        }), 'ln-hi');
      }
      if (base === './skills.sh' || base === 'skills') {
        return outLines(S.skills.map(function (s) {
          var full = Math.round(s.value / 5);
          return ' ' + pad(s.name, 18) + ' [' + rep('█', full) + rep('░', 20 - full) + '] ' + s.value + '%';
        }), 'ln-hi', 2);
      }
      if (base === 'neofetch' || base === 'specs') {
        return outLines(c.specs.map(function (kv) { return ' ' + pad(kv[0], 9) + ' : ' + kv[1]; }), 'ln-dim', 3);
      }
      if (base === 'now') {
        return outLines(c.now.map(function (t) { return ' * ' + t; }), 'ln-hi');
      }
      if (base === 'help') {
        return outLines([' whoami · cat interests.txt · ./skills.sh · neofetch · now · clear'], 'ln-dim');
      }
      return outLines([' bash: ' + cmd + ': command not found — try `help`'], 'ln-dim');
    }

    function run(cmd) {
      push(function () {
        return typedLine('amir@scriptorium:~$ ' + cmd, 'ln-cmd', 26)
          .then(function () { return sleep(120); })
          .then(function () { return output(cmd); })
          .then(function () { line(''); });
      });
    }

    function init() {
      body = $('#ctx-body');
      var started = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting || started) return;
          started = true; io.disconnect();
          run('whoami');
          run('cat interests.txt');
        });
      }, { threshold: 0.2 });
      io.observe($('#ctx-term'));

      $$('.cmd-chip').forEach(function (b) {
        b.addEventListener('click', function () {
          Snd.click(1400, 0.03);
          run(b.dataset.cmd);
          Particles.sparkleAt(b.getBoundingClientRect().left + 12, b.getBoundingClientRect().top, 5);
        });
      });
    }

    return { init: init, run: run };
  })();

  function buildSpecs() {
    var el = $('#specs');
    var cols = Math.min(48, fitCols(el, 48, 26));
    var inner = cols - 2;
    var lines = ['╔' + rep('═', inner) + '╗'];
    lines.push('║ ' + pad('SYSTEM SPECIFICATIONS', inner - 2) + ' ║');
    lines.push('╟' + rep('─', inner) + '╢');
    S.context.specs.forEach(function (kv) {
      lines.push('║ ' + pad((pad(kv[0], 8) + ' ' + kv[1]).slice(0, inner - 2), inner - 2) + ' ║');
    });
    lines.push('╟' + rep('─', inner) + '╢');
    lines.push('║ ' + pad('NOW', inner - 2) + ' ║');
    S.context.now.forEach(function (n) {
      wrap(n, inner - 5).forEach(function (l, i) {
        lines.push('║ ' + pad((i ? '   ' : ' ► ') + l, inner - 2) + ' ║');
      });
    });
    lines.push('╚' + rep('═', inner) + '╝');
    el.textContent = lines.join('\n');
  }

  /* ==========================================================
     GALLERY + LIGHTBOX
     ========================================================== */
  var Gal = (function () {
    var idx = 0;
    var lb, img, titleEl, metaEl, countEl, lastFocus;

    function center(s, w) {
      if (s.length >= w) s = s.slice(0, w);
      var l = Math.floor((w - s.length) / 2);
      return rep(' ', l) + s + rep(' ', w - s.length - l);
    }
    function frameArt(title) {
      var w = 26;
      return [
        '┌' + rep('─', w) + '┐',
        '│' + rep(' ', w) + '│',
        '│' + center('✦  ' + title + '  ✦', w) + '│',
        '│' + center('[ click to enlarge ]', w) + '│',
        '│' + rep(' ', w) + '│',
        '└' + rep('─', w) + '┘'
      ].join('\n');
    }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    function build() {
      var grid = $('#gal-grid');
      grid.innerHTML = '';
      S.gallery.forEach(function (a, i) {
        var b = document.createElement('button');
        b.className = 'gal-item';
        b.type = 'button';
        b.setAttribute('aria-label', 'Open ' + a.title);
        b.innerHTML =
          '<span class="gal-shot">' +
            '<img src="' + esc(a.src) + '" alt="' + esc(a.title) + ' — ' + esc(a.meta) + '" loading="lazy" decoding="async">' +
            '<pre class="gal-frame" aria-hidden="true">' + esc(frameArt(a.title)) + '</pre>' +
          '</span>' +
          '<span class="gal-cap"><span>' + esc(a.title) + '</span><span class="gal-idx">' + pad2(i + 1) + '</span></span>';
        b.addEventListener('click', function () { open(i); });
        grid.appendChild(b);
        reveal(b, (i % 3) * 80);
      });
    }

    function edges() {
      var shell = $('.lb-shell');
      if (!shell) return;
      var cols = Math.max(20, Math.floor(shell.clientWidth / (CW * 0.72)));
      $('#lb-top').textContent = '╔' + rep('═', cols - 2) + '╗';
      $('#lb-bot').textContent = '╚' + rep('═', cols - 2) + '╝';
      var midH = $('.lb-mid').clientHeight || 320;
      var h = Math.max(6, Math.floor(midH / (CH * 0.72)));
      var col = [];
      for (var i = 0; i < h; i++) col.push('║');
      $$('.lb-side').forEach(function (s) { s.textContent = col.join('\n'); });
    }

    function show(i) {
      var a = S.gallery[i];
      idx = i;
      img.style.opacity = 0;
      var next = new Image();
      next.onload = next.onerror = function () {
        img.src = a.src;
        img.alt = a.title + ' — ' + a.meta;
        img.style.transition = 'opacity .28s ease';
        img.style.opacity = 1;
        requestAnimationFrame(edges);
      };
      next.src = a.src;
      titleEl.textContent = F.banner(a.title);
      titleEl.setAttribute('aria-label', a.title);
      titleEl.dataset.fsMax = '9';
      fitBanner(titleEl);
      metaEl.textContent = a.meta;
      countEl.textContent = pad2(i + 1) + ' / ' + pad2(S.gallery.length);
    }

    function open(i) {
      lastFocus = document.activeElement;
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      show(i);
      requestAnimationFrame(edges);
      $('#lb-close').focus();
      Snd.click(900, 0.05);
    }
    function close() {
      lb.hidden = true;
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function step(d) {
      show((idx + d + S.gallery.length) % S.gallery.length);
      Snd.click(1300, 0.03);
    }

    function init() {
      lb = $('#lb'); img = $('#lb-img');
      titleEl = $('#lb-title'); metaEl = $('#lb-meta'); countEl = $('#lb-count');
      build();
      $('#lb-prev').addEventListener('click', function () { step(-1); });
      $('#lb-next').addEventListener('click', function () { step(1); });
      $('#lb-close').addEventListener('click', close);
      lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
      window.addEventListener('resize', function () { if (!lb.hidden) edges(); });
    }

    return { init: init, close: close, step: step, open: open, isOpen: function () { return lb && !lb.hidden; } };
  })();

  /* ==========================================================
     SCROLL PROGRESS + ACTIVE NAV
     ========================================================== */
  function initScroll() {
    var bar = $('#prog-bar'), pctEl = $('#prog-pct');
    var navLinks = $$('.nav a');
    var secs = navLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var ticking = false;

    function update() {
      ticking = false;
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
      var n = Math.round(p * 20);
      bar.textContent = '[' + rep('█', n) + rep('░', 20 - n) + ']';
      var v = Math.round(p * 100);
      pctEl.textContent = rep('0', 3 - String(v).length) + v + '%';

      var mid = h.scrollTop + h.clientHeight * 0.32;
      var active = -1;
      secs.forEach(function (s, i) { if (s && s.offsetTop <= mid) active = i; });
      navLinks.forEach(function (a, i) { a.classList.toggle('active', i === active); });
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
      Particles.scrollBurst();
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ==========================================================
     PARTICLES — cursor trail + scroll motes
     ========================================================== */
  var Particles = (function () {
    var cvs, ctx, list = [], w = 0, h = 0, dpr = 1;
    var TRAIL = '01/\\|<>*+.:-=~^`';
    var MOTE = ['.', '·', ':', '˙'];
    var lastX = 0, lastY = 0, lastEmit = 0, lastScroll = 0, prev = 0;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      cvs.width = w * dpr; cvs.height = h * dpr;
      cvs.style.width = w + 'px'; cvs.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function add(x, y, ch, vx, vy, life, size) {
      if (list.length > 300) list.shift();
      list.push({ x: x, y: y, ch: ch, vx: vx, vy: vy, t: 0, life: life, size: size || 13 });
    }

    function emit(x, y) {
      var now = performance.now();
      if (now - lastEmit < 26) return;
      lastEmit = now;
      var dx = x - lastX, dy = y - lastY;
      var sp = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 40);
      lastX = x; lastY = y;
      add(x, y, TRAIL[(Math.random() * TRAIL.length) | 0],
        (Math.random() - 0.5) * 0.4 - dx * 0.02,
        (Math.random() - 0.5) * 0.4 - dy * 0.02 + 0.12,
        480 + sp * 520, 12 + sp * 5);
    }

    function scrollBurst() {
      var now = performance.now();
      if (REDUCED || now - lastScroll < 90) return;
      lastScroll = now;
      for (var i = 0; i < 3; i++) {
        add(Math.random() * w, h * (0.15 + Math.random() * 0.8),
          MOTE[(Math.random() * MOTE.length) | 0],
          (Math.random() - 0.5) * 0.25, -0.5 - Math.random() * 0.9,
          900 + Math.random() * 700, 10 + Math.random() * 4);
      }
    }

    function sparkleAt(x, y, n) {
      if (REDUCED) return;
      var chars = ['✦', '✧', '⋆'];
      for (var i = 0; i < (n || 4); i++) {
        var s = document.createElement('span');
        s.className = 'sparkle';
        s.textContent = chars[(Math.random() * 3) | 0];
        s.style.left = x + 'px';
        s.style.top = y + 'px';
        s.style.setProperty('--dx', ((Math.random() - 0.5) * 46).toFixed(1) + 'px');
        s.style.setProperty('--dy', (-18 - Math.random() * 34).toFixed(1) + 'px');
        document.body.appendChild(s);
        (function (node) { setTimeout(function () { node.remove(); }, 780); })(s);
      }
    }

    function frame(ts) {
      requestAnimationFrame(frame);
      var dt = Math.min(48, ts - prev); prev = ts;
      if (!list.length) { ctx.clearRect(0, 0, w, h); return; }
      ctx.clearRect(0, 0, w, h);
      var col = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#00ff41';
      ctx.textBaseline = 'middle';
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.t += dt;
        if (p.t >= p.life) { list.splice(i, 1); continue; }
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;
        var a = 1 - p.t / p.life;
        ctx.globalAlpha = a * a * 0.75;
        ctx.fillStyle = col;
        ctx.font = p.size + 'px ui-monospace, monospace';
        ctx.fillText(p.ch, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    }

    function init() {
      cvs = $('#trail');
      ctx = cvs.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
      if (!REDUCED && window.matchMedia('(pointer:fine)').matches) {
        window.addEventListener('mousemove', function (e) { emit(e.clientX, e.clientY); }, { passive: true });
      }
      requestAnimationFrame(frame);
    }

    return { init: init, scrollBurst: scrollBurst, sparkleAt: sparkleAt };
  })();

  function armSparkles() {
    if (REDUCED) return;
    var sel = '.nav a, .proj-card, .gal-item, .cmd-chip, .hero-links a, .tbtn, .proj-links a';
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest ? e.target.closest(sel) : null;
      if (!t || t.dataset.sparkling) return;
      t.dataset.sparkling = '1';
      setTimeout(function () { delete t.dataset.sparkling; }, 420);
      var r = t.getBoundingClientRect();
      Particles.sparkleAt(r.left + r.width * (0.2 + Math.random() * 0.6), r.top + 4, 3);
      Snd.click(1750, 0.02, 0.018);
    });
  }

  /* ==========================================================
     THEME + SOUND
     ========================================================== */
  function setTheme(force) {
    var root = document.documentElement;
    var next = force || (root.dataset.theme === 'green' ? 'amber' : 'green');
    root.dataset.theme = next;
    $('#btn-theme').textContent = next === 'green' ? '[ amber ]' : '[ green ]';
    try { localStorage.setItem('ascii-theme', next); } catch (err) {}
  }
  function toggleSound() {
    var on = Snd.toggle();
    var b = $('#btn-sound');
    b.textContent = on ? '[ snd:on ]' : '[ snd:off ]';
    b.setAttribute('aria-pressed', String(on));
    if (on) Snd.click(1200, 0.05);
    return on;
  }

  /* ==========================================================
     COMMAND BAR
     ========================================================== */
  function initCmd() {
    var input = $('#cmd-input'), out = $('#cmd-out');
    var history = [], hi = -1;
    var SECTIONS = ['home', 'education', 'experience', 'projects', 'context', 'gallery'];
    var ALIAS = { work: 'experience', about: 'context', art: 'gallery', top: 'home', me: 'context' };

    function say(msg) {
      out.textContent = msg;
      clearTimeout(say._t);
      say._t = setTimeout(function () { out.textContent = ''; }, 4600);
    }

    function go(name) {
      name = ALIAS[name] || name;
      var el = document.getElementById(name);
      if (!el) { say('no such section: ' + name); return false; }
      el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      el.focus({ preventScroll: true });
      say('→ ' + name);
      return true;
    }

    function exec(raw) {
      var line = raw.trim();
      if (!line) return;
      history.unshift(line); hi = -1;
      var parts = line.split(/\s+/);
      var cmd = parts[0].toLowerCase().replace(/:$/, '');
      var arg = (parts[1] || '').toLowerCase().replace(/^\[|\]$/g, '');

      switch (cmd) {
        case 'help': case '?':
          say('goto <section> · ls · whoami · skills · cat · theme · sound · mary · clear · sudo'); break;
        case 'ls': case 'dir':
          say(SECTIONS.join('  ')); break;
        case 'goto': case 'cd': case 'navigate_to': case 'open': case 'nav':
          go(arg || 'home'); break;
        case 'whoami': case 'neofetch': case 'now':
          if (go('context')) Term.run(cmd); break;
        case 'skills':
          if (go('context')) Term.run('./skills.sh'); break;
        case 'cat':
          if (go('context')) Term.run('cat ' + (parts[1] || 'interests.txt')); break;
        case 'theme':
          setTheme(arg === 'amber' || arg === 'green' ? arg : null);
          say('phosphor: ' + document.documentElement.dataset.theme); break;
        case 'sound': case 'snd':
          say('sound: ' + (toggleSound() ? 'on' : 'off')); break;
        case 'mary': case 'bg':
          window.MaryBG.next();
          say('background: pose ' + (window.MaryBG.index() + 1) + ' / ' + window.MaryBG.count()); break;
        case 'art': case 'gallery':
          go('gallery'); break;
        case 'contact': case 'mail':
          say(S.identity.email); window.location.href = 'mailto:' + S.identity.email; break;
        case 'clear':
          out.textContent = ''; break;
        case 'sudo':
          say('you are not in the sudoers file. this incident has been illuminated.'); break;
        case 'date':
          say(new Date().toString()); break;
        case 'konami':
          say('↑ ↑ ↓ ↓ ← → ← → B A'); break;
        default:
          if (SECTIONS.indexOf(cmd) >= 0 || ALIAS[cmd]) { go(cmd); break; }
          say('command not found: ' + cmd + ' — try `help`');
      }
    }

    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { exec(input.value); input.value = ''; Snd.click(700, 0.05); }
      else if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); hi = Math.min(hi + 1, history.length - 1); input.value = history[hi]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.max(hi - 1, -1); input.value = hi < 0 ? '' : history[hi]; }
      else if (e.key === 'Escape') { input.blur(); }
      else Snd.click(1500 + Math.random() * 400, 0.02, 0.016);
    });
  }

  /* ==========================================================
     KONAMI — animated rose window
     ========================================================== */
  var Konami = (function () {
    var seq = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    var pos = 0, timer = null, raf = 0;

    function key(e) {
      var k = e.key.toLowerCase();
      if (k === seq[pos]) { pos++; if (pos === seq.length) { pos = 0; fire(); } }
      else pos = (k === seq[0]) ? 1 : 0;
    }

    function mandala(t, cols, rows) {
      var RAMP = ' .:-=+*#%@';
      var out = [], aspect = 2.05;
      for (var y = 0; y < rows; y++) {
        var row = '';
        for (var x = 0; x < cols; x++) {
          var nx = (x - cols / 2) / (rows / 2) / aspect;
          var ny = (y - rows / 2) / (rows / 2);
          var r = Math.sqrt(nx * nx + ny * ny);
          var a = Math.atan2(ny, nx);
          var v =
            Math.cos(a * 12 + t * 0.9) * 0.5 * Math.exp(-Math.pow(r - 0.62, 2) * 26) +
            Math.cos(a * 6 - t * 0.6) * 0.6 * Math.exp(-Math.pow(r - 0.38, 2) * 40) +
            Math.exp(-Math.pow(r - 0.14, 2) * 90) * (0.6 + 0.4 * Math.sin(t * 2)) +
            Math.exp(-Math.pow(r - 0.86, 2) * 120) * 0.5 * (0.5 + 0.5 * Math.cos(a * 24 + t));
          v = Math.max(0, Math.min(1, v * 1.1));
          row += v < 0.05 ? ' ' : RAMP[Math.min(9, (v * 9) | 0)];
        }
        out.push(row);
      }
      return out.join('\n');
    }

    function fire() {
      var box = $('#konami'), art = $('#konami-art'), cap = $('#konami-cap');
      if (!box.hidden) return;
      box.hidden = false;
      document.body.classList.add('konami-on');
      cap.textContent = 'ora pro nobis · rose window unlocked';
      Snd.click(520, 0.4, 0.05);

      var start = performance.now();
      var cols = Math.min(150, Math.max(40, Math.floor(window.innerWidth / 9)));
      var rows = Math.min(64, Math.max(20, Math.floor(window.innerHeight / 16)));
      (function loop(ts) {
        var t = (ts - start) / 1000;
        art.textContent = mandala(t, cols, rows);
        if (t < 9) raf = requestAnimationFrame(loop);
        else stop();
      })(start);

      clearTimeout(timer);
      timer = setTimeout(stop, 9800);
      box.addEventListener('click', stop, { once: true });
    }

    function stop() {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      var box = $('#konami');
      if (box) box.hidden = true;
      document.body.classList.remove('konami-on');
    }

    return { key: key, stop: stop };
  })();

  /* ==========================================================
     GLOBAL KEYBOARD
     ========================================================== */
  function initKeys() {
    var order = ['home', 'education', 'experience', 'projects', 'context', 'gallery'];
    function currentSection() {
      var mid = window.scrollY + window.innerHeight * 0.35, best = 0;
      order.forEach(function (id, i) {
        var el = document.getElementById(id);
        if (el && el.offsetTop <= mid) best = i;
      });
      return best;
    }
    function jump(d) {
      var i = Math.max(0, Math.min(order.length - 1, currentSection() + d));
      var el = document.getElementById(order[i]);
      el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      el.focus({ preventScroll: true });
    }

    document.addEventListener('keydown', function (e) {
      Konami.key(e);
      var typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);

      if (Gal.isOpen()) {
        if (e.key === 'Escape') { Gal.close(); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { Gal.step(-1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { Gal.step(1); e.preventDefault(); }
        return;
      }
      if (typing) return;

      if (e.key === '/') { e.preventDefault(); $('#cmd-input').focus(); return; }
      if (e.key === 'Escape') { Konami.stop(); return; }
      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'PageDown') { e.preventDefault(); jump(1); }
      else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'PageUp') { e.preventDefault(); jump(-1); }
      else if (e.key === 'g') { jump(-99); }
      else if (e.key === 'G') { jump(99); }
      else if (e.key === 't') { setTheme(); }
      else if (e.key === 'm') { window.MaryBG.next(); }
    });
  }

  /* ==========================================================
     BOOT SEQUENCE
     ========================================================== */
  function boot(done) {
    var el = $('#boot'), log = $('#boot-log'), skip = $('#boot-skip');
    var seed = [
      'SCRIPTORIUM BIOS v3.14 — 640K conventional memory OK',
      'detecting phosphor .............. P1 GREEN',
      'mounting /dev/vellum ............ OK',
      'loading glyph tables ............ 96 ascii + 44 box',
      'rasterising saint mary .......... 6 poses',
      'calibrating cross-hatch ......... sobel / 4-way',
      'starting scanline generator ..... 60 Hz',
      '',
      'ready.'
    ];
    var i = 0, out = '', finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      el.classList.add('done');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 560);
      done();
    }

    if (REDUCED) {
      log.textContent = seed.join('\n');
      setTimeout(finish, 400);
    } else {
      (function step() {
        if (finished) return;
        if (i >= seed.length) { setTimeout(finish, 520); return; }
        out += (out ? '\n' : '') + '> ' + seed[i++];
        log.textContent = out;
        Snd.click(1600, 0.02, 0.018);
        setTimeout(step, 105 + Math.random() * 120);
      })();
    }
    skip.addEventListener('click', finish);
    el.addEventListener('click', finish);
    window.addEventListener('keydown', finish, { once: true });
  }

  /* ==========================================================
     FOOTER
     ========================================================== */
  function buildFooter() {
    var t = $('#ftr-txt');
    var msgs = [
      'thanks for reading — mail me: ' + S.identity.email,
      'built by hand, in a text editor, with too much coffee',
      'every mark on this page is a character, except the art',
      'press / to focus the command bar'
    ];
    var m = 0;
    function cycle() {
      typeInto(t, msgs[m % msgs.length], {
        speed: 26,
        done: function () { setTimeout(function () { m++; cycle(); }, 4200); }
      });
    }
    var io = new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) { io.disconnect(); cycle(); }
    }, { threshold: 0.25 });
    io.observe($('.ftr'));
  }

  /* ==========================================================
     INIT
     ========================================================== */
  function buildResponsive() {
    measure();
    paintBanners();
    buildHero();
    buildEducation();
    buildSpecs();
    requestAnimationFrame(function () { fitBanners(); fitSpines(); });
  }

  function ready() {
    try {
      var saved = localStorage.getItem('ascii-theme');
      if (saved) document.documentElement.dataset.theme = saved;
    } catch (err) {}
    $('#btn-theme').textContent = document.documentElement.dataset.theme === 'green' ? '[ amber ]' : '[ green ]';

    window.MaryBG.init();

    buildResponsive();
    buildExperience();
    buildSkills();
    buildProjects();
    requestAnimationFrame(function () { fitBanners(); fitSpines(); });
    Gal.init();
    Term.init();
    buildFooter();

    initScroll();
    initCmd();
    initKeys();
    Particles.init();
    armSparkles();

    $('#btn-theme').addEventListener('click', function () { setTheme(); Snd.click(880, 0.06); });
    $('#btn-sound').addEventListener('click', toggleSound);

    $$('.nav a, .hdr-brand').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id && id.charAt(0) === '#') {
          e.preventDefault();
          var el = document.querySelector(id);
          if (el) {
            el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
            el.focus({ preventScroll: true });
            history.replaceState(null, '', id);
          }
        }
        Snd.click(1000, 0.04);
      });
    });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(buildResponsive, 200);
    });

    $('#ftr-chars').textContent = '8,400+';

    boot(armTypewriters);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
