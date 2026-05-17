import type { BuildingId, ResourceId } from "../game/types";

export type Locale = "cs" | "en";

export type QuestTranslationPack = {
  ui: Record<string, string>;
  objectives: Record<string, {
    title: string;
    description: string;
  }>;
  decisions: Record<string, {
    title: string;
    body: string;
    options: Record<string, string>;
    results: Record<string, string>;
  }>;
  sudden: Record<string, {
    title: string;
    result: string;
  }>;
};

export type TranslationPack = {
  locale: Locale;
  label: string;
  ui: Record<string, string>;
  resources: Record<ResourceId, string>;
  resourceDescriptions: Record<ResourceId, string>;
  buildings: Record<BuildingId, { name: string; description: string }>;
  quests: QuestTranslationPack;
  roles: Record<string, string>;
};
