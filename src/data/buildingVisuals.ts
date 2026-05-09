import type { BuildingId } from "../game/types";
import mainBuildingAtlasUrl from "../assets/buildings/main-building-atlas.png";

export const BUILDING_VISUAL_LEVELS = 20;

export type BuildingAtlasVisualDefinition = {
  kind: "atlas";
  atlasId: "building-atlas";
  atlasUrl: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  levels: number;
  framePrefix: string;
};

export type BuildingVisualDefinition = BuildingAtlasVisualDefinition;

export const buildingVisualDefinitions: Partial<Record<BuildingId, BuildingVisualDefinition>> = {
  mainBuilding: {
    kind: "atlas",
    atlasId: "building-atlas",
    atlasUrl: mainBuildingAtlasUrl,
    frameWidth: 256,
    frameHeight: 256,
    columns: 5,
    rows: 4,
    levels: BUILDING_VISUAL_LEVELS,
    framePrefix: "mainBuilding",
  },
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
