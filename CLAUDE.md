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

Six Marian poses are drawn as procedural vector scenes into an offscreen canvas
whose **pixel grid is the character grid** — one canvas pixel per cell. Each
scene is sampled twice in `toChars()`: luminance picks a glyph from `RAMP`, and
a Sobel pass overrides mid-tones with directional hatch glyphs (`| / - \`).
Poses are cached as character arrays, so a transition costs one string build per
frame; the crossfade is a per-cell noise dissolve with a bright burn edge.

Constraints when editing the scenes:

- **Scene space** is `x ∈ [-0.5, 0.5]`, `y ∈ [0, 1]`, visually square. The
  transform in `renderPose()` corrects for the cell aspect ratio. Anything
  drawn outside `y ∈ [0, 1]` is clipped.
- **Line widths are in scene units, where `~0.012` is roughly one character
  cell.** Strokes thinner than a cell anti-alias into a gray haze that the Sobel
  pass turns into hatch noise across large areas. This was the original failure
  mode of this file.
- **Draw like an icon painter, not a renderer**: near-black bodies (`body()`
  defaults to `hi: 0.11`), bright continuous contours (`ink()`), a few decisive
  folds. Tonal masses turn to mush at this resolution; outlines survive. Keep
  ink coverage around 20–25% — `tools/poses.mjs` prints it per pose.

Tuning knobs at the top of the file: `HOLD`, `FADE`, `FPS`, `RAMP`. Opacity is
the `--mary-op` CSS custom property.

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
