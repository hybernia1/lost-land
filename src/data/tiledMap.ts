import type { TerrainTextureDefinition, TerrainTextureKey, TerrainTileId } from "./terrainTiles";
import { getTileAssetUrl, getTiledTilesetSource } from "./tiledAssets";
import type {
  TerrainTileLayerDefinition,
  TerrainTilePlacement,
  VillageLayoutDefinition,
  VillageMapObjectDefinition,
  VillageObjectLayerDefinition,
} from "./villageLayouts";
import { villagePlotRulesById, type VillagePlotDefinition } from "./villagePlots";

type TiledProperty = {
  name: string;
  type?: string;
  value: unknown;
};

type TiledTilesetTile = {
  id: number;
  properties?: TiledProperty[];
};

type TiledTileset = {
  firstgid: number;
  name: string;
  source?: string;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  columns?: number;
  tilecount?: number;
  tilewidth: number;
  tileheight: number;
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
};

type TiledLayer = TiledTileLayer | TiledObjectLayer | {
  id: number;
  name: string;
  type: string;
  visible?: boolean;
};

type TiledMap = {
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
  const registry = createTilesetRegistry(id, map.tilesets);

  return {
    id,
    tilesetId: getStringProperty(map.properties, "tilesetId") ?? map.tilesets[0]?.name ?? "default",
    tileSize: map.tilewidth,
    width: map.width * map.tilewidth,
    height: map.height * map.tileheight,
    tileTextures: registry.tileTextures,
    tileLayers: getTileLayers(map, registry.gidToTile),
    objectLayers: getObjectLayers(map, registry.gidToTile),
    plots: getVillagePlots(map),
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

    for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
      const tile = tileset.tiles?.find((candidate) => candidate.id === tileIndex);
      const tileId = getStringProperty(tile?.properties, "tileId") ?? `${tileset.name}_${tileIndex}`;
      const textureKey = `${tileset.name}:${tileId}`;
      const frame = {
        x: (tileIndex % columns) * tileset.tilewidth,
        y: Math.floor(tileIndex / columns) * tileset.tileheight,
        width: tileset.tilewidth,
        height: tileset.tileheight,
      };

      tileTextures[textureKey] = {
        key: textureKey,
        tileId,
        tilesetId: tileset.name,
        atlasUrl,
        frame,
        tintByEnvironment: getEnvironmentTint(tileId),
      };
      gidToTile.set(tileset.firstgid + tileIndex, { tileId, textureKey });
    }
  }

  return { tileTextures, gidToTile };
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
  gidToTile: Map<number, GidTileReference>,
): TerrainTileLayerDefinition[] {
  const layers = map.layers.filter((layer): layer is TiledTileLayer =>
    layer.type === "tilelayer" && layer.visible !== false,
  );

  if (!layers.some((layer) => layer.name === "terrain_base")) {
    throw new Error("Tiled map is missing tile layer \"terrain_base\".");
  }

  return layers.map((layer) => {
    validateTileLayer(map, layer);
    const terrainTiles = getTerrainTiles(layer, gidToTile);

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
      objects: getMapObjects(layer, gidToTile),
    }));
}

function getTerrainTiles(
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

    const placement = {
      x: index % layer.width,
      y: Math.floor(index / layer.width),
      tileId: tile.tileId,
      textureKey: tile.textureKey,
      ...getTileTransform(rawGid),
    };

    tileByIndex.push(placement);
    tiles.push(placement);
  });

  return { tiles, tileByIndex };
}

function getMapObjects(
  layer: TiledObjectLayer,
  gidToTile: Map<number, GidTileReference>,
): VillageMapObjectDefinition[] {
  return (layer.objects ?? [])
    .filter((object) => object.visible !== false)
    .map((object) => {
      const tile = object.gid ? getTileReference(object.gid, gidToTile) : null;
      return {
        id: String(object.id),
        name: object.name ?? "",
        type: object.type ?? "",
        x: object.x,
        y: object.y,
        width: object.width ?? 0,
        height: object.height ?? 0,
        rotation: object.rotation ?? 0,
        opacity: layer.opacity ?? 1,
        tileId: tile?.tileId ?? null,
        textureKey: tile?.textureKey ?? null,
      };
    });
}

function getVillagePlots(map: TiledMap): VillagePlotDefinition[] {
  const layer = map.layers.find((candidate): candidate is TiledObjectLayer =>
    candidate.type === "objectgroup" && candidate.name === "plots" && candidate.visible !== false,
  );

  if (!layer) {
    throw new Error("Tiled map is missing object layer \"plots\".");
  }

  const plots = (layer.objects ?? [])
    .filter((object) => object.visible !== false)
    .map((object) => {
      const id = getStringProperty(object.properties, "plotId") ?? object.name;

      if (!id) {
        throw new Error("Tiled plot object is missing a plotId property or name.");
      }

      return {
        id,
        x: object.x,
        y: object.y,
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

function getEnvironmentTint(tileId: string): TerrainTextureDefinition["tintByEnvironment"] {
  return tileId === "radiationSoil"
    ? { radiation: 0xb8d96b }
    : undefined;
}

function getStringProperty(properties: TiledProperty[] | undefined, name: string): string | null {
  const property = properties?.find((candidate) => candidate.name === name);
  return typeof property?.value === "string" ? property.value : null;
}
