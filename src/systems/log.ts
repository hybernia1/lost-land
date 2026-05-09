import type { BuildingId, GameState, LogEntry, ObjectiveQuestId, ResourceId } from "../game/types";
import { loadLocale, packs } from "../i18n";
import type { TranslationPack } from "../i18n/types";

type LogParams = Record<string, string | number>;

export function pushLocalizedLog(
  state: GameState,
  key: string,
  params: LogParams = {},
): void {
  pushLogEntry(state, {
    source: "ui",
    key,
    params,
  });
}

export function getLocalizedUiText(
  key: string,
  params: LogParams = {},
): string {
  const translations = packs[loadLocale()];
  const template = translations.ui[key] ?? key;

  return formatTemplate(template, params);
}

export function getLocalizedInitialLogEntries(): LogEntry[] {
  return [
    { source: "ui", key: "logDayOne" },
    { source: "ui", key: "logPerimeter" },
  ];
}

export function normalizeLogEntries(log: Array<LogEntry | string> = []): LogEntry[] {
  return log
    .map((entry) => {
      if (typeof entry !== "string") {
        return normalizeLogEntry(entry);
      }

      return getLegacyLogEntry(entry);
    })
    .filter((entry): entry is LogEntry => entry !== null)
    .slice(0, 32);
}

export function formatLogEntry(entry: LogEntry, translations: TranslationPack): string {
  if (entry.source === "questUi") {
    return formatTemplate(
      translations.quests.ui[entry.key] ?? entry.key,
      getLocalizedParams(entry.params ?? {}, translations),
    );
  }

  if (entry.source === "questDecisionResult") {
    const optionId = String(entry.params?.optionId ?? "");
    return translations.quests.decisions[entry.key]?.results[optionId] ?? entry.key;
  }

  if (entry.source === "questSuddenResult") {
    return formatTemplate(
      translations.quests.sudden[entry.key]?.result ?? entry.key,
      getLocalizedParams(entry.params ?? {}, translations),
    );
  }

  return formatTemplate(
    translations.ui[entry.key] ?? entry.key,
    getLocalizedParams(entry.params ?? {}, translations),
  );
}

export function getLocalizedBuildingName(buildingId: BuildingId): string {
  const translations = packs[loadLocale()];

  return translations.buildings[buildingId].name;
}

function formatTemplate(template: string, params: LogParams): string {
  return Object.entries(params).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(String(value)),
    template,
  );
}

export function pushLogEntry(state: GameState, entry: LogEntry): void {
  state.log.unshift(normalizeLogEntry(entry));
  state.log = state.log.slice(0, 32);
}

function normalizeLogEntry(entry: LogEntry): LogEntry {
  return {
    source: entry.source === "questUi" ||
      entry.source === "questDecisionResult" ||
      entry.source === "questSuddenResult"
      ? entry.source
      : "ui",
    key: String(entry.key),
    params: entry.params,
  };
}

function getLegacyLogEntry(entry: string): LogEntry | null {
  const knownStaticEntries = new Map<string, LogEntry>([
    [packs.en.ui.logDayOne, { source: "ui", key: "logDayOne" }],
    [packs.cs.ui.logDayOne, { source: "ui", key: "logDayOne" }],
    [packs.en.ui.logPerimeter, { source: "ui", key: "logPerimeter" }],
    [packs.cs.ui.logPerimeter, { source: "ui", key: "logPerimeter" }],
  ]);

  return knownStaticEntries.get(entry) ?? {
    source: "ui",
    key: entry,
  };
}

function getLocalizedParams(params: LogParams, translations: TranslationPack): LogParams {
  const localizedParams: LogParams = { ...params };

  if (typeof params.buildingId === "string" && params.buildingId in translations.buildings) {
    localizedParams.building = translations.buildings[params.buildingId as BuildingId].name;
  }

  if (typeof params.modeKey === "string" && params.modeKey in translations.ui) {
    localizedParams.mode = translations.ui[params.modeKey];
  }

  if (typeof params.fromResourceId === "string" && params.fromResourceId in translations.resources) {
    localizedParams.fromResource = translations.resources[params.fromResourceId as ResourceId];
  }

  if (typeof params.toResourceId === "string" && params.toResourceId in translations.resources) {
    localizedParams.toResource = translations.resources[params.toResourceId as ResourceId];
  }

  if (typeof params.resourceId === "string" && params.resourceId in translations.resources) {
    localizedParams.resource = translations.resources[params.resourceId as ResourceId];
  }

  if (
    typeof params.questId === "string" &&
    params.questId in translations.quests.objectives
  ) {
    localizedParams.quest =
      translations.quests.objectives[params.questId as ObjectiveQuestId].title;
  }

  return localizedParams;
}
