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
- 20 frames (`5x4` grid)
- frame size `128x128`
- atlas layout `5 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `640x512`
- source image extracted from `C:\Users\nikol\Desktop\water.png`
- magenta sheet background is converted to real alpha and packed into normalized cells

`nature-blocks.png` is an isometric block-style terrain atlas:
- 20 frames (`5x4` grid; first 19 slots used, last slot left transparent)
- frame size `128x128`
- atlas layout `5 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `640x512`
- source images copied from `C:\Users\nikol\Desktop\iso grass\*.png`, then normalized into fixed `128x128` cells while preserving proportions
