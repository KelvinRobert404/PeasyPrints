# Branding icon

Place `swoop.ico` here for the installer UI and app shortcuts. The packaging script will auto-generate it from the newest `public/figma/*.svg` if ImageMagick is available.

Recommended source: use the SWOOP heading from your UI (e.g., Figma SVG) or a logo PNG.

Quick creation with ImageMagick (pick one source):

```powershell
# From SVG (manual)
magick convert .\logo.svg -resize 256x256 -background none -define icon:auto-resize=256,128,64,48,32,16 .\swoop.ico

# From a PNG (e.g., origami or printer icon)
magick convert public\images\origami.png -resize 256x256 -background none -define icon:auto-resize=256,128,64,48,32,16 windows-helper\installer\branding\swoop.ico
```

If `swoop.ico` is missing, installers still build but will show the default icon.

