/* =============================================================
   shell.js — the interactive terminal                window.Shell
   -------------------------------------------------------------
   A real prompt: type into it, or press a chip. History on the
   arrows, tab completion, ghosted suggestion, block cursor.

   The <input> is transparent and a mirror <span> draws the text,
   so the caret can be a block glyph that inverts the character
   under it — a caret-color caret cannot do that, and a
   contenteditable would cost selection and IME handling.

   Section commands do not render anything themselves; they call
   back into main.js, which drives the stage and the deck.
   ============================================================= */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var S, out, input, mirror, form, chips;
  var hooks = {};
  var history = [], hIdx = -1, draft = '';
  var queue = [], busy = false;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function pad(s, n) {
    s = String(s);
    return s + (n > s.length ? new Array(n - s.length + 1).join(' ') : '');
  }

  var MASCOT = [
    '╭───────────────────╮',
    '│                   │',
    '│   ▄▄▄▄     ▄▄▄▄   │',
    '│  █ ●● █   █ ●● █  │',
    '│   ▀▀▀▀     ▀▀▀▀   │',
    '│                   │',
    '│      ╰─────╯      │',
    '│                   │',
    '╰───────────────────╯'
  ];

  /* ==========================================================
     OUTPUT
     ========================================================== */
  function el(html, cls) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = html;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
    return d;
  }
  function line(text, cls) { return el(esc(text), cls); }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, REDUCED ? 0 : ms); });
  }

  /* The echoed command types out; output lines are revealed in a
     quick stagger. Typing every output character looks fussy and
     makes `neofetch` take four seconds. */
  function typeCmd(cmd) {
    return new Promise(function (res) {
      var d = el('<span class="ln-ps">amir@kanso</span>:<span class="ln-key">~</span>$ <span></span>', 'ln-cmd');
      var span = d.querySelector('span:last-child');
      if (REDUCED) { span.textContent = cmd; res(); return; }
      var i = 0;
      (function step() {
        span.textContent = cmd.slice(0, ++i);
        out.scrollTop = out.scrollHeight;
        if (i < cmd.length) setTimeout(step, 16 + Math.random() * 22);
        else setTimeout(res, 90);
      })();
    });
  }

  function emit(lines, cls) {
    var p = Promise.resolve();
    lines.forEach(function (l, i) {
      p = p.then(function () {
        if (typeof l === 'string') line(l, cls || 'ln-out');
        else el(l.html, l.cls || cls || 'ln-out');
        return i % 3 === 2 ? sleep(14) : null;
      });
    });
    return p;
  }

  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    queue.shift()().then(function () { busy = false; pump(); });
  }
  function push(fn) { queue.push(fn); pump(); }

  /* ==========================================================
     COMMANDS
     ========================================================== */
  var SECTIONS = ['education', 'work', 'projects', 'creations'];
  var ALIAS = {
    edu: 'education', school: 'education', degrees: 'education',
    jobs: 'work', experience: 'work', career: 'work', xp: 'work',
    proj: 'projects', src: 'projects', code: 'projects',
    creation: 'creations', personal: 'creations', art: 'creations',
    pix: 'creations', made: 'creations',
    fetch: 'neofetch', ff: 'neofetch',
    about: 'whoami', me: 'whoami', who: 'whoami',
    cls: 'clear', reset: 'clear',
    '?': 'help', man: 'help'
  };

  var VERBS = ['help', 'whoami', 'neofetch', 'clear', 'ls', 'cd', 'now',
    'interests', 'skills', 'contact', 'theme', 'echo', 'date', 'history',
    'sudo', 'exit'];

  function names() { return VERBS.concat(SECTIONS); }

  /* `cd work`, `work`, `open work`, `./work` all mean the same. */
  function resolve(raw) {
    var s = raw.trim().toLowerCase().replace(/^\.\//, '').replace(/^~\//, '');
    s = s.replace(/\.(txt|sh|md)$/, '');
    if (ALIAS[s]) s = ALIAS[s];
    return s;
  }

  function help() {
    return [
      { html: '<span class="ln-hi">sections</span>  ' +
              SECTIONS.map(function (s) { return '<span class="ln-key">' + s + '</span>'; }).join('  ') +
              '   <span class="ln-out">(or: cd work)</span>' },
      { html: '<span class="ln-hi">info</span>      <span class="ln-key">whoami</span>  ' +
              '<span class="ln-key">neofetch</span>  <span class="ln-key">skills</span>  ' +
              '<span class="ln-key">interests</span>  <span class="ln-key">now</span>  ' +
              '<span class="ln-key">contact</span>' },
      { html: '<span class="ln-hi">shell</span>     <span class="ln-key">ls</span>  ' +
              '<span class="ln-key">clear</span>  <span class="ln-key">theme</span>  ' +
              '<span class="ln-key">history</span>  <span class="ln-key">date</span>' },
      '',
      { html: '<span class="ln-out">tab completes · ↑↓ history · esc clears the deck</span>' }
    ];
  }

  function neofetch() {
    var rows = [], i;
    var kv = S.fetch;
    var head = S.identity.user + '@' + S.identity.host;
    var lines = [
      '<b>' + esc(head) + '</b>',
      esc(new Array(head.length + 1).join('-'))
    ];
    for (i = 0; i < kv.length; i++) {
      lines.push('<b>' + esc(pad(kv[i][0], 7)) + '</b> ' + esc(kv[i][1]));
    }
    lines.push('');
    lines.push('<span class="ln-hi">' + '███'.repeat(1) + '</span>' +
      ['--accent', '--accent2', '--ok', '--warn', '--err', '--fg'].map(function () { return ''; }).join(''));

    var swatch = '<span style="color:var(--err)">███</span>' +
                 '<span style="color:var(--warn)">███</span>' +
                 '<span style="color:var(--ok)">███</span>' +
                 '<span style="color:var(--accent2)">███</span>' +
                 '<span style="color:var(--accent)">███</span>' +
                 '<span style="color:var(--fg)">███</span>';
    lines[lines.length - 1] = swatch;

    rows.push({
      html: '<div class="fetch">' +
        '<pre class="fetch-art">' + esc(MASCOT.join('\n')) + '</pre>' +
        '<div class="fetch-kv">' + lines.join('<br>') + '</div>' +
        '</div>',
      cls: 'ln-out'
    });
    return rows;
  }

  function ls() {
    return [{
      html: SECTIONS.map(function (s) {
        return '<span class="ln-key">' + s + '/</span>';
      }).join('  ') + '  <span class="ln-out">readme.md  dotfiles/</span>'
    }];
  }

  function skills() {
    var bars = [], list = S.sections.work.cards[S.sections.work.cards.length - 1].bars || [];
    var w = 0;
    list.forEach(function (b) { w = Math.max(w, b.name.length); });
    list.forEach(function (b) {
      var f = Math.round(b.value / 5);
      bars.push({
        html: esc(pad(b.name, w)) + '  <span class="ln-hi">' +
          new Array(f + 1).join('█') + '</span><span class="ln-out">' +
          new Array(20 - f + 1).join('█') + '</span> ' + b.value + '%'
      });
    });
    return bars;
  }

  /* Returns a promise; `handled` tells the caller a section opened. */
  function run(raw) {
    var argv = raw.trim().split(/\s+/);
    var cmd = resolve(argv[0] || '');
    var rest = argv.slice(1).join(' ');

    /* `cd work` / `open work` — the target is what matters */
    if (cmd === 'cd' || cmd === 'open' || cmd === 'goto') {
      var t = resolve(rest || '');
      if (!rest || t === '~' || t === '..' || t === '/') { hooks.section(null); return emit(['']); }
      cmd = t;
    }

    if (SECTIONS.indexOf(cmd) >= 0) {
      var sec = S.sections[cmd];
      hooks.section(cmd);
      return emit([{
        html: '<span class="ln-ok">▸</span> ' + esc(sec.title.toLowerCase()) +
              ' — <span class="ln-out">' + esc(sec.cards.length + ' cards, scroll sideways') + '</span>'
      }]);
    }

    switch (cmd) {
      case '': return Promise.resolve();
      case 'help': return emit(help());
      case 'whoami': return emit(S.whoami, 'ln-out');
      case 'neofetch': return emit(neofetch());
      case 'ls': return emit(ls());
      case 'interests':
        return emit(S.interests.map(function (t, i) {
          return (i === S.interests.length - 1 ? ' └─ ' : ' ├─ ') + t;
        }), 'ln-out');
      case 'skills': return emit(skills());
      case 'now':
        return emit(S.now.map(function (t) { return ' ▸ ' + t; }), 'ln-hi');
      case 'contact':
        return emit(S.identity.links.map(function (l) {
          return { html: ' <span class="ln-key">' + esc(pad(l.label, 9)) + '</span> ' +
            '<a href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.href) + '</a>' };
        }));
      case 'clear':
        out.innerHTML = '';
        hooks.section(null);
        return Promise.resolve();
      case 'theme':
        return emit([{ html: '<span class="ln-ok">✓</span> ' + esc(hooks.theme(rest)) }]);
      case 'date':
        return emit([new Date().toString()], 'ln-out');
      case 'echo':
        return emit([rest], 'ln-out');
      case 'history':
        return emit(history.map(function (h, i) {
          return ' ' + pad(String(i + 1), 4) + h;
        }), 'ln-out');
      case 'sudo':
        return emit(['amir is not in the sudoers file. This incident has been reported.'], 'ln-err');
      case 'exit':
        return emit(['there is no exit. there is only the rice.'], 'ln-warn');
      default:
        return emit([{
          html: 'zsh: command not found: <span class="ln-err">' + esc(argv[0]) + '</span>' +
            '  <span class="ln-out">— try `help`</span>'
        }]);
    }
  }

  function exec(raw) {
    if (raw.trim()) {
      history.push(raw.trim());
      if (history.length > 60) history.shift();
    }
    hIdx = -1; draft = '';
    push(function () {
      return typeCmd(raw)
        .then(function () { return run(raw); })
        .then(function () {
          if (resolve(raw.trim().split(/\s+/)[0]) !== 'clear') line('');
          out.scrollTop = out.scrollHeight;
        });
    });
  }

  /* ==========================================================
     INPUT — mirror, block caret, ghost completion
     ========================================================== */
  function complete(value) {
    var v = value.toLowerCase();
    if (!v || /\s/.test(v)) return '';
    var all = names().concat(Object.keys(ALIAS));
    for (var i = 0; i < all.length; i++) {
      if (all[i].indexOf(v) === 0 && all[i] !== v) return all[i].slice(v.length);
    }
    return '';
  }

  function paint() {
    var v = input.value;
    var pos = input.selectionStart == null ? v.length : input.selectionStart;
    var before = esc(v.slice(0, pos));
    var at = v.charAt(pos);
    var after = esc(v.slice(pos + 1));
    var ghost = pos === v.length ? complete(v) : '';
    mirror.innerHTML = before +
      '<span class="cursor">' + (at ? esc(at) : ' ') + '</span>' +
      after + (ghost ? '<span class="ghost">' + esc(ghost) + '</span>' : '');
  }

  function setValue(v) {
    input.value = v;
    paint();
  }

  function onKey(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      if (hIdx === -1) { draft = input.value; hIdx = history.length; }
      hIdx = Math.max(0, hIdx - 1);
      setValue(history[hIdx]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIdx === -1) return;
      hIdx++;
      if (hIdx >= history.length) { hIdx = -1; setValue(draft); }
      else setValue(history[hIdx]);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      var g = complete(input.value);
      if (g) { setValue(input.value + g); hooks.click(1500); }
      return;
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      out.innerHTML = '';
      return;
    }
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      line('^C', 'ln-err');
      setValue('');
      return;
    }
    hooks.click(1200 + Math.random() * 400);
    setTimeout(paint, 0);
  }

  /* ==========================================================
     CHIPS
     ========================================================== */
  var CHIPS = [
    { cmd: 'whoami' },
    { cmd: 'neofetch' },
    { cmd: 'education', sec: true },
    { cmd: 'work', sec: true },
    { cmd: 'projects', sec: true },
    { cmd: 'creations', sec: true, label: 'personal creations' },
    { cmd: 'skills' },
    { cmd: 'clear' }
  ];

  function buildChips() {
    chips.innerHTML = '';
    CHIPS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (c.sec ? ' chip-sec' : '');
      b.textContent = c.label || c.cmd;
      b.dataset.cmd = c.cmd;
      b.addEventListener('click', function () {
        hooks.click(1500);
        exec(c.cmd);
        input.focus();
      });
      chips.appendChild(b);
    });
  }

  function markChips(key) {
    Array.prototype.forEach.call(chips.children, function (b) {
      b.classList.toggle('on', !!key && b.dataset.cmd === key);
    });
  }

  /* ==========================================================
     PUBLIC
     ========================================================== */
  window.Shell = {
    init: function (opts) {
      S = window.SITE;
      hooks = {
        section: (opts && opts.onSection) || function () {},
        theme: (opts && opts.onTheme) || function () { return 'no themes here'; },
        click: (opts && opts.onKey) || function () {}
      };

      out = document.getElementById('term-out');
      input = document.getElementById('term-in');
      mirror = document.getElementById('term-mirror');
      form = document.getElementById('term-form');
      chips = document.getElementById('term-btns');

      buildChips();
      paint();

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = input.value;
        setValue('');
        exec(v);
      });
      input.addEventListener('keydown', onKey);
      input.addEventListener('input', paint);
      input.addEventListener('click', paint);
      input.addEventListener('focus', paint);
      input.addEventListener('blur', paint);
      document.querySelector('.ps1').addEventListener('click', function () { input.focus(); });
    },

    greet: function () {
      push(function () {
        return emit(S.motd.map(function (m, i) {
          return { html: (i ? '  ' : '<span class="ln-ok">▸</span> ') + esc(m), cls: i ? 'ln-out' : 'ln-hi' };
        })).then(function () { line(''); });
      });
    },

    run: exec,
    focus: function () { input && input.focus(); },
    mark: markChips,
    clear: function () { out.innerHTML = ''; }
  };
})();
