#!/bin/bash
# Simple script to create placeholder icons using ImageMagick or sips

SIZE192=192
SIZE512=512

# Try ImageMagick first
if command -v convert &> /dev/null; then
    convert -size ${SIZE192}x${SIZE192} xc:#0b84ff -fill white -draw "roundrectangle 24,24 168,168 24,24" -fill "#0b84ff" -pointsize 64 -gravity center -annotate +0+0 "EPS" icon-192.png
    convert -size ${SIZE512}x${SIZE512} xc:#0b84ff -fill white -draw "roundrectangle 64,64 448,448 64,64" -fill "#0b84ff" -pointsize 170 -gravity center -annotate +0+0 "EPS" icon-512.png
    echo "Icons created with ImageMagick"
    exit 0
fi

# Try sips (macOS)
if command -v sips &> /dev/null; then
    # Create a simple colored square (sips is limited)
    echo "Note: sips has limited capabilities. Please use create-icons.html in a browser instead."
    exit 1
fi

echo "No image tools found. Please:"
echo "1. Open create-icons.html in a browser"
echo "2. Click the download buttons to save the icons"
echo "3. Or install ImageMagick: brew install imagemagick"
