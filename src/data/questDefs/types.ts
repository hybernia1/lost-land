import type {
  BuildingId,
  ObjectiveQuestId,
  ResourceBag,
  ResourceId,
  SuddenQuestId,
} from "../../game/types";

export type ObjectiveQuestDefinition = {
  id: ObjectiveQuestId;
  buildingId: BuildingId;
  requiredLevel: number;
  prerequisiteIds?: ObjectiveQuestId[];
  reward: ResourceBag;
};

export type SuddenQuestDefinition = {
  id: SuddenQuestId;
  minElapsedSeconds: number;
  weight: number;
  resourceLossPercent?: Partial<Record<ResourceId, number>>;
};
