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

`palisade-simple.png` is a deterministic isometric 10-frame atlas:
- `palisadeDiagDown`
- `palisadeDiagUp`
- `palisadeCorner`
- `palisadeGateDown`
- `palisadeGateUp`
- `palisadeDiagDownSideB`
- `palisadeDiagUpSideB`
- `palisadeCornerSideB`
- `palisadeGateDownSideB`
- `palisadeGateUpSideB`

Each frame is `128x64`. The atlas is arranged as `5 columns x 2 rows`, with
`spacing=0` and final size `640x128` (both dimensions are multiples of 64), where
the second row is the opposite-side lighting variant (`SideB`) for the same
geometry. The palisade frames follow the canonical 2:1 isometric slope and
include thicker wood depth/detail treatment. Gate frames replace one generated
palisade block selected from the single `palisade-ring` object's `gateEdge`
and `gateIndex` properties; they are not separate Tiled gameplay objects.
