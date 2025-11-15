# Branding icon (swoop.ico)

Place `swoop.ico` in this folder to brand the installers and shortcuts.

Recommended source: use the SWOOP heading from your UI (e.g., Figma SVG) or a logo PNG.

Quick creation with ImageMagick (pick one source):

```powershell
# From an SVG logo
magick convert public\figma\*.svg -resize 256x256 -background none -define icon:auto-resize=256,128,64,48,32,16 windows-helper\installer\branding\swoop.ico

# From a PNG (e.g., origami or printer icon)
magick convert public\images\origami.png -resize 256x256 -background none -define icon:auto-resize=256,128,64,48,32,16 windows-helper\installer\branding\swoop.ico
```

If `swoop.ico` is missing, installers still build but will show the default icon.

