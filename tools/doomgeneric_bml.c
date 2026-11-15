
#include <stdint.h>
#include <emscripten/emscripten.h>

#include "doomgeneric.h"
#include "doomkeys.h"

// Input queue
#define QUEUE_SIZE 64

static uint16_t keys[QUEUE_SIZE];
static int read_pos = 0;
static int write_pos = 0;

void DG_Init(void) {
    // No SDL window is needed
}

void DG_DrawFrame(void) {
    // Pixels are already in DG_ScreenBuffer
}

void DG_SleepMs(uint32_t ms) {
    // Initial experiment: non-blocking stub
    (void)ms;
}

uint32_t DG_GetTicksMs(void) {
    return (uint32_t)emscripten_get_now();
}

void DG_SetWindowTitle(const char *title) {
    (void)title;
}

int DG_GetKey(int *pressed, unsigned char *key) {
    if (read_pos == write_pos) {
        return 0;
    }

    uint16_t event = keys[read_pos];
    read_pos = (read_pos + 1) % QUEUE_SIZE;

    *pressed = (event >> 8) & 1;
    *key = event & 255;

    return 1;
}

EMSCRIPTEN_KEEPALIVE
void doom_key(int pressed, int key) {
    int next = (write_pos + 1) % QUEUE_SIZE;

    if (next == read_pos) {
        return;
    }

    keys[write_pos] =
        ((pressed ? 1 : 0) << 8) | (key & 255);

    write_pos = next;
}

EMSCRIPTEN_KEEPALIVE
void doom_init(void) {
    static char arg0[] = "doomgeneric";
    static char arg1[] = "-iwad";
    static char arg2[] = "/freedoom1.wad";
    static char arg3[] = "-nosound";
    static char arg4[] = "-nomusic";
    static char arg5[] = "-nogui";

    static char *argv[] = {
        arg0, arg1, arg2, arg3,
        arg4, arg5, NULL
    };

    doomgeneric_Create(6, argv);
}

EMSCRIPTEN_KEEPALIVE
void doom_step(void) {
    doomgeneric_Tick();
}

EMSCRIPTEN_KEEPALIVE
uintptr_t doom_framebuffer(void) {
    return (uintptr_t)DG_ScreenBuffer;
}
