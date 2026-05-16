# Tile Atlases

Map tiles are grouped by Tiled layer purpose. Older top-down atlases use a
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
- restyled from the former matching dirt-road shape/lighting reference into a no-outline water palette while preserving the atlas grid and tile positions
- 2026-05-14 palette pass shifted the water from bright cyan to a quieter blue-green while preserving the exact alpha mask, frame grid, and atlas size

`nature-blocks.png` is an isometric block-style terrain atlas:
- 20 frames (`5x4` grid; first 19 slots used, last slot left transparent)
- frame size `128x128`
- atlas layout `5 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `640x512`
- source images copied from `C:\Users\nikol\Desktop\iso grass\*.png`, then normalized into fixed `128x128` cells while preserving proportions

`dungeon.png` is a canonical isometric dungeon decor atlas from Kenney's Isometric Miniature Dungeon pack:
- 288 half-size frames from the `Isometric/*.png` source set
- frame size `128x256`
- atlas layout `16 columns x 18 rows`
- no spacing between frames (`spacing=0`)
- atlas size `2048x4608`
- source: https://kenney.nl/assets/isometric-miniature-dungeon
- license: Creative Commons CC0; see `LICENSE-kenney-isometric-miniature-dungeon-cc0.txt`
- tile order is grouped by asset, then direction: `asset_N`, `asset_E`, `asset_S`, `asset_W`; this keeps all angle variants adjacent in Tiled
