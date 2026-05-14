import type { EnvironmentConditionId } from "../game/types";

export type TerrainTileId = string;
export type TerrainTextureKey = string;

export type TerrainTileFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TerrainRenderPoint = {
  x: number;
  y: number;
};

export type TerrainTextureDefinition = {
  key: TerrainTextureKey;
  tileId: TerrainTileId;
  tilesetId: string;
  atlasUrl: string;
  frame: TerrainTileFrame;
  tileLayerOffset: TerrainRenderPoint;
  objectAnchor: TerrainRenderPoint;
  edgeOverscan: number;
  animation?: TerrainTileAnimationFrame[];
  tintByEnvironment?: Partial<Record<EnvironmentConditionId, number>>;
};

export type TerrainTileAnimationFrame = {
  textureKey: TerrainTextureKey;
  durationMs: number;
};
