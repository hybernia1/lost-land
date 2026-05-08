import type { BuildingId } from "../game/types";
import mainBuildingPhasesUrl from "../assets/buildings/main-building-phases.png";

export type BuildingVisualDefinition = {
  spritesheetUrl: string;
  frames: number;
  phases: Array<{
    minLevel: number;
    maxLevel: number;
    frame: number;
  }>;
};

export const buildingVisualDefinitions: Partial<Record<BuildingId, BuildingVisualDefinition>> = {
  mainBuilding: {
    spritesheetUrl: mainBuildingPhasesUrl,
    frames: 5,
    phases: [
      { minLevel: 1, maxLevel: 5, frame: 0 },
      { minLevel: 6, maxLevel: 10, frame: 1 },
      { minLevel: 11, maxLevel: 15, frame: 2 },
      { minLevel: 16, maxLevel: 19, frame: 3 },
      { minLevel: 20, maxLevel: 20, frame: 4 },
    ],
  },
};

export function getBuildingVisualFrame(buildingId: BuildingId, level: number): number {
  const visual = buildingVisualDefinitions[buildingId];

  if (!visual) {
    return 0;
  }

  const phase = visual.phases.find(
    (candidate) => level >= candidate.minLevel && level <= candidate.maxLevel,
  );

  return phase?.frame ?? visual.phases[visual.phases.length - 1]?.frame ?? 0;
}
