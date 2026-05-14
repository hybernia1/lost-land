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
  objectAlignment?:
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
  animation?: TerrainTileAnimationFrame[];
  tintByEnvironment?: Partial<Record<EnvironmentConditionId, number>>;
};

export type TerrainTileAnimationFrame = {
  textureKey: TerrainTextureKey;
  durationMs: number;
};
