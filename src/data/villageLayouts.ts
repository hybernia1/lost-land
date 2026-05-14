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
  drawOrder: "index" | "topdown";
  offset: {
    x: number;
    y: number;
  };
  placementMode: string | null;
  isStaticVisualLayer: boolean;
  objects: VillageMapObjectDefinition[];
};

export type VillageMapObjectRenderDefinition = {
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: {
    x: number;
    y: number;
  } | null;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  opacity: number;
};

export type VillageMapObjectDefinition = {
  id: string;
  textureKey: TerrainTextureKey | null;
  render: VillageMapObjectRenderDefinition;
};

export type VillageLayoutDefinition = {
  id: string;
  orientation: "orthogonal" | "isometric";
  tilesetId: string;
  tileWidth: number;
  tileHeight: number;
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
