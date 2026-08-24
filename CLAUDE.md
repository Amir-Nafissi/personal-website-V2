# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page personal site themed as a **customised Linux desktop ("rice")
with anime** — ASCII anime eyes that follow the cursor, and a terminal that
drives everything else.

Vanilla HTML/CSS/JS — **no build step, no package.json, no dependencies, no
test suite.** Scripts are classic (non-module) browser scripts loaded in
dependency order by `index.html`:

```
font.js → content.js → eyes.js → wall.js → deck.js → shell.js → main.js
```

They communicate through globals: `window.AsciiFont`, `window.SITE`,
`window.AsciiEyes`, `window.Wall`, `window.Deck`, `window.Shell`. Code is ES5
style (`var`, IIFE modules, no arrow functions) — match it. The `tools/*.mjs`
scripts are the exception: Node ESM, modern syntax.

The previous Renaissance/phosphor version of this site is preserved on the
**`regular-mary`** branch. Its background engine (`mary.js`, `mary-frames.js`,
`assets/mary/`, and the three Met-scraping tools) was removed from `main`.

## Commands

```sh
python -m http.server 8000      # serve locally (file:// also works)
node --check assets/js/main.js  # syntax check — the only "lint" available

node tools/gen-art.mjs                  # regenerate the placeholder gallery SVGs
node tools/peek.mjs <file> <out.png> [waitMs] [w] [h] [--js=expr]...
node tools/shot.mjs <outDir> [waitMs]   # full walkthrough: every stage + section
```

`peek.mjs` is the workhorse — point it at any page, wait, run `--js` probes
(promises are awaited), get a PNG and the console log. `shot.mjs` drives the
whole site through boot → eyes → shell → each section → lightbox → themes →
mobile.

**Verification must run in real time.** Chrome's `--virtual-time-budget`
fast-forwards timers but never delivers `IntersectionObserver` callbacks or
settles CSS transitions, so a virtual-time screenshot shows the stage machine,
the typewriter and the card entry as broken when they are fine. Use the CDP
harnesses, never `chrome --screenshot`.

Both tools hardcode the Chrome path as a constant at the top — edit if the
machine changes. Treat any non-`(clean)` console output as a failure.

## Architecture

### Content is data, not markup

Everything the page says lives in `assets/js/content.js` as one `window.SITE`
object. `index.html` is structure only. The four sections
(`education`, `work`, `projects`, `creations`) each declare `cmd`, `title`,
`path`, `blurb` and a `cards` array. **One card schema renders them all** — a
card may carry any of `head`, `sub`, `meta`, `badge`, `body[]`, `list[]`,
`tags[]`, `links[]`, `bars[]`, `art`. Add a field to `deck.js`'s `build()`, not
a new card type.

The shipped content is **placeholder** — invented employers, degrees and
projects, plus procedurally generated gallery SVGs (still in the old
Renaissance style; regenerate `gen-art.mjs` if that bothers you).

### The page is a desktop, not a document

`body` never scrolls. `#bar` is the status bar, `#desk` fills the rest,
`#stage` holds the eyes and terminal, `#deck` slides up underneath.

There are four stages, held in one attribute on `<html>`:

| `data-stage` | what is on screen |
|---|---|
| `boot`  | the boot log |
| `eyes`  | eyes alone, centred |
| `shell` | eyes step right, terminal opens on the left |
| `open`  | stage lifts and scales, deck rises into the gap |

**Every movement between stages is a CSS transform keyed off that attribute**
(the `STAGE MACHINE` block in `style.css`). This is load-bearing, not a style
preference: animating `width`/`height`/`top` on `#stage` or `#eyes` relayouts
the character grids, which fires the eyes' `ResizeObserver` and re-rasterises
the whole drawing every frame. If you need a new stage, add an attribute value
and transforms — do not animate box metrics.

`--lift` and `--stage-k` are **measured in `main.js` (`fitStage`)**, not
authored in CSS. The terminal's height depends on how many chip rows wrapped,
so a hard-coded lift either overlaps the deck or leaves a hole. `fitStage()`
centres the scaled stage in whatever room is left above the deck; call it after
anything that changes the deck height or the terminal's contents.

### The eye engine (`eyes.js`)

`window.AsciiEyes.mount(hostEl, opts)`. Self-contained and documented at the
top of the file — it is meant to stand alone as a project.

Pipeline: vector eye → supersampled canvas → one value per character cell →
glyph ramp. Things that will bite you:

- **Two quantities travel in two colour channels.** R is ink, G is
  ink-weighted material (line / iris / pupil). G is scaled *by* the ink so a
  cell's material is `sum(G)/sum(R)` — an ink-weighted mean. An area mean gets
  diluted by empty space and a cell holding one thin iris stroke comes out
  coloured as a line.
- **Ink accumulates with `'lighter'`; highlights are punched with
  `'destination-out'`**, which clears both channels at once — which is exactly
  what a specular should do.
- **Ink passes through a contrast window (`LO`/`HI`) before the ramp.** Every
  antialiased stroke carries a halo of partial cells; mapped straight onto the
  ramp that halo doubles the apparent width of every line and the drawing turns
  to mush.
- **Directional (Sobel) glyphs need an ink gate as well as a magnitude
  threshold.** Without it every faint texture inside the iris becomes hatching
  and the eye collapses into a mesh.
- **The eye needs ROWS.** The character cell is about 1:2, so vertical
  resolution is the scarce axis and it is what limits how much of the drawing
  survives. `.eye-layer` is 8px on purpose (~50 rows in the hero box). Raising
  the font size coarsens the grid and the eye stops reading.
- **Fills must stay faint.** On a dark ground the ink *is* the mark. A solidly
  filled iris rasterises to a block of `@`; the rim, the ticks and the pupil
  carry it and the body only tints.
- The lower lid is deliberately short and light. A full-strength one closes the
  outline into a ring and it stops reading as an eye.
- `s` mirrors the eye's **shape** and must never be applied to the gaze, or the
  eyes track outward instead of at the cursor.

Knobs: `cols`, `aspect`, `ramp`, `edge`, `brow`, and `SS` / `FPS` / `RAMP` at
the top of the file. `eyes.canvas` exposes the raw two-channel raster — render
it scaled into a visible canvas to debug geometry separately from glyph mapping.

### The deck (`deck.js`)

The rail is a **real `overflow-x` container**, not a transformed strip, so
trackpad swipes, touch drags, keyboard focus and scroll-snap work for free. A
`wheel` listener folds `deltaY` into a target `scrollLeft` that a rAF loop eases
toward; a horizontal wheel is left alone for the browser. Keep both paths —
dropping the native container costs accessibility, dropping the wheel handler
costs the whole "scroll moves cards sideways" idea.

`close()` waits out the slide-down transition before emptying the rail;
emptying immediately collapses it mid-slide.

### The shell (`shell.js`)

The `<input>` is transparent and a mirror `<span>` draws the text, so the caret
can be a block glyph that inverts the character under it. A `caret-color` caret
cannot do that and a `contenteditable` would cost selection and IME handling.

Section commands render nothing themselves — they call back into `main.js`,
which owns the stage and the deck. `resolve()` folds `cd work`, `work`,
`./work`, `jobs` and `experience` onto one key; add aliases there.

Echoed commands type out character by character; **output lines are revealed in
a stagger, not typed.** Typing every output character makes `neofetch` take four
seconds.

## Conventions

- Any user-supplied string interpolated into HTML goes through `esc()`.
- `main.js`, `eyes.js`, `wall.js`, `deck.js` and `shell.js` each hold a
  `REDUCED` flag from `prefers-reduced-motion`. New motion must check it — it
  currently gates blinking, saccades, the wallpaper, the bar meters, the boot
  typing, card stagger and rail easing.
- Audio is opt-in and silent until toggled; `Snd.click()` is a no-op when off,
  so it is safe to call from anywhere.
- Purely decorative character art is `aria-hidden="true"`; the eyes host
  carries `role="img"` and a label.
- Themes are `mocha` / `gruvbox` / `tokyo` on `<html data-theme>`, all three
  driven by the same token names. Add a palette by adding a block — never
  hard-code a hex outside the `:root` blocks.

### Fonts

The UI face is JetBrains Mono. Pure character art is pinned to `--mono-sys`
(the rule near the top of `style.css`) so block and box-drawing glyphs cannot
fall back to a face with a different advance width and shear the columns.
**If you add box-drawn or block-shaded UI, add its selector to that rule.**
