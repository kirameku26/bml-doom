# bml-doom

Run the original DOOM engine in WebAssembly and display its framebuffer inside a simulated BML (Broadcast Markup Language) environment.

This project combines [doomgeneric](https://github.com/ozkl/doomgeneric), [web-bml](https://github.com/otya128/web-bml), and [Freedoom](https://freedoom.github.io/).

## Overview

bml-doom is an experiment in displaying an interactive DOOM game inside a BML screen.

The DOOM engine runs as WebAssembly in the host browser. Its framebuffer is converted into JPEG images and delivered to the BML emulator through simulated data-carousel module updates.

**DOOM does not execute inside the BML interpreter itself.** BML is responsible for displaying the generated images.

## Features

- Original DOOM engine running through WebAssembly
- BML framebuffer display using JPEG images
- Approximately 20 FPS target frame delivery
- JPEG encoding in a Web Worker
- Keyboard and on-screen remote control support
- Optimized JPEG handling for live DOOM frames

## Requirements

- Node.js
- pnpm
- Emscripten (`emcc`)
- A modern browser with WebAssembly and OffscreenCanvas support
- doomgeneric source code
- Freedoom Phase 1 (`freedoom1.wad`)

## Building and Running

Install dependencies:

```bash
pnpm install
```

Place the doomgeneric sources in `vendor/doomgeneric/` and the Freedoom WAD at `assets/freedoom1.wad`.

Build the DOOM WebAssembly module:

```bash
./tools/build-doom-wasm.sh
```

Generate the BML document:

```bash
node tools/convert.mjs
```

Start the development server:

```bash
pnpm exec vite
```

Open the local URL displayed by Vite.

## How It Works

```text
DOOM Engine (WebAssembly)
           |
           v
    RGBA Framebuffer
           |
           v
       Web Worker
           |
           v
      JPEG Encoding
           |
           v
   Data Carousel Emulation
           |
           v
        web-bml
           |
           v
       BML Screen
```

Keyboard and remote-control input is forwarded to the DOOM engine.

The project applies a local patch to web-bml to bypass its standard JPEG color conversion for the live DOOM framebuffer.

## License

This project's original code is intended to be distributed under the GNU General Public License version 2 or later (GPL-2.0-or-later), subject to compatibility with all incorporated source files.

Third-party components retain their own licenses:

| Component | License |
|---|---|
| DOOM engine | GPL-2.0 family |
| doomgeneric | GPL-2.0 family |
| web-bml | MIT |
| Freedoom assets | BSD-3-Clause |

See `LICENSE`, the original third-party license notices, and the upstream repositories for details.

This project is an independent experiment and is not affiliated with or endorsed by the original software authors.