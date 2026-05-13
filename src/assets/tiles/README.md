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

`grass.png` is now maintained as the canonical in-repo ground atlas.

`brick.png` is an interior isometric floor atlas:
- 18 frames
- frame size `128x64`
- atlas layout `3 columns x 6 rows`
- no spacing between frames (`spacing=0`)
- atlas size `384x384` (both dimensions are multiples of 64)
- imported from `Floor_Brick_02-128x64.png` with magenta colorkey converted to alpha

`objects.png` is a freeform decor/object atlas:
- 16 frames (`4x4` grid; first 7 slots currently used, remaining slots left transparent for future assets)
- frame size `128x128`
- atlas layout `4 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `512x512`
- source images resized from `C:\Users\nikol\Desktop\objects\*.png` (including `brana.png`)

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

`water.png` is a freeform water/decor atlas:
- 20 frames (`5x4` grid)
- frame size `256x256`
- atlas layout `5 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `1280x1024`
- source image extracted from `C:\Users\nikol\Desktop\water.png`
- magenta sheet background is converted to real alpha and packed into normalized cells

`nature-blocks.png` is an isometric block-style terrain atlas:
- 20 frames (`5x4` grid; first 19 slots used, last slot left transparent)
- frame size `128x128`
- atlas layout `5 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `640x512`
- source images copied from `C:\Users\nikol\Desktop\iso grass\*.png`, then normalized into fixed `128x128` cells while preserving proportions
