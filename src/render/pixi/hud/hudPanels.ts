import { Container, Graphics, Rectangle, type TextStyleFontWeight } from "pixi.js";
import { objectiveQuestById } from "../../../data/quests";
import type {
  GameState,
  ResourceBag,
} from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getActiveObjectiveQuests, getObjectiveQuestProgress } from "../../../systems/quests";
import { HUD_LEFT_PANEL_WIDTH, HUD_SIDE_PANEL_MARGIN, HUD_TOP_STRIP_HEIGHT } from "../core/constants";
import { formatScoutingRemaining } from "../helpers/formatters";
import type {
  Bounds,
  DrawIconFn,
  DrawPanelFn,
  DrawTextFn,
  FormattedLogEntry,
  PixiActionDetail,
} from "../core/types";

type HudPanelsHost = {
  hudLayer: Container;
  getLogScrollY: () => number;
  setLogScrollY: (value: number) => void;
  setLogScrollMax: (value: number) => void;
  setLogScrollArea: (value: Bounds | null) => void;
  drawIcon: DrawIconFn;
  drawText: DrawTextFn;
  drawPanel: DrawPanelFn;
  registerHudInteractionArea: (x: number, y: number, width: number, height: number, padding?: number) => void;
  createIconButton: (
    parent: Container,
    iconId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    detail: PixiActionDetail,
    tooltip?: string,
    active?: boolean,
  ) => Container;
  createHudButton: (
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    detail: PixiActionDetail,
    disabled?: boolean,
    tooltip?: string,
  ) => Container;
  createCircularActionButton: (
    parent: Container,
    iconId: string,
    x: number,
    y: number,
    radius: number,
    detail: PixiActionDetail,
    tooltip: string,
    active?: boolean,
  ) => Container;
  getFormattedLogEntries: (state: GameState, translations: TranslationPack | undefined) => FormattedLogEntry[];
  wrapLogText: (text: string, fontWeight: TextStyleFontWeight, maxWidth: number) => string[];
  drawRewardLine: (
    parent: Container,
    bag: ResourceBag,
    translations: TranslationPack,
    x: number,
    y: number,
  ) => number;
};

export function drawHudPanels(
  host: HudPanelsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  width: number,
  height: number,
  topPanelsY: number,
): void {
  const conquestPanelHeight = drawActiveConquests(host, state, translations, topPanelsY);
  drawQuestPanel(host, state, translations, topPanelsY + conquestPanelHeight + 10);
  drawEventLog(host, state, translations, height);
  drawActionPanel(host, state, translations, width, height);
  drawToolbar(host, state, translations, width, height);
}

function drawActiveConquests(
  host: HudPanelsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  y: number,
): number {
  const panelWidth = HUD_LEFT_PANEL_WIDTH;
  const layer = new Container();
  layer.x = HUD_SIDE_PANEL_MARGIN;
  layer.y = y;
  host.hudLayer.addChild(layer);

  const activeAssaults = state.resourceSites
    .filter((site) => site.assault)
    .slice(0, 4);
  const panelHeight = activeAssaults.length > 0 ? 52 + activeAssaults.length * 24 : 82;

  host.drawIcon(layer, "scout", 18, 22, 15);
  host.drawText(layer, translations?.ui.activeConquests ?? "Active conquests", 34, 14, {
    fill: 0xf3edda,
    fontSize: 12,
    fontWeight: "800",
  });
  host.drawText(layer, `${activeAssaults.length}`, panelWidth - 28, 14, {
    fill: 0xf1df9a,
    fontSize: 13,
    fontWeight: "900",
  }).anchor.set(1, 0);

  if (activeAssaults.length === 0) {
    host.drawText(layer, translations?.ui.noActiveConquests ?? "No active conquest teams.", 14, 48, {
      fill: 0xaeb4b8,
      fontSize: 11,
      fontWeight: "800",
    });
    host.registerHudInteractionArea(layer.x, layer.y, panelWidth, panelHeight, 6);
    return panelHeight;
  }

  activeAssaults.forEach((site, index) => {
    const remaining = formatScoutingRemaining(site.assault?.remainingSeconds ?? 0);
    const rowY = 44 + index * 24;
    host.drawIcon(layer, "people", 18, rowY + 10, 13);
    host.drawText(layer, `${translations?.resources[site.resourceId] ?? site.resourceId}: ${site.assault?.troops ?? 0}`, 34, rowY + 2, {
      fill: 0xf5efdf,
      fontSize: 11,
      fontWeight: "900",
    });
    const timer = host.drawText(layer, `${translations?.ui.returnsIn ?? "returns in"} ${remaining}`, panelWidth - 14, rowY + 2, {
      fill: 0xd8c890,
      fontSize: 11,
      fontWeight: "800",
    });
    timer.anchor.set(1, 0);
  });

  host.registerHudInteractionArea(layer.x, layer.y, panelWidth, panelHeight, 6);
  return panelHeight;
}

function drawQuestPanel(
  host: HudPanelsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  y: number,
): void {
  if (!translations) {
    return;
  }

  const panelWidth = HUD_LEFT_PANEL_WIDTH;
  const activeObjectives = getActiveObjectiveQuests(state).slice(0, 3);
  const rowHeight = 70;
  const panelHeight = activeObjectives.length > 0
    ? 48 + activeObjectives.length * rowHeight
    : 82;
  const layer = new Container();
  layer.x = HUD_SIDE_PANEL_MARGIN;
  layer.y = y;
  host.hudLayer.addChild(layer);

  host.drawIcon(layer, "build", 18, 22, 15);
  host.drawText(layer, translations.quests.ui.activeObjectives, 34, 14, {
    fill: 0xf3edda,
    fontSize: 12,
    fontWeight: "800",
  });
  host.drawText(layer, `${activeObjectives.length}`, panelWidth - 28, 14, {
    fill: 0xf1df9a,
    fontSize: 13,
    fontWeight: "900",
  }).anchor.set(1, 0);

  if (activeObjectives.length === 0) {
    host.drawText(layer, translations.quests.ui.objectivesEmpty, 14, 48, {
      fill: 0xaeb4b8,
      fontSize: 11,
      fontWeight: "800",
    });
    host.registerHudInteractionArea(layer.x, layer.y, panelWidth, panelHeight, 6);
    return;
  }

  activeObjectives.forEach((quest, index) => {
    const definition = objectiveQuestById[quest.definitionId];
    const copy = translations.quests.objectives[quest.definitionId];
    const progress = getObjectiveQuestProgress(state, definition);
    const rowY = 42 + index * rowHeight;
    host.drawText(layer, copy?.title ?? quest.definitionId, 14, rowY, {
      fill: 0xf5efdf,
      fontSize: 12,
      fontWeight: "900",
    });
    const progressLabel = host.drawText(layer, `${progress.current}/${progress.required}`, panelWidth - 14, rowY, {
      fill: 0xf1df9a,
      fontSize: 12,
      fontWeight: "900",
    });
    progressLabel.anchor.set(1, 0);
    host.drawText(layer, copy?.description ?? "", 14, rowY + 18, {
      fill: 0xaeb4b8,
      fontSize: 10,
      fontWeight: "700",
      wordWrap: true,
      wordWrapWidth: panelWidth - 42,
    });
    host.drawRewardLine(layer, definition.reward, translations, 14, rowY + 48);
  });

  host.registerHudInteractionArea(layer.x, layer.y, panelWidth, panelHeight, 6);
}

export function drawHudLeftArea(
  host: HudPanelsHost,
  height: number,
): void {
  const areaHeight = Math.max(0, height - HUD_TOP_STRIP_HEIGHT);

  if (areaHeight <= 0) {
    return;
  }

  const area = new Graphics();
  area
    .rect(0, HUD_TOP_STRIP_HEIGHT, HUD_LEFT_PANEL_WIDTH, areaHeight)
    .fill({ color: 0x151812, alpha: 1 });
  host.hudLayer.addChild(area);
}

function drawEventLog(
  host: HudPanelsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  height: number,
): void {
  const layer = new Container();
  layer.x = HUD_SIDE_PANEL_MARGIN;
  layer.y = Math.max(258, height - 374);
  host.hudLayer.addChild(layer);

  const width = HUD_LEFT_PANEL_WIDTH;
  const panelHeight = Math.max(168, Math.min(326, height - layer.y - 48));
  const viewportY = 42;
  const viewportHeight = panelHeight - 54;
  host.drawIcon(layer, "clock", 18, 22, 14);
  host.drawText(layer, translations?.ui.log ?? "Log", 34, 14, {
    fill: 0xf5efdf,
    fontSize: 12,
    fontWeight: "800",
  });

  const entries = host.getFormattedLogEntries(state, translations);
  const textWrapWidth = width - 58;

  if (entries.length === 0) {
    host.drawText(layer, "-", 14, viewportY, {
      fill: 0xaeb4b8,
      fontSize: 11,
      fontWeight: "700",
    });
    host.registerHudInteractionArea(layer.x, layer.y, width, panelHeight, 6);
    return;
  }

  const lineHeight = 15;
  let rowCursorY = 0;
  const rows = entries.map((entry, index) => {
    const lines = host.wrapLogText(entry.text, index === 0 ? "800" : "700", textWrapWidth);
    const rowHeight = Math.max(38, lines.length * lineHeight + 8);
    const row = { entry, index, y: rowCursorY, height: rowHeight, lines };
    rowCursorY += rowHeight;
    return row;
  });

  const contentHeight = rowCursorY;
  const scrollMax = Math.max(0, contentHeight - viewportHeight);
  host.setLogScrollMax(scrollMax);
  const nextScrollY = Math.max(0, Math.min(host.getLogScrollY(), scrollMax));
  host.setLogScrollY(nextScrollY);
  host.setLogScrollArea({
    x: layer.x + 10,
    y: layer.y + viewportY - 4,
    width: width - 20,
    height: viewportHeight + 8,
  });

  const logContent = new Container();
  logContent.y = viewportY - nextScrollY;
  layer.addChild(logContent);

  const logMask = new Graphics();
  logMask.eventMode = "none";
  logMask.rect(10, viewportY, width - 30, viewportHeight)
    .fill({ color: 0xffffff, alpha: 1 });
  layer.addChild(logMask);
  logContent.mask = logMask;

  rows.forEach((row) => {
    const rowY = row.y;
    const visibleY = rowY - nextScrollY;

    if (visibleY < -row.height || visibleY > viewportHeight) {
      return;
    }

    host.drawIcon(logContent, row.entry.iconId, 20, rowY + 9, 14);
    row.lines.forEach((line, lineIndex) => {
      host.drawText(logContent, line, 30, rowY + lineIndex * lineHeight, {
        fill: row.entry.fill,
        fontSize: 11,
        fontWeight: row.index === 0 ? "800" : "700",
      });
    });
  });

  if (scrollMax > 0) {
    const trackHeight = viewportHeight;
    const thumbHeight = Math.max(28, trackHeight * viewportHeight / contentHeight);
    const thumbY = viewportY + (trackHeight - thumbHeight) * (nextScrollY / scrollMax);
    const track = new Graphics();
    track.rect(width - 18, viewportY, 5, trackHeight)
      .fill({ color: 0x0b0d0a, alpha: 0.72 });
    track.rect(width - 18, thumbY, 5, thumbHeight)
      .fill({ color: 0xe0c46f, alpha: 0.6 });
    layer.addChild(track);
  }

  host.registerHudInteractionArea(layer.x, layer.y, width, panelHeight, 6);
}

function drawToolbar(
  host: HudPanelsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  width: number,
  height: number,
): void {
  const group = new Container();
  group.x = width - 244;
  group.y = height - 72;
  host.hudLayer.addChild(group);
  host.drawPanel(group, 0, 0, 216, 48);

  host.createIconButton(group, state.paused ? "play" : "pause", 8, 8, 40, 32, { action: "pause" }, state.paused ? translations?.ui.resume : translations?.ui.pause);
  host.createHudButton(group, translations?.ui.speedNormal ?? "1x", 56, 8, 44, 32, { speed: 1 }, state.speed === 1);
  host.createHudButton(group, translations?.ui.speedFast ?? "24x", 108, 8, 52, 32, { speed: 24 }, state.speed === 24);
  host.createIconButton(group, "home", 168, 8, 40, 32, { action: "home" }, translations?.ui.home);
  host.registerHudInteractionArea(group.x, group.y, 216, 48, 6);
}

function drawActionPanel(
  host: HudPanelsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  width: number,
  height: number,
): void {
  const panelWidth = 158;
  const panelHeight = 82;
  const group = new Container();
  group.x = (width - panelWidth) / 2;
  group.y = height - 116;
  host.hudLayer.addChild(group);

  host.drawPanel(group, 0, 0, panelWidth, panelHeight);

  const continuousShifts = state.workMode === "continuous";
  const currentMode = continuousShifts
    ? translations?.ui.continuousShifts ?? "24h shifts"
    : translations?.ui.dayShift ?? "Day shift";
  const nextMode = continuousShifts
    ? translations?.ui.dayShift ?? "Day shift"
    : translations?.ui.continuousShifts ?? "24h shifts";
  const detail = continuousShifts
    ? translations?.ui.continuousShiftsMorale ?? "Night work lowers morale."
    : translations?.ui.dayShiftActive ?? "Production active.";
  const tooltip = `${translations?.ui.workSchedule ?? "Schedule"}: ${currentMode}\n${detail}\n${nextMode}`;

  host.createCircularActionButton(
    group,
    "continuous-shifts",
    panelWidth / 2 - 36,
    40,
    27,
    { action: "set-continuous-shifts", continuousShifts: !continuousShifts } satisfies PixiActionDetail,
    tooltip,
    continuousShifts,
  );

  const archiveTooltip = `${translations?.ui.decisionArchive ?? "Decision archive"}\n${translations?.ui.decisionArchiveTooltip ?? "Review past decisions and leadership profile."}`;
  host.createCircularActionButton(
    group,
    "archive",
    panelWidth / 2 + 36,
    40,
    27,
    { action: "open-decision-archive" } satisfies PixiActionDetail,
    archiveTooltip,
    false,
  );
  host.registerHudInteractionArea(group.x, group.y, panelWidth, panelHeight, 6);
}
