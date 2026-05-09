import type { BuildingId } from "../game/types";

export type VillagePlotDefinition = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  allowedBuildingIds?: BuildingId[];
  kind?: "building" | "perimeter";
};

export type VillagePlotRule = Pick<VillagePlotDefinition, "allowedBuildingIds" | "kind">;

export const villagePlotRulesById: Record<string, VillagePlotRule> = {
  "plot-palisade": {
    allowedBuildingIds: ["palisade"],
    kind: "perimeter",
  },
  "plot-main": {
    allowedBuildingIds: ["mainBuilding"],
  },
};
