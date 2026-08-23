/* =============================================================
   content.js — EDIT THIS FILE to make the site yours.
   Everything the page renders (except the ASCII engine itself)
   is declared here. No build step, no framework.
   ============================================================= */
window.SITE = {

  /* ---------------------------------------------------------- */
  identity: {
    name: 'AMIR NAFISSI',
    handle: 'amir',
    host: 'scriptorium',
    role: 'Software Engineer / Systems & Interfaces',
    tagline: 'Illuminated manuscripts, rendered in 7-bit.',
    location: 'Earth // UTC+0',
    email: 'amirnafissi700@gmail.com',
    links: [
      { label: 'github', href: 'https://github.com/' },
      { label: 'linkedin', href: 'https://linkedin.com/in/' },
      { label: 'email', href: 'mailto:amirnafissi700@gmail.com' }
    ]
  },

  /* ---------------------------------------------------------- */
  education: [
    {
      degree: 'M.Sc. Computer Science',
      institution: 'Institute of Technology',
      dates: '2022 — 2024',
      note: 'Thesis: Perceptual compression of generative image latents.',
      coursework: [
        'Distributed Systems',
        'Computer Graphics & Rendering',
        'Machine Learning Theory',
        'Compilers & Program Analysis'
      ]
    },
    {
      degree: 'B.Sc. Software Engineering',
      institution: 'University of the Republic',
      dates: '2018 — 2022',
      note: 'Graduated with honours. Founded the campus demoscene club.',
      coursework: [
        'Data Structures & Algorithms',
        'Operating Systems',
        'Numerical Methods',
        'Human-Computer Interaction'
      ]
    },
    {
      degree: 'Certificate — Classical Drawing',
      institution: 'Atelier of Fine Arts',
      dates: '2020',
      note: 'Cross-hatching, stippling, chiaroscuro. It shows.',
      coursework: ['Figure Drawing', 'Renaissance Composition', 'Silverpoint']
    }
  ],

  /* ---------------------------------------------------------- */
  experience: [
    {
      company: 'NORTHWIND',
      role: 'Senior Software Engineer',
      dates: '2024 — present',
      location: 'Remote',
      duties: [
        'Designed and shipped the realtime rendering pipeline behind the editor.',
        'Cut p95 cold-start latency from 1.8s to 240ms across 14 services.',
        'Mentored four engineers; owned the frontend architecture review process.'
      ],
      stack: ['TypeScript', 'Rust', 'WebGL', 'Postgres']
    },
    {
      company: 'HELIOGRAPH',
      role: 'Full-Stack Engineer',
      dates: '2022 — 2024',
      location: 'Hybrid',
      duties: [
        'Built a multi-tenant analytics surface serving 40k daily sessions.',
        'Authored the internal component library still used company-wide.',
        'Ran the on-call rotation and halved paging volume in two quarters.'
      ],
      stack: ['React', 'Node.js', 'Redis', 'Terraform']
    },
    {
      company: 'ATELIER 9',
      role: 'Creative Technologist (contract)',
      dates: '2021 — 2022',
      location: 'Studio',
      duties: [
        'Interactive installations for three gallery exhibitions.',
        'Generative type systems and print-ready plotter output.',
        'Shader work, projection mapping, far too much soldering.'
      ],
      stack: ['GLSL', 'Three.js', 'Python', 'openFrameworks']
    }
  ],

  /* Skill bars — value is 0..100 -------------------------------- */
  skills: [
    { name: 'TypeScript / JS', value: 92 },
    { name: 'Systems (Rust/C)', value: 74 },
    { name: 'Graphics / Shaders', value: 81 },
    { name: 'Backend & Infra', value: 78 },
    { name: 'Design & Type', value: 86 },
    { name: 'ASCII Alchemy', value: 99 }
  ],

  /* ---------------------------------------------------------- */
  projects: [
    {
      title: 'ORACLE',
      subtitle: 'local-first agent runtime',
      icon: 'eye',
      desc: 'A sandboxed runtime for long-lived agents. Durable sessions, tool sandboxing, and a transcript format you can actually read.',
      tags: ['Rust', 'WASM', 'SQLite'],
      links: [
        { cmd: 'view_project --repo=github', href: 'https://github.com/' },
        { cmd: 'open --live', href: '#' }
      ]
    },
    {
      title: 'VELLUM',
      subtitle: 'image → ascii compiler',
      icon: 'scroll',
      desc: 'Converts raster art into hatched ASCII using Sobel-oriented glyph selection. Powers the background of this very page.',
      tags: ['TypeScript', 'Canvas', 'CLI'],
      links: [
        { cmd: 'view_project --repo=github', href: 'https://github.com/' },
        { cmd: 'read --docs', href: '#' }
      ]
    },
    {
      title: 'CAMPANILE',
      subtitle: 'distributed job clock',
      icon: 'tower',
      desc: 'Exactly-once scheduling across regions with a 40-line consensus core. Survives partitions, clock skew, and interns.',
      tags: ['Go', 'Raft', 'gRPC'],
      links: [{ cmd: 'view_project --repo=github', href: 'https://github.com/' }]
    },
    {
      title: 'PLOTTER',
      subtitle: 'generative pen drawings',
      icon: 'pen',
      desc: 'Constraint-based line art for an AxiDraw. Poisson sampling, flow fields, and a lot of ruined paper.',
      tags: ['Python', 'SVG', 'Hardware'],
      links: [
        { cmd: 'view_project --repo=github', href: 'https://github.com/' },
        { cmd: 'view_gallery', href: '#gallery' }
      ]
    },
    {
      title: 'REREDOS',
      subtitle: 'shader study series',
      icon: 'arch',
      desc: 'Twelve raymarched altarpieces. Gothic tracery evaluated per-pixel at 60fps on integrated graphics.',
      tags: ['GLSL', 'WebGL2'],
      links: [{ cmd: 'view_project --repo=github', href: 'https://github.com/' }]
    },
    {
      title: 'MARGINALIA',
      subtitle: 'annotation protocol',
      icon: 'quill',
      desc: 'A tiny CRDT for collaborative marginal notes. Offline-first, conflict-free, deliberately unfashionable.',
      tags: ['CRDT', 'IndexedDB'],
      links: [{ cmd: 'view_project --repo=github', href: 'https://github.com/' }]
    }
  ],

  /* ---------------------------------------------------------- */
  context: {
    whoami: [
      'Engineer, occasional draughtsman.',
      'I build interfaces with the patience of a copyist and the',
      'temperament of a compiler. Renaissance panels and terminal',
      'emulators want the same thing: strong structure, honest light,',
      'and no wasted marks.'
    ],
    interests: [
      'Quattrocento panel painting & the economics of pigment',
      'Demoscene size-coding (4k intros, sizecoding.org)',
      'Typography, especially monospaced ligature crimes',
      'Long-distance walking as a debugging technique',
      'Field recording and tape saturation'
    ],
    specs: [
      ['host', 'scriptorium'],
      ['os', 'human v31 (stable)'],
      ['kernel', 'caffeine 6.2.0-generic'],
      ['shell', 'zsh + far too many aliases'],
      ['editor', 'neovim'],
      ['uptime', 'see education section'],
      ['locale', 'Earth // UTC+0'],
      ['status', 'open to interesting problems']
    ],
    now: [
      'Reading — The Craftsman, Richard Sennett',
      'Building — a plotter driver that speaks G-code politely',
      'Learning — Byzantine iconography, slowly'
    ]
  },

  /* ---------------------------------------------------------- */
  /* The ONLY non-ASCII elements on the page. Swap the `src`
     values for your own files in assets/art/.                   */
  gallery: [
    { src: 'assets/art/01.svg', title: 'ANNUNCIATION', meta: 'ink & gouache · 2024', span: 2 },
    { src: 'assets/art/02.svg', title: 'STUDY I', meta: 'silverpoint · 2023', span: 1 },
    { src: 'assets/art/03.svg', title: 'ORCHARD', meta: 'plotter pen · 2024', span: 1 },
    { src: 'assets/art/04.svg', title: 'REREDOS', meta: 'digital · 2025', span: 2 },
    { src: 'assets/art/05.svg', title: 'MADONNA', meta: 'charcoal · 2022', span: 1 },
    { src: 'assets/art/06.svg', title: 'TRACERY', meta: 'generative · 2025', span: 1 },
    { src: 'assets/art/07.svg', title: 'VESPERS', meta: 'oil study · 2023', span: 1 },
    { src: 'assets/art/08.svg', title: 'CODEX', meta: 'mixed media · 2024', span: 1 }
  ]
};
