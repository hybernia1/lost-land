import { gunzipSync, unzlibSync } from "fflate";
import type { TerrainTextureDefinition, TerrainTextureKey, TerrainTileId } from "./terrainTiles";
import { isMapNpcKindId } from "./mapNpcs";
import { getTileAssetUrl, getTiledTilesetSource } from "./tiledAssets";
import type {
  TerrainTileLayerDefinition,
  TerrainTilePlacement,
  VillageHomeAreaDefinition,
  VillageLayoutDefinition,
  VillageMapObjectDefinition,
  VillageNpcSpawnDefinition,
  VillageObjectLayerDefinition,
} from "./villageLayouts";
import type { EnemyUnitCounts, EnemyUnitId, ResourceSiteLoot } from "../game/types";
import { enemyUnitIds } from "./combatUnits";
import {
  villagePlotRulesById,
  type VillagePlotDefinition,
  type VillageResourceSiteDefinition,
  type VillageResourceSitePalisadeType,
} from "./villagePlots";

type TiledProperty = {
  name: string;
  type?: string;
  value: unknown;
};

type TiledAnimationFrame = {
  tileid: number;
  duration: number;
};

type TiledTilesetTile = {
  id: number;
  properties?: TiledProperty[];
  animation?: TiledAnimationFrame[];
};

type TiledTileset = {
  firstgid: number;
  name: string;
  source?: string;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  columns?: number;
  margin?: number;
  spacing?: number;
  tilecount?: number;
  tilewidth: number;
  tileheight: number;
  objectalignment?:
    | "unspecified"
    | "topleft"
    | "top"
    | "topright"
    | "left"
    | "center"
    | "right"
    | "bottomleft"
    | "bottom"
    | "bottomright";
  properties?: TiledProperty[];
  tiles?: TiledTilesetTile[];
};

type TiledTileLayer = {
  id: number;
  name: string;
  type: "tilelayer";
  width: number;
  height: number;
  data: number[] | string;
  encoding?: "csv" | "base64";
  compression?: "gzip" | "zlib" | "zstd" | "";
  opacity?: number;
  visible?: boolean;
};

type TiledObject = {
  id: number;
  name?: string;
  type?: string;
  gid?: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  properties?: TiledProperty[];
};

type TiledObjectLayer = {
  id: number;
  name: string;
  type: "objectgroup";
  draworder?: "index" | "topdown";
  objects?: TiledObject[];
  opacity?: number;
  visible?: boolean;
  offsetx?: number;
  offsety?: number;
  properties?: TiledProperty[];
};

type TiledLayer = TiledTileLayer | TiledObjectLayer | {
  id: number;
  name: string;
  type: string;
  visible?: boolean;
};

type TiledMap = {
  orientation?: "orthogonal" | "isometric" | "staggered" | "hexagonal";
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
};

type GidTileReference = {
  tileId: TerrainTileId;
  textureKey: TerrainTextureKey;
};

type TiledTilesetRegistry = {
  tileTextures: Record<TerrainTextureKey, TerrainTextureDefinition>;
  gidToTile: Map<number, GidTileReference>;
};
type TerrainEnvironmentTint = NonNullable<TerrainTextureDefinition["tintByEnvironment"]>;

const GID_MASK = 0x0fffffff;
const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const FLIPPED_VERTICALLY_FLAG = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG = 0x20000000;

type TiledTileTransform = {
  rotation?: 0 | 90 | 180 | 270;
  flipX?: boolean;
  flipY?: boolean;
};

export function createVillageLayoutFromTiled(
  id: string,
  rawMap: string,
): VillageLayoutDefinition {
  const map = JSON.parse(rawMap) as TiledMap;
  const orientation = map.orientation === "isometric"
    ? "isometric"
    : map.orientation === "orthogonal" || map.orientation === undefined
      ? "orthogonal"
      : null;
  if (!orientation) {
    throw new Error(`Unsupported Tiled map orientation "${map.orientation ?? "unknown"}".`);
  }
  const registry = createTilesetRegistry(id, map.tilesets, map.tileheight);
  const mapPixelBounds = getMapPixelBounds(map, orientation);
  const tileLayers = getTileLayers(map, orientation, registry.gidToTile);
  const homeArea = getHomeVillageArea(tileLayers, map.tilewidth, map.tileheight);

  return {
    id,
    orientation,
    tilesetId: requireStringProperty(
      map.properties,
      "tilesetId",
      `Tiled map ${id} is missing required tilesetId property.`,
    ),
    tileWidth: map.tilewidth,
    tileHeight: map.tileheight,
    tileSize: map.tilewidth,
    width: mapPixelBounds.width,
    height: mapPixelBounds.height,
    tileTextures: registry.tileTextures,
    tileLayers,
    objectLayers: getObjectLayers(map, orientation, registry),
    npcSpawns: getNpcSpawns(map, orientation),
    homeArea,
    plots: getVillagePlots(map, orientation),
    resourceSites: getResourceSites(map, orientation, homeArea),
  };
}

function getMapPixelBounds(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
): { width: number; height: number } {
  if (orientation === "orthogonal") {
    return {
      width: map.width * map.tilewidth,
      height: map.height * map.tileheight,
    };
  }

  return {
    width: (map.width + map.height) * (map.tilewidth / 2),
    height: (map.width + map.height) * (map.tileheight / 2),
  };
}

function createTilesetRegistry(
  id: string,
  tilesets: TiledTileset[],
  mapTileHeight: number,
): TiledTilesetRegistry {
  if (tilesets.length === 0) {
    throw new Error(`Tiled map ${id} has no tilesets.`);
  }

  const tileTextures: Record<TerrainTextureKey, TerrainTextureDefinition> = {};
  const gidToTile = new Map<number, GidTileReference>();

  for (const mapTileset of tilesets) {
    const tileset = resolveTileset(mapTileset);
    const atlasUrl = getTileAssetUrl(requireDefined(
      tileset.image,
      `Tileset "${tileset.name}" is missing required image.`,
    ));
    const tileCount = requireDefined(
      tileset.tilecount,
      `Tileset "${tileset.name}" is missing required tilecount.`,
    );
    const columns = requireDefined(
      tileset.columns,
      `Tileset "${tileset.name}" is missing required columns.`,
    );
    const margin = requireDefined(
      tileset.margin,
      `Tileset "${tileset.name}" is missing required margin.`,
    );
    const spacing = requireDefined(
      tileset.spacing,
      `Tileset "${tileset.name}" is missing required spacing.`,
    );
    const tilesById = new Map((tileset.tiles ?? []).map((tile) => [tile.id, tile]));
    const textureKeyByTileIndex = new Map<number, TerrainTextureKey>();

    for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
      const tile = tilesById.get(tileIndex);
      const tileId = requireStringProperty(
        tile?.properties,
        "tileId",
        `Tileset "${tileset.name}" tile ${tileIndex} is missing required tileId property.`,
      );
      const textureKey = `${tileset.name}:${tileId}`;
      const frame = {
        x: margin + (tileIndex % columns) * (tileset.tilewidth + spacing),
        y: margin + Math.floor(tileIndex / columns) * (tileset.tileheight + spacing),
        width: tileset.tilewidth,
        height: tileset.tileheight,
      };

      tileTextures[textureKey] = {
        key: textureKey,
        tileId,
        tilesetId: tileset.name,
        atlasUrl,
        frame,
        tileLayerOffset: {
          x: 0,
          y: mapTileHeight - tileset.tileheight,
        },
        objectAnchor: resolveTileObjectAnchor(tileset.objectalignment, tileset.name),
        edgeOverscan: getNumberProperty(tile?.properties, "edgeOverscan") ??
          requireNumberProperty(
            tileset.properties,
            "edgeOverscan",
            `Tileset "${tileset.name}" is missing required edgeOverscan property.`,
          ),
        tintByEnvironment: getTerrainTintByEnvironment(tileset, tile),
      };
      gidToTile.set(tileset.firstgid + tileIndex, { tileId, textureKey });
      textureKeyByTileIndex.set(tileIndex, textureKey);
    }

    for (const tile of tilesById.values()) {
      if (!tile.animation || tile.animation.length === 0) {
        continue;
      }

      const textureKey = textureKeyByTileIndex.get(tile.id);
      const tileTexture = textureKey ? tileTextures[textureKey] : null;

      if (!textureKey || !tileTexture) {
        continue;
      }

      const animation = tile.animation.flatMap((frame) => {
        const frameTextureKey = textureKeyByTileIndex.get(frame.tileid);
        return frameTextureKey
          ? [{ textureKey: frameTextureKey, durationMs: frame.duration }]
          : [];
      });

      if (animation.length > 1) {
        tileTexture.animation = animation;
      }
    }
  }

  return { tileTextures, gidToTile };
}

function resolveTileObjectAnchor(
  objectAlignment: TiledTileset["objectalignment"],
  tilesetName: string,
): { x: number; y: number } {
  if (!objectAlignment || objectAlignment === "unspecified") {
    throw new Error(
      `Tileset "${tilesetName}" is missing required explicit objectalignment.`,
    );
  }

  switch (objectAlignment) {
    case "topleft":
      return { x: 0, y: 0 };
    case "top":
      return { x: 0.5, y: 0 };
    case "topright":
      return { x: 1, y: 0 };
    case "left":
      return { x: 0, y: 0.5 };
    case "center":
      return { x: 0.5, y: 0.5 };
    case "right":
      return { x: 1, y: 0.5 };
    case "bottom":
      return { x: 0.5, y: 1 };
    case "bottomright":
      return { x: 1, y: 1 };
    case "bottomleft":
    default:
      return { x: 0, y: 1 };
  }
}

function getTerrainTintByEnvironment(
  tileset: Pick<TiledTileset, "name" | "properties">,
  tile: TiledTilesetTile | undefined,
): TerrainEnvironmentTint {
  return {
    rain: getColorProperty(tile?.properties, "tintRain") ??
      requireColorProperty(
        tileset.properties,
        "tintRain",
        `Tileset "${tileset.name}" is missing required tintRain color property.`,
      ),
    snowFront: getColorProperty(tile?.properties, "tintSnowFront") ??
      requireColorProperty(
        tileset.properties,
        "tintSnowFront",
        `Tileset "${tileset.name}" is missing required tintSnowFront color property.`,
      ),
  };
}

function resolveTileset(mapTileset: TiledTileset): TiledTileset {
  if (!mapTileset.source) {
    return mapTileset;
  }

  return {
    ...JSON.parse(getTiledTilesetSource(mapTileset.source)) as Omit<TiledTileset, "firstgid">,
    firstgid: mapTileset.firstgid,
  };
}

function getTileLayers(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
  gidToTile: Map<number, GidTileReference>,
): TerrainTileLayerDefinition[] {
  const layers = map.layers.filter((layer): layer is TiledTileLayer =>
    layer.type === "tilelayer" && layer.visible !== false,
  );

  if (!layers.some((layer) => layer.name === "tarrain")) {
    throw new Error("Tiled map is missing tile layer \"tarrain\".");
  }

  return layers.map((layer) => {
    validateTileLayer(map, layer);
    const terrainTiles = getTerrainTiles(map, orientation, layer, gidToTile);

    return {
      id: String(layer.id),
      name: layer.name,
      opacity: layer.opacity ?? 1,
      width: layer.width,
      height: layer.height,
      ...terrainTiles,
    };
  });
}

function validateTileLayer(map: TiledMap, layer: TiledTileLayer): void {
  if (layer.width !== map.width || layer.height !== map.height) {
    throw new Error(
      `Tiled layer "${layer.name}" has size ${layer.width}x${layer.height}, expected ${map.width}x${map.height}.`,
    );
  }

  const expectedTileCount = layer.width * layer.height;
  const layerData = getLayerTileData(layer);

  if (layerData.length !== expectedTileCount) {
    throw new Error(
      `Tiled layer "${layer.name}" has ${layerData.length} tiles, expected ${expectedTileCount}.`,
    );
  }
}

function getObjectLayers(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
  registry: TiledTilesetRegistry,
): VillageObjectLayerDefinition[] {
  return map.layers
    .filter((layer): layer is TiledObjectLayer =>
      layer.type === "objectgroup" && layer.visible !== false,
    )
    .map((layer) => {
      const placementMode = getStringProperty(layer.properties, "placementMode");
      const offset = getObjectLayerOffset(layer);

      return {
        id: String(layer.id),
        name: layer.name,
        opacity: layer.opacity ?? 1,
        drawOrder: requireObjectLayerDrawOrder(layer),
        renderBand: getObjectLayerRenderBand(layer),
        offset,
        placementMode,
        isStaticVisualLayer: placementMode === "free",
        objects: getMapObjects(map, orientation, layer, registry, offset),
      };
    });
}

function getTerrainTiles(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
  layer: TiledTileLayer,
  gidToTile: Map<number, GidTileReference>,
): Pick<TerrainTileLayerDefinition, "tiles" | "tileByIndex"> {
  const tileByIndex: Array<TerrainTilePlacement | null> = [];
  const tiles: TerrainTilePlacement[] = [];
  const layerData = getLayerTileData(layer);

  layerData.forEach((rawGid, index) => {
    const tile = getTileReference(rawGid, gidToTile);

    if (!tile) {
      tileByIndex.push(null);
      return;
    }

    const tileX = index % layer.width;
    const tileY = Math.floor(index / layer.width);
    const placement = {
      ...getTilePixelPosition(map, orientation, tileX, tileY),
      tileId: tile.tileId,
      textureKey: tile.textureKey,
      ...getTileTransform(rawGid),
    };

    tileByIndex.push(placement);
    tiles.push(placement);
  });

  return { tiles, tileByIndex };
}

function getLayerTileData(layer: TiledTileLayer): number[] {
  if (Array.isArray(layer.data)) {
    return layer.data;
  }

  if (layer.encoding === "base64") {
    return decodeBase64LayerData(layer.name, layer.data, layer.compression);
  }

  if (layer.encoding === "csv" || layer.encoding === undefined) {
    return parseCsvLayerData(layer.name, layer.data);
  }

  throw new Error(
    `Tiled layer "${layer.name}" has unsupported encoding "${layer.encoding}".`,
  );
}

function decodeBase64LayerData(
  layerName: string,
  base64Data: string,
  compression: TiledTileLayer["compression"],
): number[] {
  const encodedBytes = decodeBase64ToBytes(base64Data);
  const decodedBytes = decompressLayerBytes(layerName, encodedBytes, compression);

  if (decodedBytes.byteLength % 4 !== 0) {
    throw new Error(
      `Tiled layer "${layerName}" base64 payload has invalid byte length ${decodedBytes.byteLength}.`,
    );
  }

  const view = new DataView(decodedBytes.buffer, decodedBytes.byteOffset, decodedBytes.byteLength);
  const tiles: number[] = [];

  for (let offset = 0; offset < decodedBytes.byteLength; offset += 4) {
    tiles.push(view.getUint32(offset, true));
  }

  return tiles;
}

function decodeBase64ToBytes(base64Data: string): Uint8Array {
  if (typeof atob === "function") {
    const normalized = base64Data.replace(/\s+/g, "");
    const decoded = atob(normalized);
    const bytes = new Uint8Array(decoded.length);

    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }

    return bytes;
  }

  const bufferFactory = (globalThis as { Buffer?: { from(data: string, encoding: string): Uint8Array } }).Buffer;

  if (!bufferFactory) {
    throw new Error("No base64 decoder available in this environment.");
  }

  return bufferFactory.from(base64Data, "base64");
}

function decompressLayerBytes(
  layerName: string,
  bytes: Uint8Array,
  compression: TiledTileLayer["compression"],
): Uint8Array {
  if (!compression) {
    return bytes;
  }

  if (compression === "gzip") {
    return gunzipSync(bytes);
  }

  if (compression === "zlib") {
    return unzlibSync(bytes);
  }

  if (compression === "zstd") {
    throw new Error(
      `Tiled layer "${layerName}" uses zstd compression, which is not supported by the runtime loader.`,
    );
  }

  throw new Error(
    `Tiled layer "${layerName}" has unsupported compression "${compression}".`,
  );
}

function parseCsvLayerData(layerName: string, csvData: string): number[] {
  const values = csvData
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const tiles = values.map((value) => Number.parseInt(value, 10));

  if (tiles.some((value) => Number.isNaN(value))) {
    throw new Error(`Tiled layer "${layerName}" contains invalid CSV tile data.`);
  }

  return tiles;
}

function getTilePixelPosition(
  map: Pick<TiledMap, "width" | "height" | "tilewidth" | "tileheight">,
  orientation: "orthogonal" | "isometric",
  tileX: number,
  tileY: number,
): Pick<TerrainTilePlacement, "x" | "y"> {
  if (orientation === "orthogonal") {
    return {
      x: tileX * map.tilewidth,
      y: tileY * map.tileheight,
    };
  }

  const halfTileWidth = map.tilewidth / 2;
  const halfTileHeight = map.tileheight / 2;
  return {
    x: (tileX - tileY) * halfTileWidth + (map.height - 1) * halfTileWidth,
    y: (tileX + tileY) * halfTileHeight,
  };
}

function getObjectPixelPosition(
  map: Pick<TiledMap, "width" | "height" | "tilewidth" | "tileheight">,
  orientation: "orthogonal" | "isometric",
  objectX: number,
  objectY: number,
): { x: number; y: number } {
  if (orientation === "orthogonal") {
    return { x: objectX, y: objectY };
  }

  // Tiled stores regular isometric object coordinates in projected-grid space,
  // where both axes are scaled by tileHeight.
  const tileX = objectX / map.tileheight;
  const tileY = objectY / map.tileheight;
  const originX = map.height * (map.tilewidth / 2);
  return {
    x: (tileX - tileY) * (map.tilewidth / 2) + originX,
    y: (tileX + tileY) * (map.tileheight / 2),
  };
}

function getMapObjects(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
  layer: TiledObjectLayer,
  registry: TiledTilesetRegistry,
  layerOffset: { x: number; y: number },
): VillageMapObjectDefinition[] {
  return (layer.objects ?? [])
    .filter((object) => object.visible !== false)
    .map((object) => {
      const tile = object.gid ? getTileReference(object.gid, registry.gidToTile) : null;
      const tileTransform = object.gid ? getTileTransform(object.gid) : {};
      const tileTexture = tile
        ? getRequiredTerrainTexture(registry, tile.textureKey)
        : null;
      const position = getObjectPixelPosition(map, orientation, object.x, object.y);
      const width = object.width ?? 0;
      const height = object.height ?? 0;
      const rotation = object.rotation ?? 0;
      const opacity = object.opacity ?? 1;
      const render = {
        x: position.x + layerOffset.x,
        y: position.y + layerOffset.y,
        width,
        height,
        anchor: tileTexture?.objectAnchor ?? null,
        rotation: rotation + (tileTransform.rotation ?? 0),
        flipX: Boolean(tileTransform.flipX),
        flipY: Boolean(tileTransform.flipY),
        opacity,
      };

      return {
        id: String(object.id),
        textureKey: tile?.textureKey ?? null,
        render,
      };
    });
}

function getRequiredTerrainTexture(
  registry: TiledTilesetRegistry,
  textureKey: TerrainTextureKey,
): TerrainTextureDefinition {
  const texture = registry.tileTextures[textureKey];

  if (!texture) {
    throw new Error(`Tiled object references unknown texture "${textureKey}".`);
  }

  return texture;
}

function getObjectLayerOffset(layer: Pick<TiledObjectLayer, "offsetx" | "offsety">): { x: number; y: number } {
  return {
    x: layer.offsetx ?? 0,
    y: layer.offsety ?? 0,
  };
}

function requireObjectLayerDrawOrder(layer: Pick<TiledObjectLayer, "name" | "draworder">): "index" | "topdown" {
  if (layer.draworder === "index" || layer.draworder === "topdown") {
    return layer.draworder;
  }

  throw new Error(`Tiled object layer "${layer.name}" is missing required draworder.`);
}

function getObjectLayerRenderBand(layer: Pick<TiledObjectLayer, "properties">): "base" | "foreground" {
  const value = getStringProperty(layer.properties, "renderBand");
  return value === "foreground" ? "foreground" : "base";
}

function getVillagePlots(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
): VillagePlotDefinition[] {
  const plotsLayer = getNamedObjectLayer(map, "plots");

  if (!plotsLayer) {
    throw new Error("Tiled map is missing object layer \"plots\".");
  }

  const layerOffset = getObjectLayerOffset(plotsLayer);
  const plotObjects = (plotsLayer.objects ?? []).map((object) => ({
    object,
    id: getPlotObjectId(object),
  }));

  const plots = plotObjects
    .filter(({ object }) => object.visible !== false)
    .map(({ object, id }) => {
      const position = getObjectPixelPosition(map, orientation, object.x, object.y);

      if (!id) {
        throw new Error("Tiled plot object is missing a plotId property or name.");
      }

      return {
        id,
        x: position.x + layerOffset.x,
        y: position.y + layerOffset.y,
        width: object.width ?? 0,
        height: object.height ?? 0,
        ...villagePlotRulesById[id],
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id, "en", { numeric: true }));

  if (plots.length === 0) {
    throw new Error("Tiled object layer \"plots\" does not contain any plot objects.");
  }

  return plots;
}

function getPlotObjectId(object: TiledObject): string {
  return getStringProperty(object.properties, "plotId") ?? object.name ?? "";
}

function getResourceSites(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
  homeArea: VillageHomeAreaDefinition,
): VillageResourceSiteDefinition[] {
  const layer = getNamedObjectLayer(map, "resourceSites");

  if (!layer) {
    return [];
  }

  const layerOffset = getObjectLayerOffset(layer);

  return (layer.objects ?? [])
    .filter((object) => object.visible !== false)
    .map((object) => {
      const id = getStringProperty(object.properties, "plotId") ?? object.name;
      const position = getObjectPixelPosition(map, orientation, object.x, object.y);

      if (!id) {
        throw new Error("Resource site object is missing a plotId property or name.");
      }

      const loot = getResourceSiteLoot(object.properties, id);
      const x = position.x + layerOffset.x;
      const y = position.y + layerOffset.y;
      const footprint = getResourceSiteFootprint(map, orientation, x, y, object.width ?? 0, object.height ?? 0);
      return {
        id,
        x: footprint.x,
        y: footprint.y,
        width: footprint.width,
        height: footprint.height,
        palisadeType: getResourceSitePalisadeType(object.properties),
        loot,
        defenderArmy: getResourceSiteDefenderArmy(object.properties, id),
      };
    })
    .filter((site) => !isRectCenterInsideArea(site, homeArea))
    .sort((left, right) => left.id.localeCompare(right.id, "en", { numeric: true }));
}

function getResourceSiteFootprint(
  map: Pick<TiledMap, "tilewidth" | "tileheight">,
  orientation: "orthogonal" | "isometric",
  x: number,
  y: number,
  width: number,
  height: number,
): Pick<VillageResourceSiteDefinition, "x" | "y" | "width" | "height"> {
  const centerX = x + Math.max(1, width) / 2;
  const centerY = y + Math.max(1, height) / 2;
  const footprintWidth = map.tilewidth * 2;
  const footprintHeight = map.tileheight * 2;

  if (orientation === "isometric") {
    return {
      x: centerX - footprintWidth / 2,
      y: centerY - footprintHeight / 2,
      width: footprintWidth,
      height: footprintHeight,
    };
  }

  return {
    x,
    y,
    width: footprintWidth,
    height: footprintHeight,
  };
}

function getResourceSitePalisadeType(
  properties: TiledProperty[] | undefined,
): VillageResourceSitePalisadeType {
  const value = getStringProperty(properties, "palisadeType");

  return value === "stone" || value === "scrap" ? value : "wood";
}

function getHomeVillageArea(
  tileLayers: TerrainTileLayerDefinition[],
  tileWidth: number,
  tileHeight: number,
): VillageHomeAreaDefinition {
  const layer = tileLayers.find((candidate) => candidate.name === "palisade");

  if (!layer || layer.tiles.length === 0) {
    throw new Error("Tiled map is missing non-empty tile layer \"palisade\" for the home village area.");
  }

  const minX = Math.min(...layer.tiles.map((tile) => tile.x));
  const minY = Math.min(...layer.tiles.map((tile) => tile.y));
  const maxX = Math.max(...layer.tiles.map((tile) => tile.x + tileWidth));
  const maxY = Math.max(...layer.tiles.map((tile) => tile.y + tileHeight));

  return {
    id: "home-village",
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function isRectCenterInsideArea(
  rect: Pick<VillageResourceSiteDefinition, "x" | "y" | "width" | "height">,
  area: VillageHomeAreaDefinition,
): boolean {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  return centerX >= area.x &&
    centerX <= area.x + area.width &&
    centerY >= area.y &&
    centerY <= area.y + area.height;
}

function getNpcSpawns(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
): VillageNpcSpawnDefinition[] {
  const layer = getNamedObjectLayer(map, "npcSpawns", true);

  if (!layer) {
    return [];
  }

  const layerOffset = getObjectLayerOffset(layer);

  return (layer.objects ?? [])
    .filter((object) => object.visible !== false)
    .map((object) => {
      const id = object.name || `npc-spawn-${object.id}`;
      const npcKindId = getStringProperty(object.properties, "npcKindId");

      if (!npcKindId || !isMapNpcKindId(npcKindId)) {
        throw new Error(`NPC spawn "${id}" has invalid or missing npcKindId property.`);
      }

      const position = getObjectPixelPosition(map, orientation, object.x, object.y);
      const count = Math.max(
        0,
        Math.min(
          24,
          Math.floor(
            getNumberProperty(object.properties, "npcCount") ??
            getNumberProperty(object.properties, "count") ??
            1,
          ),
        ),
      );

      return {
        id,
        npcKindId,
        count,
        x: position.x + layerOffset.x,
        y: position.y + layerOffset.y,
        width: object.width ?? 0,
        height: object.height ?? 0,
      };
    })
    .filter((spawn) => spawn.count > 0 && spawn.width > 0 && spawn.height > 0)
    .sort((left, right) => left.id.localeCompare(right.id, "en", { numeric: true }));
}

function getTileReference(rawGid: number, gidToTile: Map<number, GidTileReference>): GidTileReference | null {
  const gid = rawGid & GID_MASK;

  if (gid === 0) {
    return null;
  }

  const tile = gidToTile.get(gid);

  if (!tile) {
    throw new Error(`Tiled map references unknown GID ${gid}.`);
  }

  return tile;
}

function getTileTransform(rawGid: number): TiledTileTransform {
  const horizontal = (rawGid & FLIPPED_HORIZONTALLY_FLAG) !== 0;
  const vertical = (rawGid & FLIPPED_VERTICALLY_FLAG) !== 0;
  const diagonal = (rawGid & FLIPPED_DIAGONALLY_FLAG) !== 0;

  if (!horizontal && !vertical && !diagonal) {
    return {};
  }

  if (!diagonal) {
    return {
      flipX: horizontal || undefined,
      flipY: vertical || undefined,
    };
  }

  if (horizontal && vertical) {
    return { rotation: 90, flipY: true };
  }

  if (horizontal) {
    return { rotation: 90 };
  }

  if (vertical) {
    return { rotation: 270 };
  }

  return { rotation: 90, flipX: true };
}

function getStringProperty(properties: TiledProperty[] | undefined, name: string): string | null {
  const property = properties?.find((candidate) => candidate.name === name);
  return typeof property?.value === "string" ? property.value : null;
}

function requireStringProperty(
  properties: TiledProperty[] | undefined,
  name: string,
  errorMessage: string,
): string {
  const value = getStringProperty(properties, name);

  if (value === null) {
    throw new Error(errorMessage);
  }

  return value;
}

function requireDefined<T>(value: T | null | undefined, errorMessage: string): T {
  if (value === null || value === undefined) {
    throw new Error(errorMessage);
  }

  return value;
}

function getNumberProperty(properties: TiledProperty[] | undefined, name: string): number | null {
  const property = properties?.find((candidate) => candidate.name === name);
  return typeof property?.value === "number" ? property.value : null;
}

function requireNumberProperty(
  properties: TiledProperty[] | undefined,
  name: string,
  errorMessage: string,
): number {
  const value = getNumberProperty(properties, name);

  if (value === null) {
    throw new Error(errorMessage);
  }

  return value;
}

function getColorProperty(properties: TiledProperty[] | undefined, name: string): number | null {
  const property = properties?.find((candidate) => candidate.name === name);
  return parseTiledColor(property?.value);
}

function requireColorProperty(
  properties: TiledProperty[] | undefined,
  name: string,
  errorMessage: string,
): number {
  const value = getColorProperty(properties, name);

  if (value === null) {
    throw new Error(errorMessage);
  }

  return value;
}

function parseTiledColor(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value & 0xffffff;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized) && !/^#[0-9a-fA-F]{8}$/.test(normalized)) {
    return null;
  }

  const rgbHex = normalized.length === 9
    ? normalized.slice(3)
    : normalized.slice(1);
  return Number.parseInt(rgbHex, 16);
}

function getResourceSiteLoot(
  properties: TiledProperty[] | undefined,
  siteId: string,
): ResourceSiteLoot {
  const loot: ResourceSiteLoot = {};

  for (const resourceId of ["food", "water", "material", "coal"] as const) {
    const amount = getNumberProperty(properties, resourceId) ??
      getNumberProperty(properties, `loot${capitalize(resourceId)}`);

    if (amount !== null) {
      loot[resourceId] = Math.max(0, Math.floor(amount));
    }
  }

  const totalLoot = Object.values(loot).reduce((total, amount) => total + Math.max(0, Math.floor(amount ?? 0)), 0);
  if (totalLoot <= 0) {
    throw new Error(
      `Resource site "${siteId}" has no loot. Add numeric food/water/material/coal properties.`,
    );
  }

  return loot;
}

function getResourceSiteDefenderArmy(
  properties: TiledProperty[] | undefined,
  siteId: string,
): EnemyUnitCounts {
  const army = createEmptyEnemyUnitCounts();
  const defenderList = getStringProperty(properties, "defenders");

  if (defenderList) {
    for (const entry of defenderList.split(",")) {
      const [rawUnitId, rawCount] = entry.split(":");
      const unitId = rawUnitId?.trim();
      const count = Number.parseInt(rawCount?.trim() ?? "", 10);

      if (!isEnemyUnitId(unitId) || !Number.isFinite(count)) {
        throw new Error(
          `Resource site "${siteId}" has invalid defenders entry "${entry}". Use e.g. "rat:2,spider:1".`,
        );
      }

      army[unitId] = Math.max(0, Math.floor(count));
    }
  }

  for (const unitId of enemyUnitIds) {
    const directCount = getNumberProperty(properties, unitId) ??
      getNumberProperty(properties, `enemy${capitalize(unitId)}`);

    if (directCount !== null) {
      army[unitId] = Math.max(0, Math.floor(directCount));
    }
  }

  const totalDefenders = enemyUnitIds.reduce((total, unitId) => total + army[unitId], 0);
  if (totalDefenders <= 0) {
    throw new Error(
      `Resource site "${siteId}" has no defenders. Add a defenders property, e.g. "rat:2".`,
    );
  }

  return army;
}

function createEmptyEnemyUnitCounts(): EnemyUnitCounts {
  return Object.fromEntries(enemyUnitIds.map((unitId) => [unitId, 0])) as EnemyUnitCounts;
}

function isEnemyUnitId(value: string | undefined): value is EnemyUnitId {
  return typeof value === "string" && enemyUnitIds.includes(value as EnemyUnitId);
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function getNamedObjectLayer(
  map: TiledMap,
  name: string,
  includeHidden = false,
): TiledObjectLayer | null {
  return map.layers.find((candidate): candidate is TiledObjectLayer =>
    candidate.type === "objectgroup" &&
    candidate.name === name &&
    (includeHidden || candidate.visible !== false),
  ) ?? null;
}
