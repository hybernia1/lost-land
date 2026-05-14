import type { TerrainTextureDefinition, TerrainTextureKey, TerrainTileId } from "./terrainTiles";
import { getTileAssetUrl, getTiledTilesetSource } from "./tiledAssets";
import type {
  TerrainTileLayerDefinition,
  TerrainTilePlacement,
  VillageLayoutDefinition,
  VillageMapObjectDefinition,
  VillageMapObjectPropertyValue,
  VillageObjectLayerDefinition,
} from "./villageLayouts";
import type { ResourceSiteResourceId } from "../game/types";
import {
  villagePlotRulesById,
  type VillagePlotDefinition,
  type VillageResourceSiteDefinition,
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
  tiles?: TiledTilesetTile[];
};

type TiledTileLayer = {
  id: number;
  name: string;
  type: "tilelayer";
  width: number;
  height: number;
  data: number[];
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
  visible?: boolean;
  properties?: TiledProperty[];
};

type TiledObjectLayer = {
  id: number;
  name: string;
  type: "objectgroup";
  objects?: TiledObject[];
  opacity?: number;
  visible?: boolean;
  offsetx?: number;
  offsety?: number;
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

const DEFAULT_RESOURCE_SITE_CAPTURE_MIN_TROOPS = 5;
const DEFAULT_RESOURCE_SITE_CAPTURE_BASE_DEATH_RISK = 0.42;
const DEFAULT_RESOURCE_SITE_MAX_WORKERS = 3;
const DEFAULT_RESOURCE_SITE_YIELD_PER_WORKER: Record<ResourceSiteResourceId, number> = {
  food: 0.08,
  water: 0.075,
  coal: 0.07,
  material: 0.06,
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
  const registry = createTilesetRegistry(id, map.tilesets);
  const mapPixelBounds = getMapPixelBounds(map, orientation);

  return {
    id,
    orientation,
    tilesetId: getStringProperty(map.properties, "tilesetId") ?? map.tilesets[0]?.name ?? "default",
    tileWidth: map.tilewidth,
    tileHeight: map.tileheight,
    tileSize: map.tilewidth,
    width: mapPixelBounds.width,
    height: mapPixelBounds.height,
    tileTextures: registry.tileTextures,
    tileLayers: getTileLayers(map, orientation, registry.gidToTile),
    objectLayers: getObjectLayers(map, orientation, registry.gidToTile),
    plots: getVillagePlots(map, orientation),
    resourceSites: getResourceSites(map, orientation),
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

function createTilesetRegistry(id: string, tilesets: TiledTileset[]): TiledTilesetRegistry {
  if (tilesets.length === 0) {
    throw new Error(`Tiled map ${id} has no tilesets.`);
  }

  const tileTextures: Record<TerrainTextureKey, TerrainTextureDefinition> = {};
  const gidToTile = new Map<number, GidTileReference>();

  for (const mapTileset of tilesets) {
    const tileset = resolveTileset(mapTileset);
    const atlasUrl = getTileAssetUrl(tileset.image ?? "");
    const tileCount = tileset.tilecount ?? ((tileset.columns ?? 1) * Math.ceil((tileset.imageheight ?? tileset.tileheight) / tileset.tileheight));
    const columns = tileset.columns ?? Math.max(1, Math.floor((tileset.imagewidth ?? tileset.tilewidth) / tileset.tilewidth));
    const margin = tileset.margin ?? 0;
    const spacing = tileset.spacing ?? 0;
    const tilesById = new Map((tileset.tiles ?? []).map((tile) => [tile.id, tile]));
    const textureKeyByTileIndex = new Map<number, TerrainTextureKey>();

    for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
      const tile = tilesById.get(tileIndex);
      const tileId = getStringProperty(tile?.properties, "tileId") ?? `${tileset.name}_${tileIndex}`;
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
        objectAlignment: tileset.objectalignment,
        tintByEnvironment: getDefaultTerrainTintByEnvironment(tileset.name),
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

function getDefaultTerrainTintByEnvironment(tilesetId: string): TerrainEnvironmentTint | undefined {
  const normalized = tilesetId.trim().toLowerCase();

  if (normalized === "ground") {
    return {
      rain: 0x8fa2b8,
      snowFront: 0xd2dff0,
      radiation: 0xa8c483,
    };
  }

  if (normalized === "brick") {
    return {
      rain: 0x8f9098,
      snowFront: 0xd7ddea,
      radiation: 0xb1be89,
    };
  }

  if (normalized === "trees") {
    return {
      rain: 0x7f93aa,
      snowFront: 0xd6e4f4,
      radiation: 0x9db97a,
    };
  }

  if (normalized === "objects") {
    return {
      rain: 0x8d9aae,
      snowFront: 0xd3deee,
      radiation: 0xa6c27f,
    };
  }

  return {
    rain: 0x909fb2,
    snowFront: 0xd5e0ef,
    radiation: 0xa8c284,
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

  if (layer.data.length !== expectedTileCount) {
    throw new Error(
      `Tiled layer "${layer.name}" has ${layer.data.length} tiles, expected ${expectedTileCount}.`,
    );
  }
}

function getObjectLayers(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
  gidToTile: Map<number, GidTileReference>,
): VillageObjectLayerDefinition[] {
  return map.layers
    .filter((layer): layer is TiledObjectLayer =>
      layer.type === "objectgroup" && layer.visible !== false,
    )
    .map((layer) => ({
      id: String(layer.id),
      name: layer.name,
      opacity: layer.opacity ?? 1,
      objects: getMapObjects(map, orientation, layer, gidToTile),
    }));
}

function getTerrainTiles(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
  layer: TiledTileLayer,
  gidToTile: Map<number, GidTileReference>,
): Pick<TerrainTileLayerDefinition, "tiles" | "tileByIndex"> {
  const tileByIndex: Array<TerrainTilePlacement | null> = [];
  const tiles: TerrainTilePlacement[] = [];

  layer.data.forEach((rawGid, index) => {
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
): Pick<VillageMapObjectDefinition, "x" | "y"> {
  if (orientation === "orthogonal") {
    return { x: objectX, y: objectY };
  }

  // Tiled stores regular isometric object coordinates in projected-grid space,
  // where both axes are scaled by tileHeight.
  const tileX = objectX / map.tileheight;
  const tileY = objectY / map.tileheight;
  return getTilePixelPosition(map, orientation, tileX, tileY);
}

function getMapObjects(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
  layer: TiledObjectLayer,
  gidToTile: Map<number, GidTileReference>,
): VillageMapObjectDefinition[] {
  const layerOffsetX = layer.offsetx ?? 0;
  const layerOffsetY = layer.offsety ?? 0;

  return (layer.objects ?? [])
    .filter((object) => object.visible !== false)
    .map((object) => {
      const tile = object.gid ? getTileReference(object.gid, gidToTile) : null;
      const position = getObjectPixelPosition(map, orientation, object.x, object.y);
      return {
        id: String(object.id),
        name: object.name ?? "",
        type: object.type ?? "",
        x: position.x + layerOffsetX,
        y: position.y + layerOffsetY,
        width: object.width ?? 0,
        height: object.height ?? 0,
        rotation: object.rotation ?? 0,
        opacity: layer.opacity ?? 1,
        tileId: tile?.tileId ?? null,
        textureKey: tile?.textureKey ?? null,
        properties: getObjectProperties(object.properties),
      };
    });
}

function getVillagePlots(
  map: TiledMap,
  orientation: "orthogonal" | "isometric",
): VillagePlotDefinition[] {
  const plotsLayer = getNamedObjectLayer(map, "plots");

  if (!plotsLayer) {
    throw new Error("Tiled map is missing object layer \"plots\".");
  }

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
        x: position.x,
        y: position.y,
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
): VillageResourceSiteDefinition[] {
  const layer = getNamedObjectLayer(map, "resourceSites");

  if (!layer) {
    return [];
  }

  return (layer.objects ?? [])
    .filter((object) => object.visible !== false)
    .map((object) => {
      const id = getStringProperty(object.properties, "plotId") ?? object.name;
      const position = getObjectPixelPosition(map, orientation, object.x, object.y);

      if (!id) {
        throw new Error("Resource site object is missing a plotId property or name.");
      }

      const resourceId = getResourceSiteResourceId(object.properties, id);
      const captureMinTroops = Math.max(
        1,
        Math.floor(
          getNumberProperty(object.properties, "siteCaptureMinTroops") ??
          getNumberProperty(object.properties, "captureMinTroops") ??
          DEFAULT_RESOURCE_SITE_CAPTURE_MIN_TROOPS,
        ),
      );
      const captureBaseDeathRisk = Math.max(
        0.05,
        Math.min(
          0.95,
          getNumberProperty(object.properties, "siteCaptureBaseDeathRisk") ??
            getNumberProperty(object.properties, "captureBaseDeathRisk") ??
            DEFAULT_RESOURCE_SITE_CAPTURE_BASE_DEATH_RISK,
        ),
      );
      const maxWorkers = Math.max(
        1,
        Math.min(
          3,
          Math.floor(
            getNumberProperty(object.properties, "siteMaxWorkers") ??
            getNumberProperty(object.properties, "maxWorkers") ??
            DEFAULT_RESOURCE_SITE_MAX_WORKERS,
          ),
        ),
      );
      const yieldPerWorker = Math.max(
        0.001,
        getNumberProperty(object.properties, "siteYieldPerWorker") ??
          getNumberProperty(object.properties, "yieldPerWorker") ??
          DEFAULT_RESOURCE_SITE_YIELD_PER_WORKER[resourceId],
      );

      return {
        id,
        x: position.x,
        y: object.gid ? position.y - (object.height ?? 0) : position.y,
        width: object.width ?? 0,
        height: object.height ?? 0,
        resourceId,
        captureMinTroops,
        captureBaseDeathRisk,
        maxWorkers,
        yieldPerWorker,
      };
    })
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

function getNumberProperty(properties: TiledProperty[] | undefined, name: string): number | null {
  const property = properties?.find((candidate) => candidate.name === name);
  return typeof property?.value === "number" ? property.value : null;
}

function getObjectProperties(
  properties: TiledProperty[] | undefined,
): Record<string, VillageMapObjectPropertyValue> {
  const objectProperties: Record<string, VillageMapObjectPropertyValue> = {};

  for (const property of properties ?? []) {
    if (
      typeof property.value === "string" ||
      typeof property.value === "number" ||
      typeof property.value === "boolean"
    ) {
      objectProperties[property.name] = property.value;
    }
  }

  return objectProperties;
}

function getResourceSiteResourceId(
  properties: TiledProperty[] | undefined,
  siteId: string,
): ResourceSiteResourceId {
  const value = getStringProperty(properties, "siteResourceId") ??
    getStringProperty(properties, "resourceId");

  if (value === "food" || value === "water" || value === "coal" || value === "material") {
    return value;
  }

  throw new Error(
    `Resource site "${siteId}" has invalid or missing siteResourceId/resourceId property.`,
  );
}

function getNamedObjectLayer(
  map: TiledMap,
  name: string,
): TiledObjectLayer | null {
  return map.layers.find((candidate): candidate is TiledObjectLayer =>
    candidate.type === "objectgroup" &&
    candidate.name === name &&
    candidate.visible !== false,
  ) ?? null;
}
