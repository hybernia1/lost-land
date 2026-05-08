import type { BuildingId, ResourceId, TileKind } from "../game/types";

export type Locale = "cs" | "en";

export type TranslationPack = {
  locale: Locale;
  label: string;
  ui: Record<string, string>;
  resources: Record<ResourceId, string>;
  resourceDescriptions: Record<ResourceId, string>;
  buildings: Record<BuildingId, { name: string; description: string }>;
  tiles: Record<TileKind, string>;
  roles: Record<string, string>;
};
