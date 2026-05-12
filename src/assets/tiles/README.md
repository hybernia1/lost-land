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
- 24 frames (`6x4` grid; first 22 slots currently used, remaining slots left transparent for future assets)
- frame size `256x256`
- atlas layout `6 columns x 4 rows`
- no spacing between frames (`spacing=0`)
- atlas size `1536x1024`
- source images copied from `C:\Users\nikol\Desktop\shadowApartFromTree\*_img.png` (shadow variants excluded)
