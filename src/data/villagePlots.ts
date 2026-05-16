import type { BuildingId, EnemyUnitCounts, ResourceSiteLoot } from "../game/types";

export type VillagePlotDefinition = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  allowedBuildingIds?: BuildingId[];
};

export type VillagePlotRule = Pick<VillagePlotDefinition, "allowedBuildingIds">;

export type VillageResourceSiteDefinition = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  palisadeType: VillageResourceSitePalisadeType;
  loot: ResourceSiteLoot;
  defenderArmy: EnemyUnitCounts;
};

export type VillageResourceSitePalisadeType = "wood" | "stone" | "scrap";

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
