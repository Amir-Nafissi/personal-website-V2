/* =============================================================
   deck.js — the horizontal card rail                window.Deck
   -------------------------------------------------------------
   Cards for a section lay out left to right and the wheel drives
   them sideways.

   The rail is a real overflow-x container rather than a
   transformed strip, so trackpad swipes, touch drags, keyboard
   focus and scroll-snap all work for free. On top of that, a
   wheel listener folds deltaY into a target scrollLeft which a
   rAF loop eases toward — native horizontal input stays native,
   and a vertical wheel gets weight instead of teleporting.
   ============================================================= */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var rail, deck, pathEl, blurbEl, countEl, progEl;
  var target = 0, cur = 0, gliding = false, raf = 0;
  var current = null;          /* the open section key */
  var arts = [];               /* cards carrying an image, for the lightbox */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function rep(s, n) { return n > 0 ? new Array(n + 1).join(s) : ''; }

  /* ---- eased horizontal scrolling -------------------------- */
  function glide() {
    raf = 0;
    var d = target - cur;
    if (Math.abs(d) < 0.6) {
      cur = target;
      rail.scrollLeft = cur;
      gliding = false;
      progress();
      return;
    }
    cur += d * 0.18;
    rail.scrollLeft = cur;
    progress();
    raf = requestAnimationFrame(glide);
  }

  function nudge(dx) {
    var max = rail.scrollWidth - rail.clientWidth;
    if (!gliding) { cur = rail.scrollLeft; gliding = true; }
    target = Math.max(0, Math.min(max, target + dx));
    if (!raf) raf = requestAnimationFrame(glide);
  }

  function onWheel(e) {
    /* A horizontal wheel is already what the rail wants — let the
       browser have it. Only a vertical wheel needs redirecting. */
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { syncFromNative(); return; }
    var max = rail.scrollWidth - rail.clientWidth;
    if (max <= 0) return;
    e.preventDefault();
    var d = e.deltaY * (e.deltaMode === 1 ? 18 : 1);
    if (REDUCED) {
      rail.scrollLeft += d;
      target = cur = rail.scrollLeft;
      progress();
      return;
    }
    nudge(d);
  }

  function syncFromNative() {
    if (gliding) return;
    cur = target = rail.scrollLeft;
    progress();
  }

  function progress() {
    var max = rail.scrollWidth - rail.clientWidth;
    var p = max > 0 ? rail.scrollLeft / max : 0;
    if (progEl) progEl.style.width = (p * 100).toFixed(1) + '%';
  }

  /* ---- card building --------------------------------------- */
  function bars(list) {
    var w = 0, out = [];
    list.forEach(function (b) { w = Math.max(w, b.name.length); });
    list.forEach(function (b) {
      var full = Math.round(b.value / 5);
      out.push('<div><b>' + esc(b.name) + rep('&nbsp;', w - b.name.length) + '</b>  ' +
        '<i>' + rep('█', full) + '</i><u>' + rep('█', 20 - full) + '</u> ' +
        b.value + '%</div>');
    });
    return '<div class="card-bars">' + out.join('') + '</div>';
  }

  function build(card, i) {
    var el = document.createElement('article');
    el.className = 'card' + (card.art ? ' card-art' : '');
    el.setAttribute('role', 'listitem');

    var bar = '<div class="card-bar">' +
      '<span class="card-i">' + (card.art ? '▣' : '▸') + '</span>' +
      (card.badge ? '<span class="card-badge">' + esc(card.badge) + '</span>' : '') +
      '<span class="card-meta">' + esc(card.meta || '') + '</span>' +
      '</div>';

    if (card.art) {
      el.innerHTML = bar +
        '<figure class="card-figure" tabindex="0" role="button" aria-label="Open ' + esc(card.head) + '">' +
        '<img src="' + esc(card.art) + '" alt="' + esc(card.head) + '" loading="lazy">' +
        '<figcaption class="card-cap"><b>' + esc(card.head) + '</b> — ' + esc(card.sub || '') + '</figcaption>' +
        '</figure>';
      var idx = arts.length;
      arts.push({ src: card.art, title: card.head, meta: (card.sub || '') + ' · ' + (card.meta || '') });
      var fig = el.querySelector('.card-figure');
      fig.addEventListener('click', function () { window.Deck.openArt(idx); });
      fig.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.Deck.openArt(idx); }
      });
    } else {
      var b = '<div class="card-body">';
      b += '<div class="card-head">' + esc(card.head) + '</div>';
      if (card.sub) b += '<div class="card-sub">' + esc(card.sub) + '</div>';
      (card.body || []).forEach(function (p) {
        b += '<p class="card-p">' + esc(p) + '</p>';
      });
      if (card.list) {
        b += '<ul class="card-list">' + card.list.map(function (l) {
          return '<li>' + esc(l) + '</li>';
        }).join('') + '</ul>';
      }
      if (card.bars) b += bars(card.bars);
      if (card.tags) {
        b += '<div class="card-tags">' + card.tags.map(function (t) {
          return '<span>' + esc(t) + '</span>';
        }).join('') + '</div>';
      }
      if (card.links) {
        b += '<div class="card-links">' + card.links.map(function (l) {
          var ext = /^https?:/.test(l.href);
          return '<a href="' + esc(l.href) + '"' +
            (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l.label) + ' ▸</a>';
        }).join('') + '</div>';
      }
      b += '</div>';
      el.innerHTML = bar + b;
    }

    /* staggered entry, capped so a long deck does not crawl in */
    setTimeout(function () { el.classList.add('in'); },
      REDUCED ? 0 : 90 + Math.min(i, 7) * 55);
    return el;
  }

  /* ---- public ---------------------------------------------- */
  function open(key) {
    var sec = window.SITE.sections[key];
    if (!sec) return false;

    if (current === key) { return true; }
    current = key;
    arts = [];

    rail.innerHTML = '';
    sec.cards.forEach(function (c, i) { rail.appendChild(build(c, i)); });

    pathEl.textContent = sec.path;
    blurbEl.textContent = '— ' + sec.blurb;
    countEl.textContent = sec.cards.length + ' item' + (sec.cards.length === 1 ? '' : 's');

    rail.scrollLeft = 0;
    cur = target = 0;
    gliding = false;
    progress();

    deck.setAttribute('aria-hidden', 'false');
    return true;
  }

  function close() {
    current = null;
    deck.setAttribute('aria-hidden', 'true');
    /* Emptying immediately would collapse the rail mid-slide, so
       wait out the transition first. */
    setTimeout(function () {
      if (current === null) { rail.innerHTML = ''; arts = []; }
    }, REDUCED ? 0 : 700);
  }

  function step(dir) {
    var card = rail.querySelector('.card');
    var w = card ? card.getBoundingClientRect().width + 14 : 300;
    nudge(dir * w);
  }

  window.Deck = {
    init: function () {
      deck = document.getElementById('deck');
      rail = document.getElementById('rail');
      pathEl = document.getElementById('deck-path');
      blurbEl = document.getElementById('deck-blurb');
      countEl = document.getElementById('deck-count');
      progEl = document.getElementById('deck-prog-i');

      rail.addEventListener('wheel', onWheel, { passive: false });
      rail.addEventListener('scroll', syncFromNative, { passive: true });
      rail.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      });
      window.addEventListener('resize', progress);
    },
    open: open,
    close: close,
    step: step,
    current: function () { return current; },
    arts: function () { return arts; },
    openArt: function () {}   /* replaced by main.js once the lightbox exists */
  };
})();
