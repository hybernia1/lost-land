import type { BuildingId } from "../game/types";
import barracksAtlasUrl from "../assets/buildings/barracks-atlas.png";
import clinicAtlasUrl from "../assets/buildings/clinic-atlas.png";
import dormitoryAtlasUrl from "../assets/buildings/dormitory-atlas.png";
import generatorAtlasUrl from "../assets/buildings/generator-atlas.png";
import hydroponicsAtlasUrl from "../assets/buildings/hydroponics-atlas.png";
import mainBuildingAtlasUrl from "../assets/buildings/main-building-atlas.png";
import marketAtlasUrl from "../assets/buildings/market-atlas.png";
import storageAtlasUrl from "../assets/buildings/storage-atlas.png";
import watchtowerAtlasUrl from "../assets/buildings/watchtower-atlas.png";
import waterStillAtlasUrl from "../assets/buildings/water-still-atlas.png";
import workshopAtlasUrl from "../assets/buildings/workshop-atlas.png";

export const BUILDING_VISUAL_LEVELS = 1;

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
};

export type BuildingVisualDefinition = BuildingAtlasVisualDefinition;

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
