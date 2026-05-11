import woodlandCampMapRaw from "../maps/woodland-camp-01.tmj?raw";
import { createVillageLayoutFromTiled } from "./tiledMap";
import type { TerrainTextureDefinition, TerrainTextureKey, TerrainTileId } from "./terrainTiles";
import type { VillagePlotDefinition, VillageResourceSiteDefinition } from "./villagePlots";

export type TerrainTilePlacement = {
  x: number;
  y: number;
  tileId: TerrainTileId;
  textureKey: TerrainTextureKey;
  rotation?: 0 | 90 | 180 | 270;
  flipX?: boolean;
  flipY?: boolean;
};

export type TerrainTileLayerDefinition = {
  id: string;
  name: string;
  opacity: number;
  width: number;
  height: number;
  tiles: TerrainTilePlacement[];
  tileByIndex: Array<TerrainTilePlacement | null>;
};

export type VillageObjectLayerDefinition = {
  id: string;
  name: string;
  opacity: number;
  objects: VillageMapObjectDefinition[];
};

export type VillageMapObjectDefinition = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  tileId: TerrainTileId | null;
  textureKey: TerrainTextureKey | null;
};

export type VillageLayoutDefinition = {
  id: string;
  tilesetId: string;
  tileSize: number;
  width: number;
  height: number;
  tileTextures: Record<TerrainTextureKey, TerrainTextureDefinition>;
  tileLayers: TerrainTileLayerDefinition[];
  objectLayers: VillageObjectLayerDefinition[];
  plots: VillagePlotDefinition[];
  resourceSites: VillageResourceSiteDefinition[];
};

export const defaultVillageLayout = createVillageLayoutFromTiled(
  "woodland-camp-01",
  woodlandCampMapRaw,
);

export const villageLayoutDefinitions: VillageLayoutDefinition[] = [
  defaultVillageLayout,
];

export const villageLayoutById = Object.fromEntries(
  villageLayoutDefinitions.map((layout) => [layout.id, layout]),
) as Record<string, VillageLayoutDefinition>;
