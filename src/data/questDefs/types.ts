import type {
  BuildingId,
  ObjectiveQuestId,
  ResourceBag,
  ResourceId,
  SuddenQuestId,
} from "../../game/types";

export type ObjectiveQuestTarget =
  | {
      type: "buildingLevel";
      buildingId: BuildingId;
      requiredLevel: number;
    }
  | {
      type: "populationAtLeast";
      requiredPopulation: number;
    }
  | {
      type: "resourceSitesLootedAtLeast";
      requiredCount: number;
    }
  | {
      type: "resolvedDecisionsAtLeast";
      requiredCount: number;
    }
  | {
      type: "resolvedSuddenAtLeast";
      requiredCount: number;
    };

export type ObjectiveQuestTrigger =
  | "tick"
  | "buildingLevelChanged"
  | "populationChanged"
  | "resourceSitesLootedChanged"
  | "decisionResolved"
  | "randomEventResolved";

type ObjectiveQuestBase = {
  id: ObjectiveQuestId;
  trigger: ObjectiveQuestTrigger;
  target: ObjectiveQuestTarget;
  requires?: ObjectiveQuestId[];
  reward: ResourceBag;
};

type SingleObjectiveQuestDefinition = ObjectiveQuestBase & {
  kind: "single";
  chain?: never;
};

type ChainObjectiveQuestDefinition = ObjectiveQuestBase & {
  kind: "chain";
  chain: {
    id: string;
    stage: number;
  };
};

export type ObjectiveQuestDefinition =
  | SingleObjectiveQuestDefinition
  | ChainObjectiveQuestDefinition;

export type SuddenQuestDefinition = {
  id: SuddenQuestId;
  kind: "randomEvent";
  minElapsedSeconds: number;
  weight: number;
  resourceLossPercent?: Partial<Record<ResourceId, number>>;
};
