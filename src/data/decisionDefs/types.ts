import type {
  DecisionProfileAxisId,
  DecisionOptionId,
  DecisionQuestId,
  ResourceBag,
} from "../../game/types";

export type DecisionQuestOptionDefinition = {
  id: DecisionOptionId;
  resources?: ResourceBag;
  workers?: number;
  injured?: number;
  morale?: number;
  profileScores?: Partial<Record<DecisionProfileAxisId, number>>;
};

export type DecisionQuestDraftDefinition = {
  id: DecisionQuestId;
  minElapsedSeconds: number;
  weight: number;
  options: DecisionQuestOptionDefinition[];
};

export type DecisionQuestDefinition = DecisionQuestDraftDefinition & {
  kind: "decision";
};
