/* =============================================================
   content.js — EDIT THIS FILE to make the site yours.
   Everything the page says lives here. No build step.

   The deck renders one card shape for every section, so a card
   may carry any of: head, sub, meta, badge, body[], list[],
   tags[], links[], art, bars[].
   ============================================================= */
window.SITE = {

  /* ---------------------------------------------------------- */
  identity: {
    name: 'AMIR NAFISSI',
    user: 'amir',
    host: 'kanso',
    role: 'Software Engineer / Systems & Interfaces',
    tagline: 'i rice desktops and ship interfaces.',
    location: 'Earth // UTC+0',
    email: 'amirnafissi700@gmail.com',
    links: [
      { label: 'github', href: 'https://github.com/' },
      { label: 'linkedin', href: 'https://linkedin.com/in/' },
      { label: 'mail', href: 'mailto:amirnafissi700@gmail.com' }
    ]
  },

  /* ----------------------------------------------------------
     neofetch(1) — the right-hand column. The left-hand ASCII
     mascot lives in shell.js.                                  */
  fetch: [
    ['os', 'ricelinux x86_64'],
    ['host', 'kanso / thinkpad-shaped'],
    ['kernel', '6.9.4-zen1'],
    ['uptime', '7 yrs, 2 months'],
    ['pkgs', '1482 (pacman), 61 (npm -g)'],
    ['shell', 'zsh 5.9 + far too many aliases'],
    ['wm', 'hyprland (dwindle)'],
    ['bar', 'waybar + a custom module'],
    ['term', 'foot / JetBrains Mono NF'],
    ['editor', 'neovim'],
    ['cpu', 'caffeine 6.2.0 @ 4.8GHz'],
    ['gpu', 'renders text, mostly'],
    ['mem', '9204MiB / 16384MiB']
  ],

  motd: [
    'welcome back, amir.',
    'the eyes follow your cursor. the terminal takes commands.',
    'type `help`, or press a button below.'
  ],

  /* ----------------------------------------------------------
     SECTIONS — each one is a shell command and a deck of cards.
     ---------------------------------------------------------- */
  sections: {

    education: {
      cmd: 'education',
      title: 'EDUCATION',
      path: '~/edu',
      blurb: 'three transcripts, one of them in charcoal',
      cards: [
        {
          head: 'M.Sc. Computer Science',
          sub: 'Institute of Technology',
          meta: '2022 — 2024',
          badge: 'msc',
          body: ['Thesis: perceptual compression of generative image latents.'],
          list: [
            'Distributed Systems',
            'Computer Graphics & Rendering',
            'Machine Learning Theory',
            'Compilers & Program Analysis'
          ]
        },
        {
          head: 'B.Sc. Software Engineering',
          sub: 'University of the Republic',
          meta: '2018 — 2022',
          badge: 'bsc',
          body: ['Graduated with honours. Founded the campus demoscene club.'],
          list: [
            'Data Structures & Algorithms',
            'Operating Systems',
            'Numerical Methods',
            'Human-Computer Interaction'
          ]
        },
        {
          head: 'Certificate — Classical Drawing',
          sub: 'Atelier of Fine Arts',
          meta: '2020',
          badge: 'cert',
          body: ['Cross-hatching, stippling, chiaroscuro. It shows in the ASCII.'],
          list: ['Figure Drawing', 'Renaissance Composition', 'Silverpoint']
        }
      ]
    },

    work: {
      cmd: 'work',
      title: 'WORK',
      path: '~/work',
      blurb: 'ps aux | grep career',
      cards: [
        {
          head: 'NORTHWIND',
          sub: 'Senior Software Engineer',
          meta: '2024 — present',
          badge: 'now',
          body: ['Remote / rendering & platform'],
          list: [
            'Designed and shipped the realtime rendering pipeline behind the editor.',
            'Cut p95 cold-start latency from 1.8s to 240ms across 14 services.',
            'Mentored four engineers; owned the frontend architecture review.'
          ],
          tags: ['TypeScript', 'Rust', 'WebGL', 'Postgres']
        },
        {
          head: 'HELIOGRAPH',
          sub: 'Full-Stack Engineer',
          meta: '2022 — 2024',
          badge: '2y',
          body: ['Hybrid / product & infra'],
          list: [
            'Built a multi-tenant analytics surface serving 40k daily sessions.',
            'Authored the internal component library still used company-wide.',
            'Ran the on-call rotation and halved paging volume in two quarters.'
          ],
          tags: ['React', 'Node.js', 'Redis', 'Terraform']
        },
        {
          head: 'ATELIER 9',
          sub: 'Creative Technologist',
          meta: '2021 — 2022',
          badge: 'contract',
          body: ['Studio / installations'],
          list: [
            'Interactive installations for three gallery exhibitions.',
            'Generative type systems and print-ready plotter output.',
            'Shader work, projection mapping, far too much soldering.'
          ],
          tags: ['GLSL', 'Three.js', 'Python', 'openFrameworks']
        },
        {
          head: 'SKILLS',
          sub: 'self-reported, honestly',
          meta: './skills.sh',
          badge: 'meter',
          bars: [
            { name: 'TypeScript / JS', value: 92 },
            { name: 'Systems (Rust/C)', value: 74 },
            { name: 'Graphics / Shaders', value: 81 },
            { name: 'Backend & Infra', value: 78 },
            { name: 'Design & Type', value: 86 },
            { name: 'ASCII Alchemy', value: 99 }
          ]
        }
      ]
    },

    projects: {
      cmd: 'projects',
      title: 'PROJECTS',
      path: '~/src',
      blurb: 'ls -la ~/src --sort=affection',
      cards: [
        {
          head: 'ORACLE',
          sub: 'local-first agent runtime',
          meta: 'rust',
          badge: 'v0.9',
          body: ['A sandboxed runtime for long-lived agents. Durable sessions, tool sandboxing, and a transcript format you can actually read.'],
          tags: ['Rust', 'WASM', 'SQLite'],
          links: [{ label: 'repo', href: 'https://github.com/' }, { label: 'demo', href: '#' }]
        },
        {
          head: 'VELLUM',
          sub: 'image to ascii compiler',
          meta: 'typescript',
          badge: 'v2.1',
          body: ['Converts raster art into hatched ASCII using Sobel-oriented glyph selection. The direct ancestor of the eye engine on this page.'],
          tags: ['TypeScript', 'Canvas', 'CLI'],
          links: [{ label: 'repo', href: 'https://github.com/' }, { label: 'docs', href: '#' }]
        },
        {
          head: 'CAMPANILE',
          sub: 'distributed job clock',
          meta: 'go',
          badge: 'v1.4',
          body: ['Exactly-once scheduling across regions with a 40-line consensus core. Survives partitions, clock skew, and interns.'],
          tags: ['Go', 'Raft', 'gRPC'],
          links: [{ label: 'repo', href: 'https://github.com/' }]
        },
        {
          head: 'PLOTTER',
          sub: 'generative pen drawings',
          meta: 'python',
          badge: 'wip',
          body: ['Constraint-based line art for an AxiDraw. Poisson sampling, flow fields, and a lot of ruined paper.'],
          tags: ['Python', 'SVG', 'Hardware'],
          links: [{ label: 'repo', href: 'https://github.com/' }]
        },
        {
          head: 'REREDOS',
          sub: 'shader study series',
          meta: 'glsl',
          badge: '12',
          body: ['Twelve raymarched altarpieces. Gothic tracery evaluated per-pixel at 60fps on integrated graphics.'],
          tags: ['GLSL', 'WebGL2'],
          links: [{ label: 'repo', href: 'https://github.com/' }]
        },
        {
          head: 'MARGINALIA',
          sub: 'annotation protocol',
          meta: 'crdt',
          badge: 'v0.3',
          body: ['A tiny CRDT for collaborative marginal notes. Offline-first, conflict-free, deliberately unfashionable.'],
          tags: ['CRDT', 'IndexedDB'],
          links: [{ label: 'repo', href: 'https://github.com/' }]
        }
      ]
    },

    creations: {
      cmd: 'creations',
      title: 'PERSONAL CREATIONS',
      path: '~/pix',
      blurb: 'the things nobody asked for',
      cards: [
        {
          head: 'ASCII EYE ENGINE',
          sub: 'the two eyes above you',
          meta: 'javascript',
          badge: 'live',
          body: ['A vector eye — lash line, iris, striations, highlights — rasterised into a supersampled buffer, box-filtered down to one value per character cell, then mapped through a glyph ramp with a Sobel pass that promotes edges to directional glyphs. Gaze, blink and saccade are just parameters, so it re-renders at 30fps and follows your cursor.'],
          tags: ['Canvas', 'Sobel', 'No deps'],
          links: [{ label: 'source', href: 'assets/js/eyes.js' }]
        },
        { art: 'assets/art/01.svg', head: 'ANNUNCIATION', sub: 'ink & gouache', meta: '2024' },
        { art: 'assets/art/02.svg', head: 'STUDY I', sub: 'silverpoint', meta: '2023' },
        { art: 'assets/art/03.svg', head: 'ORCHARD', sub: 'plotter pen', meta: '2024' },
        { art: 'assets/art/04.svg', head: 'REREDOS', sub: 'digital', meta: '2025' },
        { art: 'assets/art/05.svg', head: 'MADONNA', sub: 'charcoal', meta: '2022' },
        { art: 'assets/art/06.svg', head: 'TRACERY', sub: 'generative', meta: '2025' },
        { art: 'assets/art/07.svg', head: 'VESPERS', sub: 'oil study', meta: '2023' },
        { art: 'assets/art/08.svg', head: 'CODEX', sub: 'mixed media', meta: '2024' },
        {
          head: 'THE RICE ITSELF',
          sub: 'dotfiles',
          meta: 'hyprland',
          badge: 'cfg',
          body: ['Hyprland + waybar + foot + neovim, themed end to end. This website is the same colour scheme in a browser tab.'],
          tags: ['Hyprland', 'Waybar', 'Nvim'],
          links: [{ label: 'dotfiles', href: 'https://github.com/' }]
        }
      ]
    }
  },

  /* ---------------------------------------------------------- */
  whoami: [
    'Engineer, occasional draughtsman.',
    '',
    'I build interfaces with the patience of a copyist and the',
    'temperament of a compiler. A tiling window manager and a',
    'Renaissance panel want the same thing: strong structure,',
    'honest light, and no wasted marks.',
    '',
    'By day: rendering pipelines. By night: ricing.'
  ],

  interests: [
    'Ricing — hyprland, pywal, and the eternal bar rewrite',
    'Anime — mostly for the compositing and the line art',
    'Demoscene size-coding (4k intros, sizecoding.org)',
    'Typography, especially monospaced ligature crimes',
    'Long-distance walking as a debugging technique'
  ],

  now: [
    'Reading — The Craftsman, Richard Sennett',
    'Building — this eye engine, and a plotter driver that speaks G-code politely',
    'Learning — compositor internals, slowly'
  ]
};
