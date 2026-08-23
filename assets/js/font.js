/* =============================================================
   font.js — 5-row block font for ASCII banner text
   Every glyph is 5 rows tall, 5 columns wide (+1 column gutter).
   Used by banner() to render section / project / company titles.
   ============================================================= */
(function (global) {
  'use strict';

  var RAW = {
    'A': [' ### ', '#   #', '#####', '#   #', '#   #'],
    'B': ['#### ', '#   #', '#### ', '#   #', '#### '],
    'C': [' ####', '#    ', '#    ', '#    ', ' ####'],
    'D': ['#### ', '#   #', '#   #', '#   #', '#### '],
    'E': ['#####', '#    ', '#### ', '#    ', '#####'],
    'F': ['#####', '#    ', '#### ', '#    ', '#    '],
    'G': [' ####', '#    ', '#  ##', '#   #', ' ####'],
    'H': ['#   #', '#   #', '#####', '#   #', '#   #'],
    'I': ['#####', '  #  ', '  #  ', '  #  ', '#####'],
    'J': ['#####', '    #', '    #', '#   #', ' ### '],
    'K': ['#   #', '#  # ', '###  ', '#  # ', '#   #'],
    'L': ['#    ', '#    ', '#    ', '#    ', '#####'],
    'M': ['#   #', '## ##', '# # #', '#   #', '#   #'],
    'N': ['#   #', '##  #', '# # #', '#  ##', '#   #'],
    'O': [' ### ', '#   #', '#   #', '#   #', ' ### '],
    'P': ['#### ', '#   #', '#### ', '#    ', '#    '],
    'Q': [' ### ', '#   #', '# # #', '#  # ', ' ## #'],
    'R': ['#### ', '#   #', '#### ', '#  # ', '#   #'],
    'S': [' ####', '#    ', ' ### ', '    #', '#### '],
    'T': ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
    'U': ['#   #', '#   #', '#   #', '#   #', ' ### '],
    'V': ['#   #', '#   #', '#   #', ' # # ', '  #  '],
    'W': ['#   #', '#   #', '# # #', '## ##', '#   #'],
    'X': ['#   #', ' # # ', '  #  ', ' # # ', '#   #'],
    'Y': ['#   #', ' # # ', '  #  ', '  #  ', '  #  '],
    'Z': ['#####', '   # ', '  #  ', ' #   ', '#####'],
    '0': [' ### ', '#  ##', '# # #', '##  #', ' ### '],
    '1': ['  #  ', ' ##  ', '  #  ', '  #  ', '#####'],
    '2': [' ### ', '#   #', '   # ', '  #  ', '#####'],
    '3': ['#### ', '    #', '  ## ', '    #', '#### '],
    '4': ['#   #', '#   #', '#####', '    #', '    #'],
    '5': ['#####', '#    ', '#### ', '    #', '#### '],
    '6': [' ### ', '#    ', '#### ', '#   #', ' ### '],
    '7': ['#####', '   # ', '  #  ', ' #   ', ' #   '],
    '8': [' ### ', '#   #', ' ### ', '#   #', ' ### '],
    '9': [' ### ', '#   #', ' ####', '    #', ' ### '],
    ' ': ['     ', '     ', '     ', '     ', '     '],
    '.': ['     ', '     ', '     ', '     ', '  #  '],
    ',': ['     ', '     ', '     ', '  #  ', ' #   '],
    '-': ['     ', '     ', '#####', '     ', '     '],
    '_': ['     ', '     ', '     ', '     ', '#####'],
    '+': ['     ', '  #  ', ' ### ', '  #  ', '     '],
    '/': ['    #', '   # ', '  #  ', ' #   ', '#    '],
    '\\': ['#    ', ' #   ', '  #  ', '   # ', '    #'],
    ':': ['     ', '  #  ', '     ', '  #  ', '     '],
    '!': ['  #  ', '  #  ', '  #  ', '     ', '  #  '],
    '?': [' ### ', '#   #', '   # ', '     ', '  #  '],
    '&': [' ##  ', '#  # ', ' ##  ', '#  ##', ' ## #'],
    '#': [' # # ', '#####', ' # # ', '#####', ' # # '],
    '*': ['#   #', ' # # ', '#####', ' # # ', '#   #'],
    '<': ['   # ', '  #  ', ' #   ', '  #  ', '   # '],
    '>': [' #   ', '  #  ', '   # ', '  #  ', ' #   '],
    '(': ['  ## ', ' #   ', ' #   ', ' #   ', '  ## '],
    ')': [' ##  ', '   # ', '   # ', '   # ', ' ##  '],
    "'": ['  #  ', '  #  ', '     ', '     ', '     '],
    '"': [' # # ', ' # # ', '     ', '     ', '     ']
  };

  var GLYPH_W = 5;
  var GLYPH_H = 5;

  /**
   * Render a string as 5 rows of block-art text.
   * @param {string} text
   * @param {object} [opts] - { fill, gutter, condensed }
   * @returns {string} newline-joined banner
   */
  function banner(text, opts) {
    opts = opts || {};
    var fill = opts.fill || '█';        // █
    var gutter = opts.gutter == null ? 1 : opts.gutter;
    var chars = String(text).toUpperCase().split('');
    var rows = ['', '', '', '', ''];

    for (var c = 0; c < chars.length; c++) {
      var g = RAW[chars[c]] || RAW['?'];
      for (var r = 0; r < GLYPH_H; r++) {
        var line = g[r];
        if (opts.condensed) line = line.replace(/\s+$/, '');
        rows[r] += line + repeat(' ', gutter);
      }
    }
    for (var i = 0; i < GLYPH_H; i++) {
      rows[i] = rows[i].replace(/\s+$/, '').split('#').join(fill);
    }
    return rows.join('\n');
  }

  /** Width in columns a banner would occupy. */
  function bannerWidth(text, gutter) {
    gutter = gutter == null ? 1 : gutter;
    return String(text).length * (GLYPH_W + gutter) - gutter;
  }

  function repeat(s, n) {
    var out = '';
    for (var i = 0; i < n; i++) out += s;
    return out;
  }

  /** Draw an ASCII box around a block of text. */
  function boxed(text, opts) {
    opts = opts || {};
    var pad = opts.pad == null ? 1 : opts.pad;
    var lines = String(text).split('\n');
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, l.length); });
    var inner = w + pad * 2;
    var tl = opts.round ? '╭' : '┌';
    var tr = opts.round ? '╮' : '┐';
    var bl = opts.round ? '╰' : '└';
    var br = opts.round ? '╯' : '┘';
    var title = opts.title ? ' ' + opts.title + ' ' : '';
    var top = tl + title + repeat('─', Math.max(0, inner - title.length)) + tr;
    var bottom = bl + repeat('─', inner) + br;
    var body = lines.map(function (l) {
      return '│' + repeat(' ', pad) + l + repeat(' ', inner - pad - l.length) + '│';
    });
    return [top].concat(body, [bottom]).join('\n');
  }

  global.AsciiFont = { banner: banner, bannerWidth: bannerWidth, boxed: boxed, repeat: repeat, GLYPH_W: GLYPH_W, GLYPH_H: GLYPH_H };
})(window);
