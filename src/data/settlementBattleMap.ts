import settlementBattleMapRaw from "../maps/settlement-battle-01.tmj?raw";
import settlementBattleTilesetRaw from "../maps/battle-tilesets/settlement-hex.tsj?raw";
import settlementBattleTilesetUrl from "../assets/battle-tiles/settlement/settlement-hex-tiles.png";

export type SettlementBattleTileId =
  | "sand"
  | "sandDark"
  | "scrub"
  | "stoneBlocker"
  | "scrubBlocker";

export type SettlementBattleTileDefinition = {
  id: SettlementBattleTileId;
  blocksMovement: boolean;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type SettlementBattleTilePlacement = {
  q: number;
  r: number;
  tileId: SettlementBattleTileId;
};

export type SettlementBattleTileLayerDefinition = {
  name: string;
  tiles: SettlementBattleTilePlacement[];
};

export type SettlementBattleMapDefinition = {
  id: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  hexSideLength: number;
  staggerAxis: "x" | "y";
  staggerIndex: "odd" | "even";
  playerSpawnQ: number;
  enemySpawnQ: number;
  tileset: {
    atlasUrl: string;
    tileWidth: number;
    tileHeight: number;
    columns: number;
    tiles: Record<SettlementBattleTileId, SettlementBattleTileDefinition>;
  };
  tileLayers: SettlementBattleTileLayerDefinition[];
  blockedHexes: Array<{ q: number; r: number }>;
};

type TiledMapLike = {
  width?: number;
  height?: number;
  tilewidth?: number;
  tileheight?: number;
  hexsidelength?: number;
  staggeraxis?: string;
  staggerindex?: string;
  layers?: TiledLayerLike[];
  tilesets?: Array<{ firstgid: number; source?: string }>;
  properties?: Array<{ name: string; value: string | number | boolean }>;
};

type TiledLayerLike = {
  name?: string;
  type?: string;
  width?: number;
  height?: number;
  data?: number[];
  visible?: boolean;
};

type TiledTilesetLike = {
  columns?: number;
  tilewidth?: number;
  tileheight?: number;
  tiles?: Array<{
    id: number;
    properties?: Array<{ name: string; value: string | number | boolean }>;
  }>;
};

const rawMap = JSON.parse(settlementBattleMapRaw) as TiledMapLike;
const rawTileset = JSON.parse(settlementBattleTilesetRaw) as TiledTilesetLike;
const tilesetFirstGid = Math.max(1, Math.floor(rawMap.tilesets?.[0]?.firstgid ?? 1));
const tileDefinitions = getTileDefinitions(rawTileset);
const tileLayers = getTileLayers(rawMap, tilesetFirstGid, tileDefinitions);

export const settlementBattleMap: SettlementBattleMapDefinition = {
  id: "settlement-battle-01",
  width: Math.max(8, Math.floor(rawMap.width ?? 24)),
  height: Math.max(6, Math.floor(rawMap.height ?? 12)),
  tileWidth: Math.max(1, Math.floor(rawMap.tilewidth ?? 64)),
  tileHeight: Math.max(1, Math.floor(rawMap.tileheight ?? 56)),
  hexSideLength: Math.max(0, Math.floor(rawMap.hexsidelength ?? 16)),
  staggerAxis: rawMap.staggeraxis === "x" ? "x" : "y",
  staggerIndex: rawMap.staggerindex === "even" ? "even" : "odd",
  playerSpawnQ: getNumberProperty(rawMap, "playerSpawnQ", 2),
  enemySpawnQ: getNumberProperty(rawMap, "enemySpawnQ", Math.max(5, Math.floor(rawMap.width ?? 24) - 3)),
  tileset: {
    atlasUrl: settlementBattleTilesetUrl,
    tileWidth: Math.max(1, Math.floor(rawTileset.tilewidth ?? rawMap.tilewidth ?? 64)),
    tileHeight: Math.max(1, Math.floor(rawTileset.tileheight ?? rawMap.tileheight ?? 56)),
    columns: Math.max(1, Math.floor(rawTileset.columns ?? 1)),
    tiles: tileDefinitions,
  },
  tileLayers,
  blockedHexes: getBlockedHexes(tileLayers, tileDefinitions),
};

export function isSettlementBattleHexBlocked(q: number, r: number): boolean {
  return settlementBattleMap.blockedHexes.some((hex) => hex.q === q && hex.r === r);
}

function getNumberProperty(map: TiledMapLike, name: string, fallback: number): number {
  const value = map.properties?.find((property) => property.name === name)?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getTileDefinitions(tileset: TiledTilesetLike): Record<SettlementBattleTileId, SettlementBattleTileDefinition> {
  const tileWidth = Math.max(1, Math.floor(tileset.tilewidth ?? 64));
  const tileHeight = Math.max(1, Math.floor(tileset.tileheight ?? 56));
  const columns = Math.max(1, Math.floor(tileset.columns ?? 1));
  const entries = (tileset.tiles ?? []).map((tile) => {
    const tileId = getStringProperty(tile.properties, "tileId") as SettlementBattleTileId | null;

    if (!tileId) {
      return null;
    }

    return [
      tileId,
      {
        id: tileId,
        blocksMovement: getBooleanProperty(tile.properties, "blocksMovement"),
        frame: {
          x: (tile.id % columns) * tileWidth,
          y: Math.floor(tile.id / columns) * tileHeight,
          width: tileWidth,
          height: tileHeight,
        },
      },
    ] as const;
  }).filter((entry): entry is readonly [SettlementBattleTileId, SettlementBattleTileDefinition] => Boolean(entry));

  return Object.fromEntries(entries) as Record<SettlementBattleTileId, SettlementBattleTileDefinition>;
}

function getTileLayers(
  map: TiledMapLike,
  firstGid: number,
  tileDefinitions: Record<SettlementBattleTileId, SettlementBattleTileDefinition>,
): SettlementBattleTileLayerDefinition[] {
  const tileIdByLocalId = new Map(
    Object.values(tileDefinitions).map((definition, index) => [index, definition.id]),
  );

  return (map.layers ?? [])
    .filter((layer) => layer.type === "tilelayer" && layer.visible !== false && Array.isArray(layer.data))
    .map((layer) => {
      const width = Math.max(1, Math.floor(layer.width ?? map.width ?? 1));
      const data = layer.data ?? [];

      return {
        name: layer.name ?? "layer",
        tiles: data.flatMap((gid, index): SettlementBattleTilePlacement[] => {
          if (gid <= 0) {
            return [];
          }

          const tileId = tileIdByLocalId.get(gid - firstGid);
          if (!tileId) {
            return [];
          }

          return [{
            q: index % width,
            r: Math.floor(index / width),
            tileId,
          }];
        }),
      };
    });
}

function getBlockedHexes(
  tileLayers: SettlementBattleTileLayerDefinition[],
  tileDefinitions: Record<SettlementBattleTileId, SettlementBattleTileDefinition>,
): Array<{ q: number; r: number }> {
  const blocked = new Map<string, { q: number; r: number }>();

  for (const layer of tileLayers) {
    for (const tile of layer.tiles) {
      if (!tileDefinitions[tile.tileId].blocksMovement) {
        continue;
      }

      blocked.set(`${tile.q}:${tile.r}`, { q: tile.q, r: tile.r });
    }
  }

  return Array.from(blocked.values());
}

function getStringProperty(
  properties: Array<{ name: string; value: string | number | boolean }> | undefined,
  name: string,
): string | null {
  const value = properties?.find((property) => property.name === name)?.value;
  return typeof value === "string" ? value : null;
}

function getBooleanProperty(
  properties: Array<{ name: string; value: string | number | boolean }> | undefined,
  name: string,
): boolean {
  const value = properties?.find((property) => property.name === name)?.value;
  return value === true;
}
