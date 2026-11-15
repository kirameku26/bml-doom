import { BMLBrowser, keyCodeToAribKey } from "web-bml";

const browser = new BMLBrowser({
    containerElement: document.querySelector("#screen"),
    mediaElement: document.querySelector("#media"),
    tabIndex: 0,
    log: { level: "error" },

    showErrorMessage(title, message) {
        console.error(`[BML] ${title}: ${message}`);
    },
});

const frame = document.querySelector("#tv-frame");
const screen = document.querySelector("#screen");

let bmlWidth = 960;
let bmlHeight = 540;

function resizeBML() {
    const availableWidth = frame.clientWidth;
    const availableHeight = frame.clientHeight;

    const scale = Math.min(
        availableWidth / bmlWidth,
        availableHeight / bmlHeight,
    );

    screen.style.width = `${bmlWidth}px`;
    screen.style.height = `${bmlHeight}px`;

    // Center the BML screen
    const offsetX = (availableWidth - bmlWidth * scale) / 2;
    const offsetY = (availableHeight - bmlHeight * scale) / 2;

    screen.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}


let statusObserver = null;

browser.addEventListener("load", (event) => {
    console.log("BML loaded:", event.detail);

    bmlWidth = event.detail.resolution.width;
    bmlHeight = event.detail.resolution.height;

    resizeBML();

    // Stop observing the previous BML document
    statusObserver?.disconnect();

    // Access the BML document inside web-bml
    const status = browser.content.documentElement
        .querySelector("#status");

    if (!status) {
        console.warn("[BML] Status element not found");
        return;
    }

    // Log BML statistics whenever they change
    statusObserver = new MutationObserver(() => {
        const value = status.textContent?.trim();

        if (value && value !== "Starting...") {
            console.log("[BML]", value);
        }
    });

    statusObserver.observe(status, {
        subtree: true,
        characterData: true,
        childList: true,
    });
});

window.addEventListener("resize", resizeBML);

resizeBML();

// Convert binary data to Base64
function toBase64(bytes) {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}

// Fetch a file from Vite's public directory
async function loadFile(path) {
    const response = await fetch(`${path}?t=${Date.now()}`);

    if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
    }

    return new Uint8Array(await response.arrayBuffer());
}

async function start() {
    // メインスレッドの長時間停止を検出
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.duration >= 80) {
                    console.warn("[LONG TASK]", {
                        duration: entry.duration.toFixed(1) + " ms",
                        startTime: entry.startTime.toFixed(1) + " ms",
                    });
                }
            }
        });

        observer.observe({ entryTypes: ["longtask"] });
    }

    let lastBmlImageUpdate = 0;
    let bmlImageUpdates = 0;

    const imageObserver = new MutationObserver((records) => {
        for (const record of records) {
            if (
                record.type !== "attributes" ||
                record.attributeName !== "src"
            ) {
                continue;
            }

            const image = record.target;

            if (
                !(image instanceof HTMLImageElement) ||
                !image.closest("object")
            ) {
                continue;
            }

            const now = performance.now();

            if (lastBmlImageUpdate !== 0) {
                const gap = now - lastBmlImageUpdate;

                if (gap > 150) {
                    console.warn("[BML IMAGE GAP]", {
                        gap: gap.toFixed(1) + " ms",
                        updates: bmlImageUpdates,
                    });
                }
            }

            bmlImageUpdates++;
            lastBmlImageUpdate = now;
        }
    });

    imageObserver.observe(browser.content.documentElement, {
        subtree: true,
        attributes: true,
        attributeFilter: ["src"],
    });

    console.log("[BML IMAGE OBSERVER] started");

    let previousUpdates = 0;

    setInterval(() => {
        const updatesPerSecond = bmlImageUpdates - previousUpdates;

        previousUpdates = bmlImageUpdates;

        console.log("[BML IMAGE UPDATES]", updatesPerSecond, "updates/sec");
    }, 1000);

    const response = await fetch("/startup.bml?t=" + Date.now());

    if (!response.ok) {
        throw new Error("startup.bml not found");
    }

    const bmlData = new Uint8Array(await response.arrayBuffer());

    function toBase64(bytes) {
        let binary = "";

        for (let i = 0; i < bytes.length; i += 16384) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
        }

        return btoa(binary);
    }

    // Dynamically generated framebuffer
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("Canvas 2D unavailable");
    }

    // Load the real DOOM engine
    const doomModuleUrl = new URL("/doom/doom.mjs", window.location.origin)
        .href;

    const { default: createDoom } = await import(
        /* @vite-ignore */ doomModuleUrl
    );

    const doom = await createDoom({
        locateFile: (filename) => `/doom/${filename}`,
        print: console.log,
        printErr: console.error,
    });

    // Initialize DOOM
    await doom._doom_init();

    console.log("DOOM engine initialized");

    // DOOM framebuffer: 320x200
    const doomCanvas = document.createElement("canvas");
    doomCanvas.width = 320;
    doomCanvas.height = 200;

    const doomCtx = doomCanvas.getContext("2d");

    if (!doomCtx) {
        throw new Error("DOOM Canvas 2D unavailable");
    }

    const doomImage = doomCtx.createImageData(320, 200);

    // Unified DOOM input handling is configured below.

    let frameNumber = 0;
    let imageVersion = 0;

    let encoding = false;
    let sent = 0;
    let skipped = 0;
    let lastReport = performance.now();

    // JPEG encoding is performed in jpeg-worker.js, not on the main thread.

    const jpegWorker = new Worker(
        new URL("./jpeg-worker.js", import.meta.url),
        { type: "module" },
    );

    let nextFrameId = 0;
    const pendingFrames = new Map();

    let timingLogCount = 0;
    jpegWorker.onmessage = ({ data }) => {
        const pending = pendingFrames.get(data.id);
        if (!pending) return;

        pendingFrames.delete(data.id);

        const roundTrip = performance.now() - pending.started;
        const workerTime = data.stats?.total;

        if (++timingLogCount <= 5 || roundTrip > 80) {
            console.warn("[WORKER TIMING]", {
                roundTrip: roundTrip.toFixed(1),
                workerTime: workerTime?.toFixed(1),
                otherWait:
                    workerTime === undefined
                        ? undefined
                        : (roundTrip - workerTime).toFixed(1),
                focused: document.hasFocus(),
            });
        }

        if (data.error) {
            pending.reject(new Error(data.error));
        } else {
            pending.resolve(new Uint8Array(data.buffer));
        }
    };

    jpegWorker.onerror = (event) => {
        for (const pending of pendingFrames.values()) {
            pending.reject(new Error(event.message));
        }
        pendingFrames.clear();
    };

    function encodeFrame(pixels) {
        const id = ++nextFrameId;

        return new Promise((resolve, reject) => {
            pendingFrames.set(id, {
                resolve,
                reject,
                started: performance.now(),
            });

            jpegWorker.postMessage({ id, buffer: pixels.buffer }, [
                pixels.buffer,
            ]);
        });
    }

    // generateJPEG() の中

    async function generateJPEG() {
        const t0 = performance.now();

        await doom._doom_step();

        const t1 = performance.now();

        if (t1 - t0 > 50) {
            console.warn("[SLOW DOOM]", (t1 - t0).toFixed(1), "ms");
        }

        const ptr = doom._doom_framebuffer();

        if (!ptr) {
            throw new Error("DOOM framebuffer unavailable");
        }

        const source = doom.HEAPU8;
        const pixels = new Uint8ClampedArray(320 * 200 * 4);

        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = source[ptr + i + 2];
            pixels[i + 1] = source[ptr + i + 1];
            pixels[i + 2] = source[ptr + i];
            pixels[i + 3] = 255;
        }

        const t2 = performance.now();

        const jpeg = await encodeFrame(pixels);

        const t3 = performance.now();

        if (t3 - t2 > 100) {
            console.warn("[SLOW WORKER]", (t3 - t2).toFixed(1), "ms");
        }

        return jpeg;
    }

    const BENCHMARK_ONLY = false;
    let firstFrameSent = false;
    // Send a newly generated framebuffer to BML
    async function sendFrame() {
        if (encoding) {
            skipped++;
            return;
        }

        encoding = true;

        try {
            const jpeg = await generateJPEG();

            if (BENCHMARK_ONLY) {
                if (firstFrameSent) {
                    return;
                }

                firstFrameSent = true;
            }

            imageVersion = (imageVersion % 255) + 1;

            // Announce updated module version
            browser.emitMessage({
                type: "moduleListUpdated",
                componentId: 0x40,
                dataEventId: 0,
                modules: [
                    {
                        id: 0,
                        version: 1,
                        size: bmlData.length,
                    },
                    {
                        id: 1,
                        version: imageVersion,
                        size: jpeg.length,
                    },
                ],
            });

            // Update only image module 1
            browser.emitMessage({
                type: "moduleDownloaded",
                componentId: 0x40,
                moduleId: 1,
                version: imageVersion,
                dataEventId: 0,
                files: [
                    {
                        contentLocation: "live.jpg",
                        contentType: {
                            type: "image",
                            originalType: "image",
                            subtype: "jpeg",
                            originalSubtype: "jpeg",
                            parameters: [],
                        },
                        dataBase64: toBase64(jpeg),
                    },
                ],
            });

            sent++;

            const now = performance.now();
            const elapsed = now - lastReport;

            if (elapsed >= 1000) {
                console.log(
                    `Generated/Sent: ${((sent * 1000) / elapsed).toFixed(
                        1,
                    )} FPS, Skipped: ${skipped}`,
                );
                sent = 0;
                skipped = 0;
                lastReport = now;
            }
        } finally {
            encoding = false;
        }
    }

    // Program information
    browser.emitMessage({
        type: "programInfo",
        originalNetworkId: 1,
        transportStreamId: 1,
        serviceId: 1,
        eventId: 1,
        eventName: "DOOM Dynamic Framebuffer Test",
        startTimeUnixMillis: Date.now(),
        durationSeconds: 3600,
        indefiniteDuration: false,
        networkId: 1,
    });

    browser.emitMessage({
        type: "pmt",
        components: [
            {
                pid: 0x100,
                componentId: 0x40,
                streamType: 0x0d,
                dataComponentId: 0x000c,
            },
        ],
    });

    // Prepare the first JPEG before loading BML
    await sendFrame();

    // Download the startup BML (module 0)
    browser.emitMessage({
        type: "moduleDownloaded",
        componentId: 0x40,
        moduleId: 0,
        version: 1,
        dataEventId: 0,
        files: [
            {
                contentLocation: "startup.bml",
                contentType: {
                    type: "text",
                    originalType: "text",
                    subtype: "x-arib-bml",
                    originalSubtype: "X-arib-bml",
                    parameters: [],
                },
                dataBase64: toBase64(bmlData),
            },
        ],
    });

    // Generate and transmit at up to 20 FPS
    setInterval(() => {
        sendFrame().catch(console.error);
    }, 50);

    console.log("Dynamic JPEG streaming started");

    // ARIB remote key -> DOOM key
    const remoteToDoom = new Map([
        [1, 0xad], // Up
        [2, 0xaf], // Down
        [3, 0xac], // Left
        [4, 0xae], // Right
        [18, 13], // Enter
        [19, 27], // Back -> Escape
        [22, 0xa3], // Red -> Fire
        [21, 0xa2], // Blue -> Use
        [23, 0xb6], // Green -> Shift
        [24, 0xb8], // Yellow -> Alt
    ]);

    const pressedKeys = new Set();

    function pressDoom(key) {
        // Ignore duplicate keydown events while this key is held.
        if (pressedKeys.has(key)) return;

        pressedKeys.add(key);
        doom._doom_key(1, key);
    }

    function resolveDoomKey(keyName) {
        // Additional physical keyboard keys
        if (keyName === "Escape") return 27;
        if (keyName === " ") return 0xa2;
        if (keyName === "Control") return 0xa3;
        if (keyName === "Shift") return 0xb6;
        if (keyName === "Alt") return 0xb8;

        const arib = keyCodeToAribKey(keyName);

        // Remote numeric buttons 0-9
        if (arib >= 5 && arib <= 14) {
            return 48 + (arib - 5);
        }

        return remoteToDoom.get(arib) ?? null;
    }

    function releaseDoom(key) {
        if (!pressedKeys.has(key)) return;

        pressedKeys.delete(key);
        doom._doom_key(0, key);
    }

    // Physical keyboard

    window.addEventListener(
        "keydown",
        (event) => {
            if (event.metaKey) return;

            const key = resolveDoomKey(event.key);
            if (key === null) return;

            event.preventDefault();
            event.stopPropagation();

            // キーボードの自動リピートだけ無視
            if (event.repeat) return;

            pressDoom(key);
        },
        true,
    );

    window.addEventListener(
        "keyup",
        (event) => {
            const key = resolveDoomKey(event.key);
            if (key === null) return;

            event.preventDefault();
            event.stopPropagation();

            releaseDoom(key);
        },
        true,
    );

    // Release held keys when the window loses focus
    window.addEventListener("blur", () => {
        for (const key of pressedKeys) {
            doom._doom_key(0, key);
        }

        pressedKeys.clear();
    });

    // On-screen remote controller
    for (const button of document.querySelectorAll("[data-key]")) {
        const keyName = button.dataset.key;
        const doomKey = resolveDoomKey(keyName);

        if (doomKey === null) {
            // Unmapped buttons continue to control BML
            button.addEventListener("click", () => {
                const arib = keyCodeToAribKey(keyName);
                if (arib === -1) return;

                browser.content.processKeyDown(arib);
                browser.content.processKeyUp(arib);
            });

            continue;
        }

        button.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;

            event.preventDefault();
            button.setPointerCapture(event.pointerId);

            pressDoom(doomKey);
        });

        button.addEventListener("pointerup", () => {
            releaseDoom(doomKey);
        });

        button.addEventListener("pointercancel", () => {
            releaseDoom(doomKey);
        });

        button.addEventListener("lostpointercapture", () => {
            releaseDoom(doomKey);
        });
    }

    let lastCheck = performance.now();

    setInterval(() => {
        const now = performance.now();
        const delay = now - lastCheck - 100;

        if (delay > 100 && document.visibilityState === "visible") {
            console.warn("[MAIN THREAD LAG]", {
                delay: delay.toFixed(1) + " ms",
                focused: document.hasFocus(),
            });
        }

        lastCheck = now;
    }, 100);
}

// Keyboard input
document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.repeat) return;

    const code = keyCodeToAribKey(event.key);
    if (code === -1) return;

    event.preventDefault();
    browser.content.processKeyDown(code);
});

document.addEventListener("keyup", (event) => {
    if (event.defaultPrevented) return;

    const code = keyCodeToAribKey(event.key);
    if (code === -1) return;

    event.preventDefault();
    browser.content.processKeyUp(code);
});

start().catch(console.error);
