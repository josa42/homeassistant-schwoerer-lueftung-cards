#!/usr/bin/env bash
# Rasterises the frames written by make-preview.mjs into assets/<card>.gif,
# one GIF per subdirectory. Each carries its own render width, because the
# cards have different viewBox widths and should render at the same scale.
# Needs rsvg-convert (librsvg) and magick (ImageMagick) on PATH.
set -e
cd "$(dirname "$0")/.."

command -v rsvg-convert >/dev/null || { echo "rsvg-convert not found (brew install librsvg)"; exit 1; }
command -v magick >/dev/null || { echo "magick not found (brew install imagemagick)"; exit 1; }
[ -d .preview-frames ] || { echo "no frames; run: node scripts/make-preview.mjs"; exit 1; }

mkdir -p assets

for dir in .preview-frames/*/; do
    name=$(basename "$dir")
    width=$(cat "${dir}width.txt")

    for f in "${dir}"f*.svg; do
        rsvg-convert -w "$width" -b white "$f" -o "${f%.svg}.png"
    done

    # 8.33ms delay is 12fps, matching the frame count make-preview.mjs computes.
    magick -delay 8.33 -loop 0 "${dir}"f*.png \
        -layers OptimizePlus -colors 96 "assets/${name}.gif"

    echo "wrote assets/${name}.gif ($(du -h "assets/${name}.gif" | cut -f1))"
done
