# Tile Atlases

Map tiles are grouped by Tiled layer purpose. Legacy top-down atlases use a
128x128 grid. Isometric tiles can use their own map grid sizes.

Transparent overlay atlases use PNG alpha so they can be layered in Tiled
without baking in a background.

`grass.png` is the current default isometric ground atlas:
- 18 frames
- frame size `128x64`
- atlas layout `3 columns x 6 rows`
- no spacing between frames (`spacing=0`)
- atlas size `384x384` (both dimensions are multiples of 64)
- imported from `Floor_Grass_02-128x64.png` with magenta colorkey converted to alpha

`grass-basic.png` remains the deterministic base source tile used to derive
all `grass.png` variants while preserving exact diamond geometry and angle.

`brick.png` is an interior isometric floor atlas:
- 18 frames
- frame size `128x64`
- atlas layout `3 columns x 6 rows`
- no spacing between frames (`spacing=0`)
- atlas size `384x384` (both dimensions are multiples of 64)
- imported from `Floor_Brick_02-128x64.png` with magenta colorkey converted to alpha

`walls.png` is a fixed perimeter-wall atlas:
- 2 frames
- frame size `256x512`
- atlas layout `2 columns x 1 row`
- no spacing between frames (`spacing=0`)
- atlas size `512x512`
- source frames: `wall_E.png`, `wallCurve_S.png`
