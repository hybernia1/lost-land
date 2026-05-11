import type { BuildingId } from "../game/types";
import barracksAtlasUrl from "../assets/buildings/barracks-atlas.png";
import clinicAtlasUrl from "../assets/buildings/clinic-atlas.png";
import dormitoryAtlasUrl from "../assets/buildings/dormitory-atlas.png";
import generatorAtlasUrl from "../assets/buildings/generator-atlas.png";
import hydroponicsAtlasUrl from "../assets/buildings/hydroponics-atlas.png";
import marketAtlasUrl from "../assets/buildings/market-atlas.png";
import mainBuildingAtlasUrl from "../assets/buildings/main-building-atlas.png";
import storageAtlasUrl from "../assets/buildings/storage-atlas.png";
import watchtowerAtlasUrl from "../assets/buildings/watchtower-atlas.png";
import waterStillAtlasUrl from "../assets/buildings/water-still-atlas.png";
import workshopAtlasUrl from "../assets/buildings/workshop-atlas.png";
import { getBuildingAssetUrl } from "./tiledAssets";

export const BUILDING_VISUAL_LEVELS = 1;

export type BuildingAtlasFrameDefinition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BuildingAnimationFrameDefinition = {
  frameKey: string;
  durationMs: number;
};

export type BuildingAtlasVisualDefinition = {
  kind: "atlas";
  atlasId: string;
  atlasUrl: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  levels: number;
  framePrefix: string;
  frames?: Record<string, BuildingAtlasFrameDefinition>;
  animations?: Record<string, BuildingAnimationFrameDefinition[]>;
};

export type BuildingVisualDefinition = BuildingAtlasVisualDefinition;

type TiledProperty = {
  name: string;
  value: unknown;
};

type TiledAnimationFrame = {
  tileid: number;
  duration: number;
};

type TiledTilesetTile = {
  id: number;
  animation?: TiledAnimationFrame[];
  properties?: TiledProperty[];
};

type TiledTileset = {
  columns?: number;
  image: string;
  imageheight?: number;
  imagewidth?: number;
  name: string;
  tilecount?: number;
  tileheight: number;
  tilewidth: number;
  tiles?: TiledTilesetTile[];
};

function singleFrameAtlas(atlasId: string, atlasUrl: string, framePrefix: string): BuildingAtlasVisualDefinition {
  return {
    kind: "atlas",
    atlasId,
    atlasUrl,
    frameWidth: 256,
    frameHeight: 256,
    columns: 1,
    rows: 1,
    levels: BUILDING_VISUAL_LEVELS,
    framePrefix,
  };
}

function tiledBuildingAtlas(
  atlasId: string,
  tilesetSource: string,
  framePrefix: string,
): BuildingAtlasVisualDefinition {
  const tileset = JSON.parse(tilesetSource) as TiledTileset;
  const columns = tileset.columns ?? Math.max(1, Math.floor((tileset.imagewidth ?? tileset.tilewidth) / tileset.tilewidth));
  const rows = Math.max(1, Math.ceil((tileset.tilecount ?? columns) / columns));
  const tileCount = tileset.tilecount ?? columns * rows;
  const frames: Record<string, BuildingAtlasFrameDefinition> = {};
  const frameKeysByTileId = new Map<number, string>();

  for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
    const tile = tileset.tiles?.find((candidate) => candidate.id === tileIndex);
    const frameKey = getStringProperty(tile?.properties, "frameKey") ?? `${framePrefix}_${tileIndex + 1}`;

    frameKeysByTileId.set(tileIndex, frameKey);
    frames[frameKey] = {
      x: (tileIndex % columns) * tileset.tilewidth,
      y: Math.floor(tileIndex / columns) * tileset.tileheight,
      width: tileset.tilewidth,
      height: tileset.tileheight,
    };
  }

  return {
    kind: "atlas",
    atlasId,
    atlasUrl: getBuildingAssetUrl(tileset.image),
    frameWidth: tileset.tilewidth,
    frameHeight: tileset.tileheight,
    columns,
    rows,
    levels: BUILDING_VISUAL_LEVELS,
    framePrefix,
    frames,
    animations: getTiledAnimations(tileset, frameKeysByTileId),
  };
}

function getTiledAnimations(
  tileset: TiledTileset,
  frameKeysByTileId: Map<number, string>,
): Record<string, BuildingAnimationFrameDefinition[]> {
  const animations: Record<string, BuildingAnimationFrameDefinition[]> = {};

  for (const tile of tileset.tiles ?? []) {
    if (!tile.animation || tile.animation.length === 0) {
      continue;
    }

    const frameKey = frameKeysByTileId.get(tile.id);

    if (!frameKey) {
      continue;
    }

    animations[frameKey] = tile.animation.flatMap((frame) => {
      const animationFrameKey = frameKeysByTileId.get(frame.tileid);
      return animationFrameKey
        ? [{ frameKey: animationFrameKey, durationMs: frame.duration }]
        : [];
    });
  }

  return animations;
}

function getStringProperty(properties: TiledProperty[] | undefined, name: string): string | null {
  const property = properties?.find((candidate) => candidate.name === name);
  return typeof property?.value === "string" ? property.value : null;
}

export const buildingVisualDefinitions: Partial<Record<BuildingId, BuildingVisualDefinition>> = {
  mainBuilding: singleFrameAtlas("main-building-atlas", mainBuildingAtlasUrl, "mainBuilding"),
  storage: singleFrameAtlas("storage-atlas", storageAtlasUrl, "storage"),
  dormitory: singleFrameAtlas("dormitory-atlas", dormitoryAtlasUrl, "dormitory"),
  hydroponics: singleFrameAtlas("hydroponics-atlas", hydroponicsAtlasUrl, "hydroponics"),
  waterStill: singleFrameAtlas("water-still-atlas", waterStillAtlasUrl, "waterStill"),
  workshop: singleFrameAtlas("workshop-atlas", workshopAtlasUrl, "workshop"),
  generator: singleFrameAtlas("generator-atlas", generatorAtlasUrl, "generator"),
  market: singleFrameAtlas("market-atlas", marketAtlasUrl, "market"),
  watchtower: singleFrameAtlas("watchtower-atlas", watchtowerAtlasUrl, "watchtower"),
  barracks: singleFrameAtlas("barracks-atlas", barracksAtlasUrl, "barracks"),
  academy: singleFrameAtlas("storage-atlas", storageAtlasUrl, "storage"),
  clinic: singleFrameAtlas("clinic-atlas", clinicAtlasUrl, "clinic"),
};

export function getBuildingVisualLevel(level: number): number {
  return Math.max(1, Math.min(BUILDING_VISUAL_LEVELS, Math.floor(level)));
}

export function getBuildingVisualPhase(level: number): number {
  return Math.min(4, Math.floor((getBuildingVisualLevel(level) - 1) / 4));
}

export function getBuildingVisualFrameKey(buildingId: BuildingId, level: number): string {
  const visual = buildingVisualDefinitions[buildingId];
  const visualLevel = getBuildingVisualLevel(level);

  if (visual?.kind === "atlas") {
    return `${visual.framePrefix}_${visualLevel}`;
  }

  return `${buildingId}_${visualLevel}`;
}
