# Isometric Map Standards (Phase 1)

This document defines the team rules for composing the village map in Tiled.
It is intentionally strict so map work stays predictable as we add more assets.

## Footprint vs Sprite Size

There are two different sizes in isometric workflows:

1. Grid footprint size (map cell): `128x64`
2. Sprite bounding size (tile image): can be equal or taller

`128x64` is the logical diamond cell used by map coordinates.
Sprite height can be larger if we need vertical depth styling.

The important rule is that footprint alignment uses the map grid (`128x64`), not the full sprite box height.

## Canonical Rules

1. Map orientation is always `isometric`.
2. Terrain map grid size is fixed to `tilewidth=128`, `tileheight=64`.
3. Terrain base layer name is exactly `tarrain` (legacy spelling kept for compatibility).
4. Plot/object layer name is exactly `plots`.
5. Object/decor layer content can use larger heights and offsets when needed.
6. Tileset image dimensions may be taller than map `tileheight`; this is allowed for depth styling.
7. Resource sites stay in the `resourceSites` layer and must keep all required site properties.

## Coordinate Spaces

1. Tiled object coordinates on an isometric map are stored in projected-grid space (scaled by map `tileheight`).
2. Runtime loader converts those values to pixel draw coordinates for the renderer.
3. Do not hand-convert plot/object coordinates to screen-space in the TMJ file.

## Layering Rules (Current Scope)

1. Keep these gameplay-critical layers: `tarrain`, `plots`, `resourceSites`.
2. `plots` layer is for regular building plots only.
3. `resourceSites` layer is for oasis/resource site anchors only.
4. `palisade` layer is an Object Layer and is the source of truth for the unique palisade building.
5. The palisade plot id is always `palisade` and is derived from the `type: "ring"` object on the `palisade` layer.
6. The palisade layer contains one authored rectangle object, not hand-placed wall pieces.
7. Gate placement is defined on the ring object through `gateEdge` and `gateIndex`.
8. Do not add `plot-palisade`, `palisade-gate`, segment, corner, or gate anchor objects for gameplay interaction.
9. Optional visual layers (`decor`, roads, trees, ruins) can be added incrementally, but must not change stable plot or resource site IDs.

## Palisade Ring Properties

1. `gateEdge` chooses the wall edge: `northEast`, `southEast`, `southWest`, or `northWest`.
2. `gateIndex` chooses the exact palisade block on that edge, starting at `0`.
3. Gate width is not configurable in the map. The gate frame replaces exactly one palisade block on the selected edge.
4. The ring object's rectangle controls the palisade footprint and clickable build area.
5. Draw the ring with Tiled's Rectangle tool on the `palisade` Object Layer.
6. Enable Snap to Grid in Tiled while moving or resizing the ring.
7. The `palisade` layer stores editor hints: `editorShape=rectangle`, `editorSnapGrid=isometric-object-grid`, `editorGridUnit=64`, `gateMode=gateIndex`.
8. Keep both palisade axes at least two blocks wide; avoid one-block strips or long noodle shapes.

## Naming Rules

1. Plot IDs are stable (`plot-main`, `plot-01`, ..., `plot-13`, `palisade`).
2. Resource IDs use `resource-*` naming and always include `siteResourceId` property.
3. Use neutral tileset names (for example `ground`, `palisade`) because the map pipeline is already fully isometric.

## Edit Workflow

1. Edit in Tiled.
2. Run `npm run build`.
3. Commit once build passes.

## Phase 1 Asset Choice

Current base tile source is a local simple iso grass tile:
- `src/assets/tiles/grass-basic.png`
- footprint: map grid `128x64`
- image box: currently normalized to `128x64`

Later we can switch style packs, but must preserve grid rules unless we intentionally migrate the whole map standard.
