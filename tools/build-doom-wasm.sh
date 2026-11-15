
#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/vendor/doomgeneric/doomgeneric"

mkdir -p "$root/public/doom"

# Obtain the original source list
read -ra objects <<< "$(
  sed -n 's/^SRC_DOOM = //p' "$src/Makefile"
)"

sources=()

for obj in "${objects[@]}"; do
  # Replace the X11 backend with our BML backend
  if [[ "$obj" == "doomgeneric_xlib.o" ]]; then
    continue
  fi

  sources+=("$src/${obj%.o}.c")
done

emcc \
  -O2 \
  -D_DEFAULT_SOURCE \
  -DDOOMGENERIC_RESX=320 \
  -DDOOMGENERIC_RESY=200 \
  -I"$src" \
  "${sources[@]}" \
  "$root/tools/doomgeneric_bml.c" \
  --preload-file \
  "$root/assets/freedoom1.wad@/freedoom1.wad" \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=1 \
  --no-entry \
  -sENVIRONMENT=web,worker \
  -sALLOW_MEMORY_GROWTH=1 \
  -sASSERTIONS=1 \
  -sEXPORTED_FUNCTIONS='["_doom_init","_doom_step","_doom_framebuffer","_doom_key"]' \
  -sEXPORTED_RUNTIME_METHODS='["HEAPU8"]' \
  -o "$root/public/doom/doom.mjs"

echo "DOOM WebAssembly build complete"
