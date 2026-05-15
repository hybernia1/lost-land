# Tile Atlases

Map tiles are grouped by Tiled layer purpose. Legacy top-down atlases use a
128x128 grid. Isometric tiles can use their own map grid sizes.

Transparent overlay atlases use PNG alpha so they can be layered in Tiled
without baking in a background.

`trees.png` is a freeform decor/tree atlas:
- 6 frames (`3x2` grid; no duplicates)
- frame size `256x256`
- atlas layout `3 columns x 2 rows`
- no spacing between frames (`spacing=0`)
- atlas size `768x512`
- source image extracted from `C:\Users\nikol\Desktop\stromecky.png` (6-tree magenta sheet)
- background removal uses magenta keying plus boundary cleanup to produce real alpha in branch gaps before atlas packing

`bush.png` is a freeform decor/bush atlas:
- 6 frames (`3x2` grid)
- frame size `256x256`
- atlas layout `3 columns x 2 rows`
- no spacing between frames (`spacing=0`)
- atlas size `768x512`
- source image extracted from `C:\Users\nikol\Desktop\krovi.png` (6-bush magenta sheet)
- background removal uses the same magenta keying and boundary cleanup as `trees.png`

`rocks.png` is a freeform decor/rock atlas:
- 6 frames (`3x2` grid)
- frame size `256x256`
- atlas layout `3 columns x 2 rows`
- no spacing between frames (`spacing=0`)
- atlas size `768x512`
- source image extracted from `C:\Users\nikol\Desktop\rocks.png` (6-rock magenta sheet)
- background removal uses magenta keying with boundary cleanup to keep clean transparency

`water.png` is a freeform water/decor atlas:
- 16 frames (`4x4` grid)
- frame size `256x128`
- atlas layout `4 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `1024x512`
- source image copied from `C:\Users\nikol\Desktop\path water.png`
- restyled from the matching `roads.png` shape/lighting reference into a no-outline water palette while preserving the atlas grid and tile positions
- 2026-05-14 palette pass shifted the water from bright cyan to a quieter blue-green while preserving the exact alpha mask, frame grid, and atlas size

`nature-blocks.png` is an isometric block-style terrain atlas:
- 20 frames (`5x4` grid; first 19 slots used, last slot left transparent)
- frame size `128x128`
- atlas layout `5 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `640x512`
- source images copied from `C:\Users\nikol\Desktop\iso grass\*.png`, then normalized into fixed `128x128` cells while preserving proportions

`roads.png` is a freeform isometric dirt-road atlas:
- 16 frames (`4x4` grid)
- frame size `256x128`
- atlas layout `4 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `1024x512`
- source image copied from `C:\Users\nikol\Desktop\path dirt2.png`
- restyled to a warmer no-outline dirt palette while preserving the atlas grid and tile positions
- 2026-05-14 palette pass warmed the road pixels from cold stone gray to muted dirt brown while preserving the exact alpha mask, frame grid, and atlas size

`fence.png` is a freeform isometric fence/wall atlas:
- 56 frames (`8x7` grid)
- frame size `128x256`
- atlas layout `8 columns x 7 rows`
- no spacing between frames (`spacing=0`)
- atlas size `1024x1792`
- source images copied from `C:\Users\nikol\Desktop\fence\*.png`
- source frames were normalized from `256x512` to half-size `128x256` while preserving tile proportions
- 2026-05-14 palette pass darkened the atlas from bright beige masonry toward muted timber/earth tones so the palisade reads as fortified perimeter while preserving the exact alpha mask, frame grid, and atlas size

`floor.png` is an isometric terrain floor atlas:
- 20 frames (`5x4` grid)
- frame size `128x128`
- atlas layout `5 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `640x512`
- source image calibrated from `C:\Users\nikol\Desktop\bulindgs\floor.png`
- source frames were detected from the irregular magenta-background sheet, cleaned to alpha, and normalized into terrain-sized cells

`ground-decor.png` is a subtle isometric floor overlay atlas:
- 12 frames (`4x3` grid)
- frame size `128x128`
- atlas layout `4 columns x 3 rows`
- no spacing between frames (`spacing=0`)
- atlas size `512x384`
- locally generated with Pillow for village floor wear: stains, dirt, cracks, wet marks, and small debris overlays

`items.png` is a small village item/decor atlas:
- 8 frames (`4x2` grid)
- frame size `64x96`
- atlas layout `4 columns x 2 rows`
- no spacing between frames (`spacing=0`)
- atlas size `256x192`
- locally generated with Pillow for scale/detail props: barrels, crates, sacks, well/pump, scrap pile, workbench, lamp post, and wood pile

