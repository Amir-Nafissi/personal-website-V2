# amir@kanso

```
                   :   ..      ...                                          ...      ..   :
               =-   @.              .                                    .              .@   -=
           :+   |@. /@---@----         .                              .         ----@---@\ .@|   +:
        .    @\  @@@@@@@@@@@@@@@@-                                  .       -@@@@@@@@@@@@@@@@  -@    .
         -*-  @@@@@@@//-  . .---@@@@-                                    -@@@@---. .  -\\@@@@@@@  -*-
     .     *@-/@@@--#@/      .\-----@@%.                              .%@@-/----.      \%#/-@@@\\@*     .
       =%+. |@@@%  @@             \- -@@@                            @@@/ -/             %@  %@@@| .+%=
         .@@@@@/  |@.        /@@@.  =   -@\                        /@-   +   %@@%        .@|  \@@@@@.
    .:++*+=-@/    @@|-  -   @@@@@@   +    =@\                    /@+    =   @@@@@@   -  =|%@    \@-/+*++:.
         -\@      @%    +  |@@@@@@.  +  .|@//@\                /@-\@|-  +   @@@@@@|  -    |@      @/-
             *    @@|.  +   @@@@@@   +    @%  --              --  |@    =   @@@@@@   + .=|@@    *
           +#/ -. \@.    =   %@@/   .  +-/@/  .*\            /*.   @\.=  .   -@@@.  -     @/ .- \#+
         ..    #@:.\|     -:             @@   \-//          \\-|   \@|            .-  +- |-/:@#    ..
              *-   .-:=     .:..:.   .  .-                          -/      .:..:.     ---.   -*
                        .::::::.....                                      .....::::::.
```

A single-page personal site built as a **ricing screenshot**: a customised
Linux desktop with anime. Two ASCII eyes watch your cursor, a terminal takes
commands, and everything else is a window on the desk.

No framework, no build step, no dependencies, no `package.json`. Open
`index.html` and it runs.

```
> neofetch
os      ricelinux x86_64
wm      hyprland (dwindle)
term    foot / JetBrains Mono NF
theme   catppuccin-mocha
```

The eyes above are not a picture. They are the real engine's output, dumped
straight out of the page.

---

## Run it

Any static host works. Locally:

```sh
python -m http.server 8000      # or: npx serve .
```

Opening `index.html` off the filesystem works too.

---

## How it behaves

The page **never scrolls**. It is a desktop, not a document, and it moves
through four stages:

| Stage | What is on screen |
| --- | --- |
| `boot` | The boot log types out |
| `eyes` | The eyes fade up, centred and alone |
| `shell` | The eyes step aside, the terminal opens beside them |
| `open` | The stage lifts and shrinks, a deck of cards rises underneath |

Ask for a section — by typing it, pressing a chip, or hitting a workspace
number — and the cards for it lay out **horizontally**. Scrolling moves them
sideways. `clear` empties the terminal and the deck together and drops you
back to `shell`.

Every movement between stages is a CSS transform keyed off one attribute on
`<html>`. Nothing animates layout, so the character grids never re-rasterise
mid-transition.

---

## Making it yours

**Everything the page says lives in [`assets/js/content.js`](assets/js/content.js).**
`index.html` is structure only.

```js
window.SITE = {
  identity: { name, user, host, role, tagline, location, email, links[] },
  fetch:    [[key, value], ...],        // the neofetch table
  motd:     [...],                      // greeting lines
  sections: {
    education: { cmd, title, path, blurb, cards[] },
    work:      { ... },
    projects:  { ... },
    creations: { ... }
  },
  whoami: [...], interests: [...], now: [...]
};
```

**One card schema renders all four sections.** A card may carry any of:

```js
{ head, sub, meta, badge, body[], list[], tags[], links[], bars[], art }
```

`art` makes it an image card with a lightbox; `bars[]` makes it a meter
panel. To add a field, extend `build()` in `deck.js` — don't invent a second
card type.

The shipped content is **placeholder**: invented employers, degrees and
projects. Replace it.

### Artwork

Images are the only non-ASCII elements on the page. Drop files in
`assets/art/` and point a card's `art` at them. The eight SVGs there now are
procedurally generated placeholders in the *previous* site's Renaissance
style — `node tools/gen-art.mjs` regenerates them, and they are the first
thing you should replace.

---

## The shell

Type into it. It has history on the arrows, tab completion with a ghosted
suggestion, and a block caret that inverts the character under it.

| | |
| --- | --- |
| Sections | `education` `work` `projects` `creations` |
| Info | `whoami` `neofetch` `skills` `interests` `now` `contact` |
| Shell | `ls` `clear` `theme [name]` `history` `date` `echo` `help` |

`cd work`, `work`, `./work`, `jobs` and `experience` all resolve to the same
key — aliases live in `resolve()` in `shell.js`.

---

## Controls

| Input | Effect |
| --- | --- |
| `/` | Focus the prompt |
| `1`–`5` | Jump to a workspace (home + four sections) |
| `←` `→` | Move the card rail (or the lightbox) |
| `Tab` | Complete a command |
| `↑` `↓` | Command history |
| `Ctrl-L` / `Ctrl-C` | Clear screen / cancel line |
| `Esc` | Clear the deck, or close the lightbox |

Themes are `mocha`, `gruvbox` and `tokyo`, cycled from the bar or with
`theme`. Click sounds are off until you ask for them.

---

## How the pieces fit

Classic browser scripts, loaded in dependency order, talking through globals.
ES5 style throughout (`var`, IIFE modules) — match it.

```
font.js -> content.js -> eyes.js -> wall.js -> deck.js -> shell.js -> main.js
```

| File | Role |
| --- | --- |
| `index.html` | Structure only |
| `assets/css/style.css` | Palettes, window chrome, the stage machine |
| `assets/js/content.js` | **All content** |
| `assets/js/eyes.js` | The ASCII eye engine (`window.AsciiEyes`) |
| `assets/js/shell.js` | The interactive terminal (`window.Shell`) |
| `assets/js/deck.js` | The horizontal card rail (`window.Deck`) |
| `assets/js/wall.js` | Ambient ASCII wallpaper (`window.Wall`) |
| `assets/js/main.js` | Boot, stage machine, status bar, keyboard |
| `assets/js/font.js` | 5-row block font, used by the boot logo |
| `tools/peek.mjs` | Screenshot any page, run JS probes |
| `tools/shot.mjs` | Full walkthrough + assertions |
| `tools/gen-art.mjs` | Regenerates the placeholder artwork |

---

## The eye engine

`assets/js/eyes.js` is self-contained and meant to stand on its own.

```js
var eyes = AsciiEyes.mount(hostEl, {
  cols: 150,           // default: fit the host box
  ramp: ' .:-=+*#%@',
  rest: 0.11,          // permanent partial lid; 0 = wide open
  edge: 1.55           // Sobel threshold for directional glyphs
});
eyes.look(x, y);   eyes.blink();   eyes.wink(1);   eyes.setGaze(0, 0);
```

The eye is **vector geometry**, not a sprite sheet: a variable-width lash
ribbon (a cubic bezier offset along its own normal, so the stroke swells and
tapers like a brush), a lower lid, two lash fans, a lid crease, an iris with
rim ticks, a pupil, and specular highlights punched out of all of it.

That geometry rasterises into an offscreen canvas whose aspect ratio matches
the on-screen character block, then box-filters down to **one value per
character cell**. Gaze, blink and saccade are just parameters of the draw, so
following the cursor costs one re-render — about a millisecond.

Two quantities travel at once, in two colour channels: **R is ink**, **G is
material** (line / iris / pupil). G is scaled *by* the ink, so a cell's
material is `sum(G)/sum(R)` — an ink-weighted mean. Three aligned `<pre>`
layers are emitted, split by material, which buys per-material colour for the
price of three string builds a frame instead of three thousand spans.

Things that took real debugging, and will bite anyone who changes it:

- **The eye needs rows.** A character cell is about 1:2, so vertical
  resolution is the scarce axis. The layer sits at 8px on purpose.
- **Fills must stay faint.** On a dark ground the ink *is* the mark. A
  solidly filled iris rasterises to a block of `@`.
- **Ink passes through a contrast window before the ramp**, or every
  antialiased stroke's halo doubles the apparent width of every line.
- **Directional glyphs need an ink gate**, not just a magnitude threshold,
  or the iris texture turns into a hatched mesh.
- **Anything offset along a curve's normal must be signed by the mirror
  factor.** The mirrored eye walks its bezier the other way, so its normals
  flip — unsigned, one eye's clip expands into its own lash line.
- **A closing eye must stop drawing the iris.** Otherwise the two clip
  insets cross, the polygon turns inside out, and the iris paints over the
  lashes.

`eyes.canvas` exposes the raw two-channel raster — draw it scaled into a
visible canvas to debug the geometry separately from the glyph mapping.

---

## The deck

The rail is a **real `overflow-x` container**, not a transformed strip, so
trackpad swipes, touch drags, keyboard focus and scroll-snap all work for
free. On top of that a `wheel` listener folds `deltaY` into a target
`scrollLeft` that a rAF loop eases toward, which is what makes a vertical
scroll move the cards sideways with some weight. A horizontal wheel is left
alone for the browser.

---

## Accessibility & performance

- The eyes host carries `role="img"` and a label; decorative character art is
  `aria-hidden`.
- `prefers-reduced-motion` gates blinking, saccades, the wallpaper, the bar
  meters, the boot typing, card stagger and rail easing.
- The rail is focusable and arrow-navigable; the lightbox traps and restores
  focus.
- No dependencies. The eyes re-render only when their state actually changes,
  capped at 30fps; the wallpaper runs at 12fps and stops when the tab is
  hidden.
- Themes are token-driven — no colour is hard-coded outside the `:root`
  blocks.

### A note on fonts

The UI face is JetBrains Mono. Pure character art is pinned to `--mono-sys`,
because a face without box-drawing or block glyphs falls back to a system
mono with a *different advance width*, which silently shears the columns.
**If you add box-drawn UI, add its selector to that rule.**

---

## Verification

The harnesses in `tools/` drive real headless Chrome over the DevTools
Protocol. **Real time, not virtual time** — `--virtual-time-budget`
fast-forwards timers but never delivers `IntersectionObserver` callbacks or
settles CSS transitions, so a virtual-time screenshot shows the stage
machine, the typewriter and the card entry as broken when they are fine.

```sh
node tools/shot.mjs ./out              # every stage, section, theme + assertions
node tools/peek.mjs index.html a.png 3000 1440 900 --js="expr"
```

`shot.mjs` asserts more than it screenshots: that the gaze actually tracks
(by diffing the pupil layer across cursor positions), that the two eyes stay
mirror-symmetric, that a shut eye shows no iris, that every card renders,
that the wheel moves the rail, and that `clear` resets everything. Treat any
non-`(clean)` console output as a failure.

Both tools hardcode the Chrome path at the top — edit it if your machine
differs.

---

## History

The previous version of this site — a Renaissance scriptorium on a phosphor
terminal, with ASCII engravings from the Met's Open Access collection — is
preserved on the **`regular-mary`** branch.
