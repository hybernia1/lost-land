import { Container, Graphics, Rectangle, type TextStyleFontWeight } from "pixi.js";
import { objectiveQuestById } from "../../../data/quests";
import type {
  GameState,
  ResourceBag,
} from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { canClaimObjectiveReward, getActiveObjectiveQuests, getObjectiveQuestProgress } from "../../../systems/quests";
import {
  HUD_CHROME_ALPHA,
  HUD_LEFT_PANEL_WIDTH,
  HUD_SIDE_PANEL_CONTENT_WIDTH,
  HUD_SIDE_PANEL_MARGIN,
  HUD_TOP_STRIP_HEIGHT,
  UI_CONTROL_RADIUS,
  uiTextSize,
  uiTheme,
} from "../core/constants";
import { formatScoutingRemaining } from "../helpers/formatters";
import { drawBluePanelBackground } from "../ui/panelBackground";
import type {
  Bounds,
  DrawIconFn,
  DrawPanelFn,
  DrawTextFn,
  FormattedLogEntry,
  HudSidebarTab,
  PixiActionDetail,
  TabItem,
  TabOptions,
} from "../core/types";

type HudPanelsHost = {
  hudLayer: Container;
  requestRender: () => void;
  getLogScrollY: () => number;
  setLogScrollY: (value: number) => void;
  setLogScrollMax: (value: number) => void;
  setLogScrollArea: (value: Bounds | null) => void;
  getActiveSidebarTab: () => HudSidebarTab;
  setActiveSidebarTab: (value: HudSidebarTab) => void;
  drawIcon: DrawIconFn;
  drawText: DrawTextFn;
  drawPanel: DrawPanelFn;
  drawTabs: <T extends string>(parent: Container, tabs: Array<TabItem<T>>, options: TabOptions<T>) => void;
  bindAction: (target: Container, detail: PixiActionDetail) => void;
  bindTooltip: (target: Container, text: string) => void;
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
    disabled?: boolean,
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
    disabled?: boolean,
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
  drawSidebarTabsPanel(host, state, translations, topPanelsY);
  drawEventLog(host, state, translations, height);
  drawActionPanel(host, state, translations, width, height);
  drawToolbar(host, state, translations, width, height);
}
function drawSidebarTabsPanel(
  host: HudPanelsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  y: number,
): void {
  const panelWidth = HUD_SIDE_PANEL_CONTENT_WIDTH;
  const panelHeight = 170;
  const layer = new Container();
  layer.x = HUD_SIDE_PANEL_MARGIN;
  layer.y = y;
  host.hudLayer.addChild(layer);

  const activeAssaults = state.resourceSites
    .filter((site) => site.assault)
    .slice(0, 4);
  const activeObjectives = getActiveObjectiveQuests(state).slice(0, 3);
  const activeTab = host.getActiveSidebarTab();
  const tabs: Array<TabItem<HudSidebarTab>> = [
    {
      id: "tasks",
      label: `${translations?.ui.sidebarTasksTab ?? "Tasks"} ${activeObjectives.length}`,
    },
    {
      id: "expeditions",
      label: `${translations?.ui.sidebarExpeditionsTab ?? "Expeditions"} ${activeAssaults.length}`,
    },
  ];

  host.drawTabs(layer, tabs, {
    activeId: activeTab,
    x: 0,
    y: 8,
    height: 32,
    gap: 6,
    minWidth: 132,
    maxTabWidth: 156,
    maxWidth: panelWidth,
    onSelect: (tab) => {
      host.setActiveSidebarTab(tab);
      host.requestRender();
    },
  });

  if (activeTab === "tasks") {
    drawQuestPanelContent(host, state, translations, layer, activeObjectives);
  } else {
    drawActiveConquestsContent(host, translations, layer, activeAssaults);
  }

  host.registerHudInteractionArea(layer.x, layer.y, panelWidth, panelHeight, 6);
}
function drawActiveConquestsContent(
  host: HudPanelsHost,
  translations: TranslationPack | undefined,
  layer: Container,
  activeAssaults: GameState["resourceSites"],
): void {
  const panelWidth = HUD_SIDE_PANEL_CONTENT_WIDTH;
  const contentY = 54;

  if (activeAssaults.length === 0) {
    host.drawIcon(layer, "expedition", 8, contentY + 8, 15);
    host.drawText(layer, translations?.ui.noActiveConquests ?? "No active conquest teams.", 28, contentY, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.caption,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: panelWidth - 42,
    });
    return;
  }

  activeAssaults.forEach((site, index) => {
    const remaining = formatScoutingRemaining(site.assault?.remainingSeconds ?? 0);
    const rowY = contentY + index * 24;
    host.drawIcon(layer, "expedition", 8, rowY + 10, 13);
    host.drawText(layer, `${translations?.resources[site.resourceId] ?? site.resourceId}: ${site.assault?.troops ?? 0}`, 24, rowY + 2, {
      fill: uiTheme.text,
      fontSize: uiTextSize.caption,
      fontWeight: "900",
    });
    const timer = host.drawText(layer, `${translations?.ui.returnsIn ?? "returns in"} ${remaining}`, panelWidth, rowY + 2, {
      fill: uiTheme.accentStrong,
      fontSize: uiTextSize.caption,
      fontWeight: "800",
    });
    timer.anchor.set(1, 0);
  });
}

function drawQuestPanelContent(
  host: HudPanelsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  layer: Container,
  activeObjectives: ReturnType<typeof getActiveObjectiveQuests>,
): void {
  if (!translations) {
    return;
  }

  const panelWidth = HUD_SIDE_PANEL_CONTENT_WIDTH;
  const rowHeight = 34;
  const contentY = 54;

  if (activeObjectives.length === 0) {
    host.drawIcon(layer, "build", 8, contentY + 8, 15);
    host.drawText(layer, translations.quests.ui.objectivesEmpty, 28, contentY, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.caption,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: panelWidth - 42,
    });
    return;
  }

  activeObjectives.forEach((quest, index) => {
    const definition = objectiveQuestById[quest.definitionId];
    const copy = translations.quests.objectives[quest.definitionId];
    const progress = getObjectiveQuestProgress(state, definition);
    const isCompletedPendingClaim = quest.completedAt !== null && quest.rewardClaimedAt === null;
    const canClaimReward = isCompletedPendingClaim && canClaimObjectiveReward(state, quest.definitionId);
    const rowY = contentY + index * rowHeight;
    const row = new Graphics();
    row.roundRect(0, rowY - 3, panelWidth, rowHeight - 4, UI_CONTROL_RADIUS)
      .fill({ color: isCompletedPendingClaim ? uiTheme.rewardSurface : uiTheme.surface, alpha: isCompletedPendingClaim ? 0.58 : 0.34 })
      .stroke({ color: uiTheme.border, alpha: 0.42, width: 1 });
    layer.addChild(row);
    host.bindAction(row, {
      action: "open-objective-quest",
      objectiveQuestId: quest.definitionId,
    } satisfies PixiActionDetail);

    host.drawText(layer, copy?.title ?? quest.definitionId, 8, rowY + 5, {
      fill: uiTheme.text,
      fontSize: uiTextSize.small,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: isCompletedPendingClaim ? panelWidth - 60 : panelWidth - 110,
    });
    if (isCompletedPendingClaim) {
      const claimIcon = host.drawIcon(layer, "done", panelWidth - 18, rowY + 11, 15);
      claimIcon.hitArea = new Rectangle(-8, -8, 30, 30);
      claimIcon.alpha = canClaimReward ? 1 : 0.48;
      host.bindTooltip(
        claimIcon,
        canClaimReward
          ? (translations.ui.questRewardClaim ?? "Claim reward")
          : (translations.ui.questRewardClaimBlocked ?? "No free capacity for reward resources."),
      );
      if (canClaimReward) {
        host.bindAction(claimIcon, {
          action: "claim-objective-reward",
          objectiveQuestId: quest.definitionId,
        });
      }
      return;
    }

    const progressLabel = host.drawText(layer, `${progress.current}/${progress.required}`, panelWidth - 8, rowY + 5, {
      fill: uiTheme.accentStrong,
      fontSize: uiTextSize.small,
      fontWeight: "900",
    });
    progressLabel.anchor.set(1, 0);
  });
}

export function drawHudLeftArea(
  host: HudPanelsHost,
  height: number,
): void {
  const areaHeight = Math.max(0, height - HUD_TOP_STRIP_HEIGHT);

  if (areaHeight <= 0) {
    return;
  }

  drawBluePanelBackground(host.hudLayer, 0, HUD_TOP_STRIP_HEIGHT, HUD_LEFT_PANEL_WIDTH, areaHeight, HUD_CHROME_ALPHA);
  const area = new Graphics();
  area
    .rect(0, HUD_TOP_STRIP_HEIGHT, HUD_LEFT_PANEL_WIDTH, areaHeight)
    .fill({ color: uiTheme.hudChrome, alpha: 0.12 });
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
  layer.y = Math.max(242, height - 390);
  host.hudLayer.addChild(layer);

  const width = HUD_SIDE_PANEL_CONTENT_WIDTH;
  const panelHeight = Math.max(168, Math.min(326, height - layer.y - 48));
  const viewportY = 42;
  const viewportHeight = panelHeight - 54;
  host.drawIcon(layer, "clock", 8, 22, 14);
  host.drawText(layer, translations?.ui.log ?? "Log", 24, 14, {
    fill: uiTheme.text,
    fontSize: uiTextSize.small,
    fontWeight: "800",
  });

  const entries = host.getFormattedLogEntries(state, translations);
  const textWrapWidth = width - 48;

  if (entries.length === 0) {
    host.drawText(layer, "-", 0, viewportY, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.caption,
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
    x: layer.x,
    y: layer.y + viewportY - 4,
    width,
    height: viewportHeight + 8,
  });

  const logContent = new Container();
  logContent.y = viewportY - nextScrollY;
  layer.addChild(logContent);

  const logMask = new Graphics();
  logMask.eventMode = "none";
  logMask.rect(0, viewportY, width - 20, viewportHeight)
    .fill({ color: 0xffffff, alpha: 1 });
  layer.addChild(logMask);
  logContent.mask = logMask;

  rows.forEach((row) => {
    const rowY = row.y;
    const visibleY = rowY - nextScrollY;

    if (visibleY < -row.height || visibleY > viewportHeight) {
      return;
    }

    host.drawIcon(logContent, row.entry.iconId, 8, rowY + 9, 14);
    row.lines.forEach((line, lineIndex) => {
      host.drawText(logContent, line, 22, rowY + lineIndex * lineHeight, {
        fill: row.entry.fill,
        fontSize: uiTextSize.caption,
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
      .fill({ color: uiTheme.surfaceSunken, alpha: 0.38 });
    track.rect(width - 18, thumbY, 5, thumbHeight)
      .fill({ color: uiTheme.accentStrong, alpha: 0.5 });
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
  group.x = width - 214;
  group.y = height - 40;
  host.hudLayer.addChild(group);

  host.createIconButton(
    group,
    state.paused ? "play" : "pause",
    0,
    0,
    40,
    32,
    { action: "pause" },
    state.paused ? translations?.ui.resume : translations?.ui.pause,
  );
  host.createHudButton(
    group,
    translations?.ui.speedNormal ?? "1x",
    48,
    0,
    44,
    32,
    { speed: 1 },
    state.speed === 1,
  );
  host.createHudButton(
    group,
    translations?.ui.speedFast ?? "24x",
    98,
    0,
    52,
    32,
    { speed: 24 },
    state.speed === 24,
  );
  host.createIconButton(group, "home", 158, 0, 40, 32, { action: "home" }, translations?.ui.home);
  host.registerHudInteractionArea(group.x, group.y, 200, 32, 6);
}

function drawActionPanel(
  host: HudPanelsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  _width: number,
  height: number,
): void {
  const group = new Container();
  group.x = HUD_SIDE_PANEL_MARGIN + HUD_SIDE_PANEL_CONTENT_WIDTH / 2;
  group.y = height - 40;
  host.hudLayer.addChild(group);

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
  const marketBuilt = state.buildings.market.level > 0;
  const marketTooltip = marketBuilt
    ? `${translations?.buildings.market.name ?? "Market"}\n${translations?.ui.quickOpenMarket ?? "Open market exchange."}`
    : `${translations?.buildings.market.name ?? "Market"}\n${translations?.ui.quickMarketUnavailable ?? "Build the market first."}`;
  const capturedOases = state.resourceSites.filter((site) => site.captured).length;
  const oasisTooltip = capturedOases > 0
    ? `${translations?.ui.oasisOverview ?? "Captured oases"}\n${translations?.ui.quickOpenOasisOverview ?? "Open captured oasis overview."}`
    : `${translations?.ui.oasisOverview ?? "Captured oases"}\n${translations?.ui.quickNoCapturedOases ?? "No captured oasis yet."}`;
  const questLogTooltip = `${translations?.ui.questLog ?? "Quest log"}\n${translations?.ui.questLogTooltip ?? "Review active and completed tasks."}`;
  const radius = 20;
  const spacing = 52;
  const startX = -(spacing * 2);

  host.createCircularActionButton(
    group,
    "fist",
    startX,
    0,
    radius,
    { action: "set-continuous-shifts", continuousShifts: !continuousShifts } satisfies PixiActionDetail,
    tooltip,
    continuousShifts,
  );

  const archiveTooltip = `${translations?.ui.decisionArchive ?? "Decision archive"}\n${translations?.ui.decisionArchiveTooltip ?? "Review past decisions and leadership profile."}`;
  host.createCircularActionButton(
    group,
    "archive",
    startX + spacing,
    0,
    radius,
    { action: "open-decision-archive" } satisfies PixiActionDetail,
    archiveTooltip,
    false,
  );

  host.createCircularActionButton(
    group,
    "market",
    startX + spacing * 2,
    0,
    radius,
    { action: "open-market" } satisfies PixiActionDetail,
    marketTooltip,
    false,
    !marketBuilt,
  );

  host.createCircularActionButton(
    group,
    "oasis",
    startX + spacing * 4,
    0,
    radius,
    { action: "open-oasis-overview" } satisfies PixiActionDetail,
    oasisTooltip,
    false,
    capturedOases <= 0,
  );

  host.createCircularActionButton(
    group,
    "quest-log",
    startX + spacing * 3,
    0,
    radius,
    { action: "open-quest-log" } satisfies PixiActionDetail,
    questLogTooltip,
    false,
  );
  host.registerHudInteractionArea(group.x - 134, group.y - 26, 268, 52, 6);
}
