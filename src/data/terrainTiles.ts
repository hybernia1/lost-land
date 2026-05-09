import type { EnvironmentConditionId } from "../game/types";

export type TerrainTileId = string;
export type TerrainTextureKey = string;

export type TerrainTileFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TerrainTextureDefinition = {
  key: TerrainTextureKey;
  tileId: TerrainTileId;
  tilesetId: string;
  atlasUrl: string;
  frame: TerrainTileFrame;
  tintByEnvironment?: Partial<Record<EnvironmentConditionId, number>>;
};
