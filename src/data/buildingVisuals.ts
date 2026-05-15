import type { BuildingId } from "../game/types";
import academyTextureUrl from "../assets/buildings/academy.png";
import barracksTextureUrl from "../assets/buildings/barracks.png";
import clinicTextureUrl from "../assets/buildings/clinic.png";
import dormitoryTextureUrl from "../assets/buildings/dormitory.png";
import generatorTextureUrl from "../assets/buildings/generator.png";
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
};

export type BuildingVisualDefinition = BuildingTextureVisualDefinition;

export type BuildingVisualPoint = {
  x: number;
  y: number;
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
    fit: {
      footprintWidthScale: 2.18,
    },
  }),
  dormitory: singleTexture(dormitoryTextureUrl, {
    fit: {
      footprintWidthScale: 2.22,
    },
  }),
  hydroponics: singleTexture(hydroponicsTextureUrl, {
    fit: {
      footprintWidthScale: 2.08,
    },
  }),
  waterStill: singleTexture(waterStillTextureUrl, {
    fit: {
      footprintWidthScale: 2.02,
    },
  }),
  workshop: singleTexture(workshopTextureUrl, {
    fit: {
      footprintWidthScale: 2.12,
    },
  }),
  generator: singleTexture(generatorTextureUrl, {
    fit: {
      footprintWidthScale: 2.08,
    },
  }),
  market: singleTexture(marketTextureUrl, {
    fit: {
      footprintWidthScale: 2.2,
    },
  }),
  watchtower: singleTexture(watchtowerTextureUrl, {
    placement: {
      anchor: { x: 0.476, y: 0.802 },
    },
    fit: {
      footprintWidthScale: 1.58,
      visualHeightScale: 5.9,
    },
  }),
  barracks: singleTexture(barracksTextureUrl, {
    fit: {
      footprintWidthScale: 2.18,
    },
  }),
  academy: singleTexture(academyTextureUrl, {
    fit: {
      footprintWidthScale: 2.16,
    },
  }),
  clinic: singleTexture(clinicTextureUrl, {
    fit: {
      footprintWidthScale: 2.04,
    },
  }),
};
