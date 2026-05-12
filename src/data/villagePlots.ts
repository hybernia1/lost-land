import type { BuildingId, ResourceSiteResourceId } from "../game/types";

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

export type VillageResourceSiteDefinition = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  resourceId: ResourceSiteResourceId;
  captureMinTroops: number;
  captureBaseDeathRisk: number;
  maxWorkers: number;
  yieldPerWorker: number;
};

export const villagePlotRulesById: Record<string, VillagePlotRule> = {
  "plot-main": {
    allowedBuildingIds: ["mainBuilding"],
  },
};

export function plotAllowsBuilding(
  plot: Pick<VillagePlotDefinition, "allowedBuildingIds">,
  buildingId: BuildingId,
): boolean {
  return plot.allowedBuildingIds?.includes(buildingId) ?? false;
}

export function findFirstPlotIdForBuilding(
  plots: ReadonlyArray<Pick<VillagePlotDefinition, "id" | "allowedBuildingIds">>,
  buildingId: BuildingId,
): string | null {
  return plots.find((plot) => plotAllowsBuilding(plot, buildingId))?.id ?? null;
}
