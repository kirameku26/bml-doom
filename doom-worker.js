// DOOM WASM worker: simulation and BGRA -> RGBA conversion only.
// BML data-carousel emission and keyboard events remain in main.js.

const WIDTH = 320;
const HEIGHT = 200;
const BYTES_PER_PIXEL = 4;
let doom = null;

async function initialize() {
    const moduleUrl = new URL("/doom/doom.mjs", self.location.origin).href;
    const { default: createDoom } = await import(
        /* @vite-ignore */ moduleUrl
    );

    doom = await createDoom({
        locateFile: (filename) =>
            new URL(`/doom/${filename}`, self.location.origin).href,
        print: (message) => self.postMessage({ type: "stdout", message }),
        printErr: (message) => self.postMessage({ type: "stderr", message }),
    });

    await doom._doom_init();
    self.postMessage({ type: "ready" });
}

async function renderFrame(id) {
    if (!doom) throw new Error("DOOM is not initialized");

    const t0 = performance.now();
    await doom._doom_step();
    const t1 = performance.now();

    const ptr = doom._doom_framebuffer();
    if (!ptr) throw new Error("DOOM framebuffer unavailable");

    const src = doom.HEAPU8;
    const byteCount = WIDTH * HEIGHT * BYTES_PER_PIXEL;
    if (ptr + byteCount > src.length) {
        throw new Error("DOOM framebuffer is out of WASM memory bounds");
    }

    const pixels = new Uint8ClampedArray(byteCount);
    // The original implementation exposes BGRA; JPEG worker expects RGBA.
    for (let i = 0; i < byteCount; i += BYTES_PER_PIXEL) {
        pixels[i] = src[ptr + i + 2];
        pixels[i + 1] = src[ptr + i + 1];
        pixels[i + 2] = src[ptr + i];
        pixels[i + 3] = 255;
    }
    const t2 = performance.now();

    self.postMessage(
        {
            type: "frame",
            id,
            buffer: pixels.buffer,
            doomMs: t1 - t0,
            conversionMs: t2 - t1,
        },
        [pixels.buffer],
    );
}

self.onmessage = async ({ data }) => {
    try {
        switch (data.type) {
            case "init":
                await initialize();
                break;
            case "step":
                await renderFrame(data.id);
                break;
            case "key":
                if (doom) doom._doom_key(data.pressed ? 1 : 0, data.key);
                break;
        }
    } catch (error) {
        self.postMessage({
            type: data.type === "init" ? "fatal" : "error",
            id: data.id,
            message: error instanceof Error ? (error.stack || error.message) : String(error),
        });
    }
};
