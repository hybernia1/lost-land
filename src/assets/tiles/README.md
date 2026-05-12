# Tile Atlases

Map tiles are grouped by Tiled layer purpose. Legacy top-down atlases use a
128x128 grid. Isometric tiles can use their own map grid sizes.

Transparent overlay atlases use PNG alpha so they can be layered in Tiled
without baking in a background.

`grass-basic.png` is the current default 128x64 isometric ground tile.
`palisade-simple.png` is a deterministic isometric 5-frame atlas:
- `palisadeDiagDown`
- `palisadeDiagUp`
- `palisadeCorner`
- `palisadeGateDown`
- `palisadeGateUp`

Each frame is `128x64`, with `8px` transparent atlas spacing to avoid texture
bleeding between frames. The palisade frames follow the canonical 2:1
isometric slope. The gate frames replace one generated palisade block selected
from the single `palisade-ring` object's `gateEdge` and `gateIndex`
properties; they are not separate Tiled gameplay objects.
