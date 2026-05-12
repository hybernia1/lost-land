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
};

export type BuildingVisualDefinition = BuildingTextureVisualDefinition;

function singleTexture(textureUrl: string): BuildingTextureVisualDefinition {
  return {
    kind: "texture",
    textureUrl,
  };
}

export const buildingVisualDefinitions: Partial<Record<BuildingId, BuildingVisualDefinition>> = {
  mainBuilding: singleTexture(mainBuildingTextureUrl),
  storage: singleTexture(storageTextureUrl),
  dormitory: singleTexture(dormitoryTextureUrl),
  hydroponics: singleTexture(hydroponicsTextureUrl),
  waterStill: singleTexture(waterStillTextureUrl),
  workshop: singleTexture(workshopTextureUrl),
  generator: singleTexture(generatorTextureUrl),
  market: singleTexture(marketTextureUrl),
  watchtower: singleTexture(watchtowerTextureUrl),
  barracks: singleTexture(barracksTextureUrl),
  academy: singleTexture(academyTextureUrl),
  clinic: singleTexture(clinicTextureUrl),
};
