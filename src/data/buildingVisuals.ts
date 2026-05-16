import type { BuildingId } from "../game/types";
import academyTextureUrl from "../assets/buildings/academy.png";
import barracksTextureUrl from "../assets/buildings/barracks.png";
import clinicTextureUrl from "../assets/buildings/clinic.png";
import dormitoryTextureUrl from "../assets/buildings/dormitory.png";
import coalMineTextureUrl from "../assets/buildings/coal-mine.png";
import hydroponicsTextureUrl from "../assets/buildings/hydroponics.png";
import mainBuildingTextureUrl from "../assets/buildings/main-building.png";
import marketTextureUrl from "../assets/buildings/market.png";
import storageTextureUrl from "../assets/buildings/storage.png";
import watchtowerTextureUrl from "../assets/buildings/watchtower.png";
import waterStillTextureUrl from "../assets/buildings/water-still.png";
import workshopTextureUrl from "../assets/buildings/workshop.png";

export type BuildingTextureVisualDefinition = {
  kind: "texture";
  textureUrl: string;
  placement?: BuildingVisualPlacementDefinition;
  fit?: BuildingVisualFitDefinition;
  previewBounds?: BuildingVisualBoundsDefinition;
};

export type BuildingVisualDefinition = BuildingTextureVisualDefinition;

export type BuildingVisualPoint = {
  x: number;
  y: number;
};

export type BuildingVisualBoundsDefinition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BuildingVisualPlacementDefinition = {
  anchor?: BuildingVisualPoint;
  offset?: BuildingVisualPoint;
};

export type BuildingVisualFitDefinition = {
  footprintWidthScale?: number;
  visualHeightScale?: number;
};

function singleTexture(
  textureUrl: string,
  options: Omit<BuildingTextureVisualDefinition, "kind" | "textureUrl"> = {},
): BuildingTextureVisualDefinition {
  return {
    kind: "texture",
    textureUrl,
    ...options,
  };
}

export const buildingVisualDefinitions: Partial<Record<BuildingId, BuildingVisualDefinition>> = {
  mainBuilding: singleTexture(mainBuildingTextureUrl, {
    previewBounds: { x: 25, y: 43, width: 206, height: 195 },
    placement: {
      anchor: { x: 0.5, y: 0.82 },
      offset: { x: 0, y: 30 },
    },
    fit: {
      footprintWidthScale: 2.55,
      visualHeightScale: 6.4,
    },
  }),
  storage: singleTexture(storageTextureUrl, {
    previewBounds: { x: 22, y: 44, width: 211, height: 166 },
    fit: {
      footprintWidthScale: 2.18,
    },
  }),
  dormitory: singleTexture(dormitoryTextureUrl, {
    previewBounds: { x: 28, y: 28, width: 200, height: 178 },
    fit: {
      footprintWidthScale: 2.22,
    },
  }),
  hydroponics: singleTexture(hydroponicsTextureUrl, {
    previewBounds: { x: 36, y: 51, width: 183, height: 147 },
    fit: {
      footprintWidthScale: 2.08,
    },
  }),
  waterStill: singleTexture(waterStillTextureUrl, {
    previewBounds: { x: 47, y: 10, width: 162, height: 196 },
    fit: {
      footprintWidthScale: 2.02,
    },
  }),
  workshop: singleTexture(workshopTextureUrl, {
    previewBounds: { x: 27, y: 21, width: 202, height: 187 },
    fit: {
      footprintWidthScale: 2.12,
    },
  }),
  coalMine: singleTexture(coalMineTextureUrl, {
    previewBounds: { x: 33, y: 49, width: 190, height: 159 },
    fit: {
      footprintWidthScale: 2.08,
    },
  }),
  market: singleTexture(marketTextureUrl, {
    previewBounds: { x: 60, y: 58, width: 136, height: 135 },
    fit: {
      footprintWidthScale: 2.2,
    },
  }),
  watchtower: singleTexture(watchtowerTextureUrl, {
    previewBounds: { x: 68, y: 153, width: 121, height: 269 },
    placement: {
      anchor: { x: 0.476, y: 0.802 },
    },
    fit: {
      footprintWidthScale: 1.58,
      visualHeightScale: 5.9,
    },
  }),
  barracks: singleTexture(barracksTextureUrl, {
    previewBounds: { x: 29, y: 15, width: 198, height: 202 },
    fit: {
      footprintWidthScale: 2.18,
    },
  }),
  academy: singleTexture(academyTextureUrl, {
    previewBounds: { x: 29, y: 15, width: 198, height: 193 },
    fit: {
      footprintWidthScale: 2.16,
    },
  }),
  clinic: singleTexture(clinicTextureUrl, {
    previewBounds: { x: 46, y: 72, width: 164, height: 150 },
    fit: {
      footprintWidthScale: 2.04,
    },
  }),
};
