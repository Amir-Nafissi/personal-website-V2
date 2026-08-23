# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page ASCII-art portfolio site. Vanilla HTML/CSS/JS — **no build step, no
package.json, no dependencies, no test suite.** Scripts are classic (non-module)
browser scripts loaded in dependency order by `index.html`:

```
font.js  →  content.js  →  mary.js  →  main.js
```

They communicate through three globals: `window.AsciiFont`, `window.SITE`,
`window.MaryBG`. Code is written in ES5 style (`var`, IIFE modules, no arrow
functions) — match it. The `tools/*.mjs` scripts are the exception: those are
Node ESM and use modern syntax freely.

## Commands

```sh
python -m http.server 8000      # serve locally (file:// also works)
node --check assets/js/main.js  # syntax check — the only "lint" available

node tools/gen-art.mjs          # regenerate the placeholder gallery SVGs
node tools/fetch-sources.mjs    # download public-domain engravings from the Met
node tools/asciify.mjs          # engravings -> assets/js/mary-frames.js
node tools/shot.mjs <outDir> [waitMs]   # probes + screenshots of every section
node tools/poses.mjs <outDir>           # each background pose at full opacity
```

`tools/shot.mjs` and `tools/poses.mjs` drive real headless Chrome over the
DevTools Protocol. Both hardcode the Chrome path and (in `shot.mjs`) the page
URL as constants at the top — edit them if the repo moves.

**Verification must run in real time.** Chrome's `--virtual-time-budget`
fast-forwards timers but never delivers `IntersectionObserver` callbacks, so a
virtual-time screenshot shows every scroll-triggered feature (typewriters,
reveals, skill bars, project descriptions, the context terminal) as broken when
it is fine. Use the CDP harnesses, not `chrome --screenshot`.

`shot.mjs` prints a `PROBE` object and a `CONSOLE` line; treat any non-`(clean)`
console output as a failure.

## Architecture

### Content is data, not markup

Everything the page says lives in `assets/js/content.js` as one `window.SITE`
object. `index.html` contains only structure and static ASCII furniture; every
section body is generated at runtime by `main.js`. Change content there, never
in the markup or the render functions.

The shipped content is **placeholder** — invented employers, degrees, and
projects, plus procedurally generated gallery SVGs.

### ASCII boxes are computed, not hardcoded

Box-drawn blocks (hero card, education windows, the specs panel) are built as
strings in JS sized from the measured character width `CW`, via `fitCols()`.
This means they must be rebuilt whenever the viewport changes.

`buildResponsive()` in `main.js` is the resize path — it re-runs `measure()`,
`paintBanners()`, `buildHero()`, `buildEducation()`, `buildSpecs()`, then
`fitBanners()` and `fitSpines()`. Sections built once at startup (experience,
projects, gallery) are **not** rebuilt; anything of theirs that depends on
layout needs an explicit refit hook in that rAF instead.

### Two font faces, and why it matters

Share Tech Mono / VT323 / Courier Prime have **no box-drawing or block glyphs**.
Those characters silently fall back to a system mono with a *different advance
width*, which breaks column alignment in a way that is easy to miss and looks
like a layout bug. Every block of pure ASCII art is therefore pinned to
`--mono-sys` by a single rule in `style.css` (search for "Box-drawing and block
glyphs"). **If you add box-drawn or block-shaded UI, add its selector to that
rule.**

### Banner sizing

`font.js` renders any string as five rows of block glyphs. Banners opt into
auto-shrinking by carrying a `data-fs-max` attribute; `fitBanner()` sets that
maximum, reads `scrollWidth`, and scales from the measured ratio. Do not model
banner width arithmetically — an earlier version did and silently ignored
`letter-spacing`, clipping longer titles.

### The background engine (`mary.js`)

The six background plates are **real Renaissance engravings** (Schongauer et
al.) from the Met Open Access collection, CC0. They are preprocessed offline by
`tools/asciify.mjs` into inverted grayscale luminance maps, inlined as `data:`
URIs in the generated `assets/js/mary-frames.js`.

At runtime each map is drawn into a canvas whose **pixel grid is the character
grid** — one canvas pixel per cell — then sampled twice in `toChars()`:
luminance picks a glyph from `RAMP`, and a Sobel pass promotes strong edges to
directional glyphs. Poses cache as character arrays, so a transition costs one
string build per painted frame; the crossfade is a per-cell noise dissolve with
a bright burn edge.

Things that will bite you here:

- **Do not go back to drawing the figures procedurally.** A previous version
  did. The aesthetic lives in the burin work — hatching that swells and tapers,
  cross-hatch massing, stipple half-tones — which is precisely what survives the
  character grid and precisely what bezier curves cannot fake. The procedural
  version read as machinery.
- **`mary-frames.js` is generated. Never hand-edit it.** Change `PLATES` in
  `tools/asciify.mjs` and re-run.
- **The maps must stay inlined as `data:` URIs.** A canvas drawn from a
  `file://` `<img>` is tainted and `getImageData()` throws, which would break
  the page for anyone opening `index.html` off disk. This is why the pipeline
  emits a JS module rather than referencing `assets/mary/*.png` directly.
- **Pick isolated figures on blank paper.** Plates with a fully worked
  background invert into a bright rectangular slab behind the text. The
  `vignette` option mitigates it; it does not fix it.
- Keep ink coverage roughly 12–27% — `tools/poses.mjs` prints it per pose.

**Scale and parallax.** Plates render larger than the viewport into a buffer of
`bufRows` (> `rows`), and page scroll slides a `rows`-high window down it — so
panning is index arithmetic on the cached char array, never a redraw. Two things
follow from that and are easy to break:

- `renderPose()` and `toChars()` work in **buffer** space (`bufRows`); `paint()`
  works in **screen** space (`rows`) and adds `Math.round(panCur) * cols` to
  reach the plate. The `noise` array is screen-sized on purpose, so a dissolve
  sweeps the viewport rather than sliding with the parallax. Mixing the two
  coordinate spaces gives out-of-bounds reads and a blank background.
- `bufRows` is derived from `plateHeight()` across all images, floored at
  `rows * (1 + TRAVEL)`. Do not hardcode it to `rows * BIG`: a portrait plate at
  full viewport height is wider than a phone screen in character terms, so
  narrow grids fall back to a width fit and would otherwise get no pan travel.

Knobs at the top of `mary.js`: `BIG`, `TRAVEL`, `EASE`, `MAXW`, `HOLD`, `FADE`,
`FPS`, `RAMP`. Opacity is the `--mary-op` CSS custom property. Parallax pins to
centre under `prefers-reduced-motion`.

Regenerating:

```sh
node tools/fetch-sources.mjs   # ~50 PD Marian prints -> sources/  (gitignored, ~150MB)
node tools/asciify.mjs         # PLATES -> assets/js/mary-frames.js + assets/mary/
```

Both hit the Met's public API, which throttles aggressively; `fetch-sources.mjs`
backs off and caches into `sources/.met-cache.json`.

## Conventions

- Every ASCII banner carries an `aria-label` with its plain-text content;
  purely decorative art is `aria-hidden="true"`.
- `main.js` and `mary.js` each hold a `REDUCED` / `reduced` flag from
  `prefers-reduced-motion`. New motion must check it — it currently gates the
  CRT flicker, typewriters, cursor trail, scroll particles, sparkles, and
  background rotation.
- Audio is opt-in and silent until the user toggles it; `Snd.click()` is a no-op
  when off, so it is safe to call from anywhere.
- Any user-supplied string interpolated into HTML goes through `esc()`.

## Note

A Gemini CLI config directory exists at `~/.gemini`. If you want its settings,
MCP servers, or commands brought over, reply `/import` to see what's importable,
then `/import --yes=<digest>` to apply it. (Run `claude import` from a terminal
if `/import` isn't available here.)
