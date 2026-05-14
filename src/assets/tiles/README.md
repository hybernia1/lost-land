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

`nature-blocks.png` is an isometric block-style terrain atlas:
- 20 frames (`5x4` grid; first 19 slots used, last slot left transparent)
- frame size `128x128`
- atlas layout `5 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `640x512`
- source images copied from `C:\Users\nikol\Desktop\iso grass\*.png`, then normalized into fixed `128x128` cells while preserving proportions


walls.png is a freeform isometric wall/gate atlas:
- 6 frames (3x2 grid)
- frame size 256x256`n- atlas layout 3 columns x 2 rows`n- no spacing between frames (spacing=0)
- atlas size 768x512`n- includes wall segments in both diagonals, corner, end piece, and closed gate variants

`roads.png` is a freeform isometric dirt-road atlas:
- 16 frames (`4x4` grid)
- frame size `256x128`
- atlas layout `4 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `1024x512`
- source image copied from `C:\Users\nikol\Desktop\path dirt2.png`
- restyled to a warmer no-outline dirt palette while preserving the atlas grid and tile positions

`fence.png` is a freeform isometric fence/wall atlas:
- 56 frames (`8x7` grid)
- frame size `128x256`
- atlas layout `8 columns x 7 rows`
- no spacing between frames (`spacing=0`)
- atlas size `1024x1792`
- source images copied from `C:\Users\nikol\Desktop\fence\*.png`
- source frames were normalized from `256x512` to half-size `128x256` while preserving tile proportions

