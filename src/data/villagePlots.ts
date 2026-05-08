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

export const villagePlotDefinitions: VillagePlotDefinition[] = [
  {
    id: "plot-palisade",
    x: 0.5,
    y: 0.9,
    width: 180,
    height: 44,
    allowedBuildingIds: ["palisade"],
    kind: "perimeter",
  },
  {
    id: "plot-main",
    x: 0.5,
    y: 0.5,
    width: 128,
    height: 88,
    allowedBuildingIds: ["mainBuilding"],
  },
  { id: "plot-01", x: 0.5, y: 0.27, width: 112, height: 76 },
  { id: "plot-02", x: 0.34, y: 0.34, width: 108, height: 72 },
  { id: "plot-03", x: 0.66, y: 0.34, width: 108, height: 72 },
  { id: "plot-04", x: 0.26, y: 0.5, width: 104, height: 70 },
  { id: "plot-05", x: 0.74, y: 0.5, width: 104, height: 70 },
  { id: "plot-06", x: 0.34, y: 0.66, width: 108, height: 72 },
  { id: "plot-07", x: 0.66, y: 0.66, width: 108, height: 72 },
  { id: "plot-08", x: 0.5, y: 0.75, width: 112, height: 74 },
  { id: "plot-09", x: 0.2, y: 0.68, width: 98, height: 62 },
  { id: "plot-10", x: 0.8, y: 0.68, width: 98, height: 62 },
  { id: "plot-11", x: 0.2, y: 0.34, width: 98, height: 62 },
  { id: "plot-12", x: 0.8, y: 0.34, width: 98, height: 62 },
];
