# ASCII SCRIPTORIUM

A single-page personal portfolio rendered almost entirely in ASCII —
Renaissance illumination on a phosphor terminal. No framework, no build
step, no dependencies. Open `index.html` and it runs.

```
> file index.html
index.html: HTML document, 7-bit ASCII text, with a Madonna in the background
```

---

## Run it

Any static host works. Locally:

```sh
python -m http.server 8000      # or: npx serve .
```

Opening `index.html` directly off the filesystem also works.

---

## Making it yours

**Everything you'd want to change lives in [`assets/js/content.js`](assets/js/content.js).**
It is one plain object — identity, education, experience, skills,
projects, the terminal's `whoami` / `interests` / specs text, and the
gallery manifest. Nothing else needs editing to publish your own version.

```js
window.SITE = {
  identity:   { name, role, tagline, location, email, links[] },
  education:  [{ degree, institution, dates, note, coursework[] }],
  experience: [{ company, role, dates, location, duties[], stack[] }],
  skills:     [{ name, value /* 0-100 */ }],
  projects:   [{ title, subtitle, icon, desc, tags[], links[] }],
  context:    { whoami[], interests[], specs[][], now[] },
  gallery:    [{ src, title, meta }]
};
```

The content shipped here is **placeholder** — plausible-looking filler so
the layout can be judged. Replace it.

### Your artwork

The gallery images are the only non-ASCII elements on the page, by design.
Drop your files in `assets/art/` and point `SITE.gallery[].src` at them.

The eight SVGs currently there are procedurally generated placeholders;
`node tools/gen-art.mjs` regenerates them. Delete the generator once you
have real work to show.

### Project card icons

`icon` selects from the small ASCII thumbnails in the `ICONS` map near the
top of `assets/js/main.js`: `eye`, `scroll`, `tower`, `pen`, `arch`,
`quill`. Add your own — any array of equal-length strings works.

---

## How the pieces fit

| File | Role |
| --- | --- |
| `index.html` | Structure and the static ASCII furniture |
| `assets/css/style.css` | Palette, CRT effects, layout |
| `assets/js/content.js` | **All content** |
| `assets/js/font.js` | 5-row block font used for every banner |
| `assets/js/mary.js` | The rotating Saint Mary background engine |
| `assets/js/mary-frames.js` | **Generated.** Engraving luminance maps, inlined |
| `assets/js/main.js` | Rendering, typewriters, terminal, gallery, input |
| `assets/mary/` | **Generated.** The same maps as PNGs, plus credits |
| `tools/fetch-sources.mjs` | Downloads public-domain engravings from the Met |
| `tools/asciify.mjs` | Engraving → luminance map pipeline |
| `tools/gen-art.mjs` | Regenerates the placeholder gallery artwork |
| `tools/shot.mjs`, `tools/poses.mjs` | Headless-Chrome verification harnesses |

### The background engine

The six background plates are **real Renaissance engravings** — five by
Martin Schongauer (c. 1450–1491), one anonymous — from the Metropolitan
Museum of Art's Open Access collection, all CC0.

That sourcing is the whole aesthetic, and it is worth being explicit
about why. The look depends entirely on burin work: parallel hatching
that swells and tapers, cross-hatch massing in the shadows, stipple
flicks in the half-tones. That texture is exactly what survives
quantisation to a character grid — and it is not something bezier curves
can fake. An earlier version of this file drew the figures procedurally
and they read as machinery, not icons.

Offline, `tools/asciify.mjs` turns each plate into an inverted grayscale
luminance map:

```
source jpeg → trim paper margin → manual crop → two-step downscale
  → auto-levels → unsharp (restores the burin lines lost to downscaling)
  → gamma/contrast → invert (ink becomes the bright thing)
  → vignette → posterise to 18 levels → grayscale PNG
```

At runtime `mary.js` draws each map into a canvas whose pixel grid *is*
the character grid, then samples it twice: luminance picks a glyph from
`RAMP`, and a Sobel pass promotes strong edges to directional glyphs
(`| / - \`). Results are cached as character arrays, so a transition
costs one string build per painted frame. The crossfade is a per-cell
noise dissolve with a bright burn edge — 9s hold, 2.2s fade, 24fps.

Two constraints worth knowing before you swap plates:

- **Choose isolated figures on blank paper.** A plate with a fully worked
  background (skies, architecture) inverts into a bright rectangular slab
  that reads as a block behind your text rather than a figure floating in
  the dark. The vignette mitigates this; it does not fix it.
- **The maps ship inlined as `data:` URIs** in `assets/js/mary-frames.js`,
  not as separate image files. A canvas drawn from a `file://` `<img>` is
  tainted, so `getImageData()` would throw for anyone opening
  `index.html` straight off disk. Copies land in `assets/mary/` for
  reference; the inlined module is what the page uses.

Tuning knobs at the top of `mary.js`: `HOLD`, `FADE`, `FPS`, `FILL`,
`RAMP`. Opacity is the `--mary-op` CSS custom property.

### Swapping the background plates

```sh
node tools/fetch-sources.mjs   # ~50 PD Marian prints from the Met -> sources/
node tools/asciify.mjs         # chosen plates -> assets/js/mary-frames.js
```

Edit the `PLATES` array at the top of `tools/asciify.mjs` to pick
different object IDs and tune per-plate `crop`, `gamma`, `contrast` and
`vignette`. `sources/` is gitignored — it holds ~150MB of full-resolution
scans and is only needed when regenerating.

The Met images are CC0 and require no attribution, but the footer credits
them anyway, and `credit` on each frame (also shown by the `mary`
command) names the artist and plate.

### Banner text

`font.js` renders any string as five rows of block glyphs. Banners
auto-shrink to fit their container — `fitBanner()` in `main.js` probes
`scrollWidth` at the maximum size and scales from the measured ratio, so
it stays correct across fonts and letter-spacing.

### A note on fonts

Share Tech Mono, VT323 and Courier Prime have no box-drawing or block
glyphs, so those characters fall back to a system mono with a *different
advance width* — which silently breaks column alignment. Every block of
pure ASCII art is therefore pinned to `--mono-sys` in the stylesheet.
If you add new box-drawn UI, add its selector to that rule.

---

## Controls

| Input | Effect |
| --- | --- |
| `↑` `↓` / `j` `k` / PgUp PgDn | Move between sections |
| `g` / `G` | First / last section |
| `/` | Focus the command bar |
| `t` | Toggle green / amber phosphor |
| `m` | Advance the background pose |
| `←` `→` | Previous / next artwork (lightbox open) |
| `Esc` | Close lightbox or overlay |
| `↑↑↓↓←→←→BA` | — |

Command bar accepts `goto <section>`, `ls`, `whoami`, `cat
interests.txt`, `skills`, `neofetch`, `now`, `theme [green\|amber]`,
`sound`, `mary`, `date`, `clear`, `help`, and `sudo`.

Terminal click sounds are off by default (`[ snd:off ]` in the header) —
browsers require a gesture before audio, and unrequested noise is rude.

---

## Accessibility & performance

- Every ASCII banner carries an `aria-label` with its plain-text content;
  decorative art is `aria-hidden`.
- `prefers-reduced-motion` disables the CRT flicker, scanline sweep,
  typewriters, cursor trail, scroll particles, and background rotation.
- Sections are focusable and the whole page is keyboard-navigable.
- No fonts block first paint beyond the Google Fonts stylesheet; no
  JavaScript dependencies; the background repaints only during a
  transition, one `textContent` write per frame.

---

## Verification

The two harnesses in `tools/` drive real headless Chrome over the
DevTools Protocol — virtual-time screenshots don't advance
`IntersectionObserver`, so anything scroll-triggered needs real elapsed
time.

```sh
node tools/shot.mjs ./out 6000   # probes + screenshots of every section
node tools/poses.mjs ./out       # each background pose at full opacity
```

Both expect Chrome at the default Windows install path; edit the constant
at the top if yours differs.
