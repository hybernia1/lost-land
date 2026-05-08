import type { BuildingId, GameState } from "../game/types";
import { loadLocale, packs } from "../i18n";

type LogParams = Record<string, string | number>;

export function pushLocalizedLog(
  state: GameState,
  key: string,
  params: LogParams = {},
): void {
  pushLog(state, getLocalizedUiText(key, params));
}

export function getLocalizedUiText(
  key: string,
  params: LogParams = {},
): string {
  const translations = packs[loadLocale()];
  const template = translations.ui[key] ?? key;

  return formatTemplate(template, params);
}

export function getLocalizedInitialLogEntries(): string[] {
  return [
    getLocalizedUiText("logDayOne"),
    getLocalizedUiText("logPerimeter"),
  ];
}

export function localizeStaticLogEntries(log: string[]): string[] {
  const current = packs[loadLocale()].ui;
  const knownStaticEntries = new Map([
    [packs.en.ui.logDayOne, current.logDayOne],
    [packs.cs.ui.logDayOne, current.logDayOne],
    [packs.en.ui.logPerimeter, current.logPerimeter],
    [packs.cs.ui.logPerimeter, current.logPerimeter],
  ]);

  return log.map((entry) => knownStaticEntries.get(entry) ?? entry);
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

function pushLog(state: GameState, message: string): void {
  state.log.unshift(message);
  state.log = state.log.slice(0, 16);
}
