import { Container, Graphics, Rectangle } from "pixi.js";
import { objectiveQuestById } from "../../../data/quests";
import {
  ENVIRONMENT_MAX_INTENSITY,
  getEnvironmentDefinition,
  getEnvironmentIntensityIndex,
} from "../../../data/environment";
import { formatGameClock, GAME_HOUR_REAL_SECONDS, getGameDay } from "../../../game/time";
import type {
  EnvironmentConditionId,
  GameState,
  ObjectiveQuestId,
  ResourceBag,
  ResourceId,
} from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import {
  getGlobalProductionMultiplier,
  getHousingStatus,
  getResourceBreakdown,
  type ResourceBreakdownLine,
} from "../../../systems/buildings";
import {
  getAssignedBuildingWorkerCount,
  getConstructionWorkerCount,
  getPopulation,
} from "../../../systems/population";
import {
  getAssignedResourceSiteWorkerCount,
  getResourceSiteAssaultTroopCount,
  getTravelTilesToSite,
} from "../../../systems/resourceSites";
import {
  canClaimObjectiveReward,
  decisionProfileAxes,
  getActiveObjectiveQuests,
  getObjectiveQuestProgress,
  getDecisionProfileAxisValue,
  getDecisionProfileKind,
} from "../../../systems/quests";
import { decisionProfileIconByKind } from "../core/constants";
import type {
  Bounds,
  DecisionHistoryRow,
  DrawIconFn,
  DrawOverlayHeaderFn,
  DrawPanelFn,
  DrawTextFn,
  EffectLine,
  MeasureWrappedTextHeightFn,
  PixiActionDetail,
  TabItem,
  TabOptions,
  ResourceBreakdownTab,
  VillageInfoPanel,
} from "../core/types";
import {
  getDecisionHistoryOption,
  getDecisionImpactLines,
  getDecisionProfileOverallLabel,
} from "../helpers/decisionHelpers";
import {
  formatRate,
  formatScoutingRemaining,
  getHourlyRateLabel,
  getRateColor,
} from "../helpers/formatters";

type InfoPanelsHost = {
  hudLayer: Container;
  requestRender: () => void;
  drawModalBackdrop: (
    overlay: Container,
    width: number,
    height: number,
    closeAction?: PixiActionDetail,
    blockClose?: boolean,
  ) => void;
  drawPanel: DrawPanelFn;
  drawOverlayHeader: DrawOverlayHeaderFn;
  drawText: DrawTextFn;
  drawIcon: DrawIconFn;
  drawTabs: <T extends string>(parent: Container, tabs: Array<TabItem<T>>, options: TabOptions<T>) => void;
  createModalButton: (
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
  bindLocalAction: (target: Container, onTap: () => void) => void;
  bindAction: (target: Container, detail: PixiActionDetail) => void;
  bindTooltip: (target: Container, text: string) => void;
  measureWrappedTextHeight: MeasureWrappedTextHeightFn;
  drawDecisionImpactChips: (parent: Container, impacts: EffectLine[], rightX: number, y: number) => void;
  drawRewardLine: (
    parent: Container,
    bag: ResourceBag,
    translations: TranslationPack,
    x: number,
    y: number,
  ) => number;
  getTroopHousingCapacity: (state: GameState) => number;
  getDecisionHistoryScrollY: () => number;
  setDecisionHistoryScrollY: (value: number) => void;
  setDecisionHistoryScrollMax: (value: number) => void;
  setDecisionHistoryScrollArea: (value: Bounds | null) => void;
  getSelectedDecisionHistoryIndex: () => number | null;
  setSelectedDecisionHistoryIndex: (value: number | null) => void;
  getActiveResourceBreakdownTab: () => ResourceBreakdownTab;
  setActiveResourceBreakdownTab: (value: ResourceBreakdownTab) => void;
  getResourceBreakdownScrollY: () => number;
  setResourceBreakdownScrollY: (value: number) => void;
  setResourceBreakdownScrollMax: (value: number) => void;
  setResourceBreakdownScrollArea: (value: Bounds | null) => void;
  getResourceBreakdownScrollResourceId: () => ResourceId | null;
  setResourceBreakdownScrollResourceId: (value: ResourceId | null) => void;
  getResourceBreakdownScrollTab: () => ResourceBreakdownTab;
  setResourceBreakdownScrollTab: (value: ResourceBreakdownTab) => void;
};

export function drawInfoPanel(
  host: InfoPanelsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  width: number,
  height: number,
  infoPanel: VillageInfoPanel | null,
): void {
  if (!infoPanel || !translations) {
    return;
  }

  if (infoPanel === "survivors") {
    drawSurvivorOverviewPanel(host, state, translations, width, height);
    return;
  }

  if (infoPanel === "decisionArchive") {
    drawDecisionArchivePanel(host, state, translations, width, height);
    return;
  }

  if (infoPanel === "weather") {
    drawWeatherOverviewPanel(host, state, translations, width, height);
    return;
  }

  if (infoPanel === "oasisOverview") {
    drawOasisOverviewPanel(host, state, translations, width, height);
    return;
  }

  if (infoPanel === "questLog") {
    drawQuestLogPanel(host, state, translations, width, height);
    return;
  }

  if (infoPanel.startsWith("objective:")) {
    const objectiveQuestId = infoPanel.slice("objective:".length) as ObjectiveQuestId;
    drawObjectiveQuestPanel(host, state, translations, width, height, objectiveQuestId);
    return;
  }

  drawResourceBreakdownPanel(host, state, translations, width, height, infoPanel as ResourceId);
}

function drawObjectiveQuestPanel(
  host: InfoPanelsHost,
  state: GameState,
  translations: TranslationPack,
  width: number,
  height: number,
  objectiveQuestId: ObjectiveQuestId,
): void {
  const objectiveDefinition = objectiveQuestById[objectiveQuestId];
  const objectiveCopy = translations.quests.objectives[objectiveQuestId];
  if (!objectiveDefinition || !objectiveCopy) {
    return;
  }

  const overlay = new Container();
  host.hudLayer.addChild(overlay);
  host.drawModalBackdrop(overlay, width, height, { action: "close-village-modal" });

  const panelWidth = Math.min(620, width - 48);
  const panelHeight = Math.max(300, Math.min(520, height - 72));
  const panel = new Container();
  panel.x = (width - panelWidth) / 2;
  panel.y = Math.max(36, (height - panelHeight) / 2);
  panel.eventMode = "static";
  overlay.addChild(panel);
  host.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);

  const progress = getObjectiveQuestProgress(state, objectiveDefinition);
  const objectiveState = state.quests.objectives.find((quest) => quest.definitionId === objectiveQuestId) ?? null;
  const completedAt = objectiveState?.completedAt ?? null;
  const rewardClaimedAt = objectiveState?.rewardClaimedAt ?? null;
  const canClaimReward = canClaimObjectiveReward(state, objectiveQuestId);
  const progressLabel = `${progress.current}/${progress.required}`;

  const headerBottom = host.drawOverlayHeader(panel, panelWidth, translations, {
    iconId: "build",
    title: objectiveCopy.title,
    rightText: progressLabel,
    closeAction: { action: "close-village-modal" },
  });

  let cursorY = headerBottom + 8;
  if (completedAt !== null) {
    const completedLabel = `${translations.ui.day ?? "Day"} ${getGameDay(completedAt)} / ${formatGameClock(completedAt)}`;
    host.drawText(panel, completedLabel, 24, cursorY, {
      fill: 0x9ed99b,
      fontSize: 12,
      fontWeight: "900",
    });
    cursorY += 22;
  }

  host.drawText(panel, objectiveCopy.description, 24, cursorY, {
    fill: 0xd7ddd8,
    fontSize: 13,
    fontWeight: "700",
    wordWrap: true,
    wordWrapWidth: panelWidth - 48,
  });

  const descriptionHeight = host.measureWrappedTextHeight(
    objectiveCopy.description,
    13,
    "700",
    panelWidth - 48,
  );
  cursorY += descriptionHeight + 18;

  const progressToken = new Container();
  progressToken.x = 24;
  progressToken.y = cursorY + 2;
  panel.addChild(progressToken);
  host.drawIcon(progressToken, "build", 8, 8, 14);
  const progressText = host.drawText(progressToken, `${progress.current}/${progress.required}`, 20, 0, {
    fill: 0xf1df9a,
    fontSize: 12,
    fontWeight: "900",
  });
  progressToken.hitArea = new Rectangle(0, -2, progressText.width + 26, 20);
  host.bindTooltip(progressToken, `${translations.quests.ui.activeObjectives}: ${progress.current}/${progress.required}`);

  host.drawRewardLine(panel, objectiveDefinition.reward, translations, 24, cursorY + 28);

  if (completedAt === null) {
    return;
  }

  const actionY = cursorY + 58;
  if (rewardClaimedAt !== null) {
    const claimedAtLabel = `${translations.ui.day ?? "Day"} ${getGameDay(rewardClaimedAt)} / ${formatGameClock(rewardClaimedAt)}`;
    host.drawIcon(panel, "archive", 32, actionY + 9, 14);
    host.drawText(panel, translations.ui.questRewardClaimed ?? "Reward claimed", 46, actionY + 2, {
      fill: 0x9ed99b,
      fontSize: 12,
      fontWeight: "900",
    });
    const right = host.drawText(panel, claimedAtLabel, panelWidth - 28, actionY + 2, {
      fill: 0xaeb4b8,
      fontSize: 11,
      fontWeight: "800",
    });
    right.anchor.set(1, 0);
    return;
  }

  host.createModalButton(
    panel,
    translations.ui.questRewardClaim ?? "Claim reward",
    24,
    actionY,
    220,
    34,
    {
      action: "claim-objective-reward",
      objectiveQuestId,
    },
    !canClaimReward,
    canClaimReward ? undefined : (translations.ui.questRewardClaimBlocked ?? "No free capacity for reward resources."),
  );
}

function drawQuestLogPanel(
  host: InfoPanelsHost,
  state: GameState,
  translations: TranslationPack,
  width: number,
  height: number,
): void {
  const overlay = new Container();
  host.hudLayer.addChild(overlay);
  host.drawModalBackdrop(overlay, width, height, { action: "close-village-modal" });

  const panelWidth = Math.min(720, width - 48);
  const panelHeight = Math.max(360, Math.min(620, height - 72));
  const panel = new Container();
  panel.x = (width - panelWidth) / 2;
  panel.y = Math.max(36, (height - panelHeight) / 2);
  panel.eventMode = "static";
  overlay.addChild(panel);
  host.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);

  const activeObjectives = getActiveObjectiveQuests(state);
  const completedObjectives = state.quests.objectives
    .filter((quest) => quest.completedAt !== null)
    .sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0));
  const pendingRewardObjectives = completedObjectives.filter((quest) => quest.rewardClaimedAt === null);
  const claimedObjectives = completedObjectives.filter((quest) => quest.rewardClaimedAt !== null);
  const headerBottom = host.drawOverlayHeader(panel, panelWidth, translations, {
    iconId: "quest-log",
    title: translations.ui.questLog ?? "Quest log",
    rightText: `${activeObjectives.length}/${completedObjectives.length}`,
    closeAction: { action: "close-village-modal" },
  });

  let cursorY = headerBottom + 8;
  host.drawText(panel, translations.ui.questLogActive ?? translations.quests.ui.activeObjectives, 24, cursorY, {
    fill: 0xd8c890,
    fontSize: 12,
    fontWeight: "900",
  });
  cursorY += 24;

  if (activeObjectives.length === 0) {
    host.drawText(panel, translations.ui.questLogNoActive ?? translations.quests.ui.objectivesEmpty, 24, cursorY, {
      fill: 0xbfc7be,
      fontSize: 12,
      fontWeight: "800",
    });
    cursorY += 24;
  } else {
    activeObjectives.forEach((quest) => {
      const objectiveDefinition = objectiveQuestById[quest.definitionId];
      const objectiveCopy = translations.quests.objectives[quest.definitionId];
      const progress = getObjectiveQuestProgress(state, objectiveDefinition);
      const row = new Graphics();
      row.rect(18, cursorY - 4, panelWidth - 36, 28).fill({ color: 0x171b16, alpha: 0.78 });
      panel.addChild(row);
      host.drawIcon(panel, "build", 32, cursorY + 9, 14);
      host.drawText(panel, objectiveCopy?.title ?? quest.definitionId, 46, cursorY + 2, {
        fill: 0xf4eedf,
        fontSize: 12,
        fontWeight: "900",
      });
      const progressLabel = host.drawText(panel, `${progress.current}/${progress.required}`, panelWidth - 28, cursorY + 2, {
        fill: 0xf1df9a,
        fontSize: 12,
        fontWeight: "900",
      });
      progressLabel.anchor.set(1, 0);
      host.bindAction(row, {
        action: "open-objective-quest",
        objectiveQuestId: quest.definitionId,
      });
      cursorY += 34;
    });
  }

  cursorY += 8;
  host.drawText(panel, translations.ui.questLogCompleted ?? "Completed tasks", 24, cursorY, {
    fill: 0xd8c890,
    fontSize: 12,
    fontWeight: "900",
  });
  cursorY += 24;

  if (completedObjectives.length === 0) {
    host.drawText(panel, translations.ui.questLogNoCompleted ?? "No completed tasks yet.", 24, cursorY, {
      fill: 0xbfc7be,
      fontSize: 12,
      fontWeight: "800",
    });
    return;
  }

  if (pendingRewardObjectives.length > 0) {
    host.drawText(panel, translations.ui.questRewardClaim ?? "Claim reward", 24, cursorY, {
      fill: 0xf1df9a,
      fontSize: 11,
      fontWeight: "900",
    });
    cursorY += 20;
  }

  pendingRewardObjectives.forEach((quest) => {
    const objectiveCopy = translations.quests.objectives[quest.definitionId];
    const row = new Graphics();
    row.rect(18, cursorY - 4, panelWidth - 36, 28).fill({ color: 0x202316, alpha: 0.9 });
    panel.addChild(row);
    host.drawIcon(panel, "quest-log", 32, cursorY + 9, 14);
    host.drawText(panel, objectiveCopy?.title ?? quest.definitionId, 46, cursorY + 2, {
      fill: 0xf4eedf,
      fontSize: 12,
      fontWeight: "900",
    });
    const right = host.drawText(panel, translations.ui.questRewardClaim ?? "Claim reward", panelWidth - 28, cursorY + 2, {
      fill: 0xf1df9a,
      fontSize: 11,
      fontWeight: "900",
    });
    right.anchor.set(1, 0);
    host.bindAction(row, {
      action: "open-objective-quest",
      objectiveQuestId: quest.definitionId,
    });
    cursorY += 34;
  });

  const claimedRows = Math.max(0, 8 - pendingRewardObjectives.length);
  claimedObjectives.slice(0, claimedRows).forEach((quest) => {
    const objectiveCopy = translations.quests.objectives[quest.definitionId];
    const row = new Graphics();
    row.rect(18, cursorY - 4, panelWidth - 36, 28).fill({ color: 0x171b16, alpha: 0.66 });
    panel.addChild(row);
    host.drawIcon(panel, "archive", 32, cursorY + 9, 14);
    host.drawText(panel, objectiveCopy?.title ?? quest.definitionId, 46, cursorY + 2, {
      fill: 0xc8ceca,
      fontSize: 12,
      fontWeight: "800",
    });
    const completedAtLabel = quest.completedAt === null
      ? ""
      : `${translations.ui.day ?? "Day"} ${getGameDay(quest.completedAt)} / ${formatGameClock(quest.completedAt)}`;
    const right = host.drawText(panel, completedAtLabel, panelWidth - 28, cursorY + 2, {
      fill: 0x9ed99b,
      fontSize: 11,
      fontWeight: "800",
    });
    right.anchor.set(1, 0);
    host.bindAction(row, {
      action: "open-objective-quest",
      objectiveQuestId: quest.definitionId,
    });
    cursorY += 34;
  });
}

function drawSurvivorOverviewPanel(
  host: InfoPanelsHost,
  state: GameState,
  translations: TranslationPack,
  width: number,
  height: number,
): void {
  const overlay = new Container();
  host.hudLayer.addChild(overlay);
  host.drawModalBackdrop(overlay, width, height, { action: "close-village-modal" });

  const panelWidth = 308;
  const panelHeight = 302;
  const panel = new Container();
  panel.x = (width - panelWidth) / 2;
  panel.y = Math.max(36, (height - panelHeight) / 2);
  panel.eventMode = "static";
  overlay.addChild(panel);

  const housing = getHousingStatus(state);
  const buildingWorkers = getAssignedBuildingWorkerCount(state);
  const constructionWorkers = getConstructionWorkerCount(state);
  const resourceSiteWorkers = getAssignedResourceSiteWorkerCount(state);
  const conqueringTroops = getResourceSiteAssaultTroopCount(state);
  const totalPopulation = getPopulation(state);

  host.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);
  const headerBottom = host.drawOverlayHeader(panel, panelWidth, translations, {
    iconId: "people",
    title: translations.ui.survivors,
    rightText: `${totalPopulation}`,
    closeAction: { action: "close-village-modal" },
  });

  const rows: Array<{ iconId: string; value: string; label: string; tooltip: string; missing?: boolean }> = [
    { iconId: "people", value: `${state.survivors.workers}`, label: translations.ui.availableWorkers, tooltip: translations.ui.availableWorkers },
    { iconId: "build", value: `${buildingWorkers}`, label: translations.ui.buildingWorkers, tooltip: translations.ui.buildingWorkers },
    { iconId: "material", value: `${constructionWorkers}`, label: translations.ui.constructionCrew, tooltip: translations.ui.constructionCrew },
    { iconId: "people", value: `${resourceSiteWorkers}`, label: translations.ui.resourceSiteWorkers ?? "Site workers", tooltip: translations.ui.resourceSiteWorkers ?? "Site workers" },
    { iconId: "scout", value: `${state.survivors.troops}`, label: translations.ui.availableTroops, tooltip: translations.ui.availableTroops },
    { iconId: "shield", value: `${conqueringTroops}`, label: translations.ui.conqueringTroops ?? "On conquest", tooltip: translations.ui.conqueringTroops ?? "On conquest" },
    { iconId: "crisis-injured", value: `${state.health.injured}`, label: translations.roles.injured, tooltip: translations.roles.injured, missing: state.health.injured > 0 },
    {
      iconId: "crisis-shelter",
      value: `${housing.housed}/${housing.civilianCapacity + host.getTroopHousingCapacity(state)}`,
      label: translations.ui.housed,
      tooltip: translations.ui.housingTooltip,
    },
    {
      iconId: "crisis-homeless",
      value: `${housing.homeless}`,
      label: translations.ui.homeless,
      tooltip: translations.ui.housingTooltip,
      missing: housing.homeless > 0,
    },
  ];

  rows.forEach((row, index) => {
    drawWorkforceRow(host, panel, {
      ...row,
      x: 18,
      y: headerBottom + 2 + index * 23,
      width: panelWidth - 28,
    });
  });
}

function drawDecisionArchivePanel(
  host: InfoPanelsHost,
  state: GameState,
  translations: TranslationPack,
  width: number,
  height: number,
): void {
  const overlay = new Container();
  host.hudLayer.addChild(overlay);
  host.drawModalBackdrop(overlay, width, height, { action: "close-village-modal" });

  const panelWidth = Math.min(720, width - 48);
  const panelHeight = Math.max(420, Math.min(620, height - 72));
  const panel = new Container();
  panel.x = (width - panelWidth) / 2;
  panel.y = Math.max(36, (height - panelHeight) / 2);
  panel.eventMode = "static";
  overlay.addChild(panel);

  host.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);
  const headerBottom = host.drawOverlayHeader(panel, panelWidth, translations, {
    iconId: "archive",
    title: translations.ui.decisionArchive ?? "Decision archive",
    closeAction: { action: "close-village-modal" },
  });

  const profileHeadingY = headerBottom + 2;
  host.drawText(panel, translations.ui.leadershipProfile ?? "Leadership profile", 28, profileHeadingY, {
    fill: 0xd8c890,
    fontSize: 13,
    fontWeight: "900",
  });
  host.drawIcon(panel, decisionProfileIconByKind[getDecisionProfileKind(state)], 40, profileHeadingY + 34, 24);
  host.drawText(panel, getDecisionProfileOverallLabel(state, translations), 62, profileHeadingY + 22, {
    fill: 0xf1df9a,
    fontSize: 20,
    fontWeight: "900",
  });

  const axesStartY = profileHeadingY + 66;
  decisionProfileAxes.forEach((axis, index) => {
    drawDecisionProfileAxis(
      host,
      panel,
      translations.ui[axis.leftLabelKey] ?? axis.leftLabelKey,
      translations.ui[axis.rightLabelKey] ?? axis.rightLabelKey,
      getDecisionProfileAxisValue(state, axis.id),
      28,
      axesStartY + index * 48,
      panelWidth - 56,
    );
  });

  const historyY = axesStartY + decisionProfileAxes.length * 48 + 12;
  host.drawText(panel, translations.ui.decisionHistory ?? "Decision history", 28, historyY, {
    fill: 0xd8c890,
    fontSize: 13,
    fontWeight: "900",
  });
  const viewportY = historyY + 28;
  const viewportHeight = Math.max(84, panelHeight - viewportY - 20);
  const content = new Container();
  const mask = new Graphics();
  mask.rect(28, viewportY, panelWidth - 56, viewportHeight).fill({ color: 0xffffff, alpha: 1 });
  panel.addChild(mask);
  content.mask = mask;
  panel.addChild(content);
  host.setDecisionHistoryScrollArea({
    x: panel.x + 28,
    y: panel.y + viewportY,
    width: panelWidth - 56,
    height: viewportHeight,
  });

  const selectedIndex = host.getSelectedDecisionHistoryIndex();
  if (selectedIndex !== null && !state.quests.decisionHistory[selectedIndex]) {
    host.setSelectedDecisionHistoryIndex(null);
  }

  const history = state.quests.decisionHistory
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .reverse();

  if (history.length === 0) {
    host.drawText(panel, translations.ui.noDecisionHistory ?? "No decisions recorded yet.", 28, historyY + 30, {
      fill: 0xbfc7be,
      fontSize: 14,
    });
    return;
  }

  const rowWidth = panelWidth - 56;
  const activeSelection = host.getSelectedDecisionHistoryIndex();
  const rowHeights = history.map((row) => {
    const expanded = row.originalIndex === activeSelection;
    return getDecisionHistoryRowHeight(host, row, translations, rowWidth, expanded);
  });
  const contentHeight = rowHeights.reduce((total, rowHeight) => total + rowHeight + 8, 0);
  const scrollMax = Math.max(0, contentHeight - viewportHeight);
  host.setDecisionHistoryScrollMax(scrollMax);
  const nextScrollY = Math.max(0, Math.min(host.getDecisionHistoryScrollY(), scrollMax));
  host.setDecisionHistoryScrollY(nextScrollY);
  content.y = viewportY - nextScrollY;

  let rowY = 0;
  history.forEach((row, index) => {
    const expanded = row.originalIndex === host.getSelectedDecisionHistoryIndex();
    const rowHeight = rowHeights[index];
    drawDecisionHistoryRow(
      host,
      content,
      row,
      translations,
      28,
      rowY,
      rowWidth,
      rowHeight,
      expanded,
    );
    rowY += rowHeight + 8;
  });

  if (scrollMax > 0) {
    const trackHeight = viewportHeight;
    const thumbHeight = Math.max(32, trackHeight * (viewportHeight / contentHeight));
    const thumbY = viewportY + (trackHeight - thumbHeight) * (nextScrollY / scrollMax);
    const track = new Graphics();
    track.rect(panelWidth - 18, viewportY, 5, trackHeight)
      .fill({ color: 0x0b0d0a, alpha: 0.72 });
    track.rect(panelWidth - 18, thumbY, 5, thumbHeight)
      .fill({ color: 0xe0c46f, alpha: 0.6 });
    panel.addChild(track);
  }
}

function drawDecisionHistoryRow(
  host: InfoPanelsHost,
  parent: Container,
  row: DecisionHistoryRow,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
  expanded: boolean,
): void {
  const { entry } = row;
  const definitionCopy = translations.quests.decisions[entry.definitionId];
  const option = getDecisionHistoryOption(entry);
  const optionLabel = definitionCopy?.options[entry.optionId] ?? entry.optionId;
  const result = definitionCopy?.results[entry.optionId] ?? "";
  const day = `${translations.ui.day ?? "Day"} ${getGameDay(entry.resolvedAt)}`;
  const time = formatGameClock(entry.resolvedAt);
  const rowLayer = new Container();
  rowLayer.x = x;
  rowLayer.y = y;
  parent.addChild(rowLayer);

  const background = new Graphics();
  background.rect(0, 0, width, height)
    .fill({ color: expanded ? 0x1b1f18 : 0x171a14, alpha: 0.76 });
  rowLayer.addChild(background);

  host.bindLocalAction(rowLayer, () => {
    host.setSelectedDecisionHistoryIndex(expanded ? null : row.originalIndex);
    host.requestRender();
  });
  rowLayer.hitArea = new Rectangle(0, 0, width, height);

  host.drawText(rowLayer, `${day} ${time}`, 14, 11, {
    fill: 0xaeb6ad,
    fontSize: 11,
    fontWeight: "900",
  });
  host.drawText(rowLayer, definitionCopy?.title ?? entry.definitionId, 104, 7, {
    fill: 0xf5efdf,
    fontSize: 13,
    fontWeight: "900",
  });
  host.drawText(rowLayer, optionLabel, 104, 23, {
    fill: 0xd7ddd8,
    fontSize: 12,
    fontWeight: "700",
  });

  if (option) {
    host.drawDecisionImpactChips(
      rowLayer,
      getDecisionImpactLines(option, translations).slice(0, expanded ? 8 : 4),
      width - 14,
      10,
    );
  }

  if (!expanded) {
    return;
  }

  const bodyWidth = width - 28;
  const bodyLabel = host.drawText(rowLayer, definitionCopy?.body ?? "", 14, 52, {
    fill: 0xc9d0ca,
    fontSize: 12,
    fontWeight: "700",
    wordWrap: true,
    wordWrapWidth: bodyWidth,
  });
  const resultY = bodyLabel.y + bodyLabel.height + 8;
  host.drawText(rowLayer, result, 14, resultY, {
    fill: 0xf1df9a,
    fontSize: 12,
    fontWeight: "800",
    wordWrap: true,
    wordWrapWidth: bodyWidth,
  });
}

function getDecisionHistoryRowHeight(
  host: InfoPanelsHost,
  row: DecisionHistoryRow,
  translations: TranslationPack,
  width: number,
  expanded: boolean,
): number {
  if (!expanded) {
    return 42;
  }

  const definitionCopy = translations.quests.decisions[row.entry.definitionId];
  const resultText = definitionCopy?.results[row.entry.optionId] ?? "";
  const contentWidth = width - 28;
  const bodyHeight = host.measureWrappedTextHeight(definitionCopy?.body ?? "", 12, "700", contentWidth);
  const resultHeight = host.measureWrappedTextHeight(resultText, 12, "800", contentWidth);

  return Math.max(96, Math.ceil(52 + bodyHeight + 8 + resultHeight + 12));
}

function drawDecisionProfileAxis(
  host: InfoPanelsHost,
  parent: Container,
  leftLabel: string,
  rightLabel: string,
  value: number,
  x: number,
  y: number,
  width: number,
): void {
  host.drawText(parent, leftLabel, x, y, {
    fill: value < -15 ? 0xf1df9a : 0xbfc7be,
    fontSize: 12,
    fontWeight: "900",
  });
  const right = host.drawText(parent, rightLabel, x + width, y, {
    fill: value > 15 ? 0xf1df9a : 0xbfc7be,
    fontSize: 12,
    fontWeight: "900",
    align: "right",
  });
  right.anchor.x = 1;

  const trackY = y + 22;
  const track = new Graphics();
  track.rect(x, trackY, width, 8)
    .fill({ color: 0x0b0d0a, alpha: 0.78 });
  const centerX = x + width / 2;
  track.rect(centerX - 1, trackY - 4, 2, 16)
    .fill({ color: 0xd8c890, alpha: 0.42 });
  parent.addChild(track);

  const knobX = x + ((value + 100) / 200) * width;
  const knob = new Graphics();
  knob.circle(knobX, trackY + 4, 7)
    .fill({ color: 0xe0c46f, alpha: 0.95 });
  parent.addChild(knob);
}

function drawWorkforceRow(
  host: InfoPanelsHost,
  parent: Container,
  options: {
    iconId: string;
    label: string;
    value: string;
    tooltip: string;
    missing?: boolean;
    x: number;
    y: number;
    width: number;
  },
): void {
  const row = new Container();
  row.x = options.x;
  row.y = options.y;
  parent.addChild(row);

  host.drawIcon(row, options.iconId, 8, 9, 14);
  host.drawText(row, options.label, 28, 1, {
    fill: 0xaeb4b8,
    fontSize: 11,
    fontWeight: "800",
  });
  const value = host.drawText(row, options.value, options.width, 1, {
    fill: options.missing ? 0xff6f7d : 0xf1df9a,
    fontSize: 13,
    fontWeight: "900",
  });
  value.anchor.set(1, 0);

  row.hitArea = new Rectangle(0, -2, options.width, 23);
  host.bindTooltip(row, options.tooltip);
}

function drawWeatherOverviewPanel(
  host: InfoPanelsHost,
  state: GameState,
  translations: TranslationPack,
  width: number,
  height: number,
): void {
  const overlay = new Container();
  host.hudLayer.addChild(overlay);
  host.drawModalBackdrop(overlay, width, height, { action: "close-village-modal" });

  const panelWidth = Math.min(620, width - 48);
  const panelHeight = 356;
  const panel = new Container();
  panel.x = (width - panelWidth) / 2;
  panel.y = Math.max(36, (height - panelHeight) / 2);
  panel.eventMode = "static";
  overlay.addChild(panel);

  host.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);

  const condition = state.environment.condition;
  const definition = getEnvironmentDefinition(condition);
  const conditionLabel = translations.ui[definition.labelKey] ?? definition.id;
  const intensity = Math.max(1, Math.min(ENVIRONMENT_MAX_INTENSITY, Math.floor(state.environment.intensity)));
  const intensityIndex = getEnvironmentIntensityIndex(intensity);
  const moralePenaltyPerHour = definition.moralePenaltyPerHourByIntensity[intensityIndex] ?? 0;
  const healthIncidentRisk = definition.healthIncidentChanceByIntensity[intensityIndex] ?? 0;
  const shelterDeadlineHours = definition.shelterDeadlineHoursByIntensity?.[intensityIndex] ?? null;
  const endsIn = condition === "stable"
    ? translations.ui.environmentStable
    : formatScoutingRemaining(Math.max(0, state.environment.endsAt - state.elapsedSeconds));

  const headerBottom = host.drawOverlayHeader(panel, panelWidth, translations, {
    iconId: getEnvironmentPanelIconId(condition),
    title: translations.ui.weatherOverview ?? translations.ui.environment,
    rightText: conditionLabel,
    closeAction: { action: "close-village-modal" },
  });
  const descriptionLabel = host.drawText(panel, getEnvironmentDescription(state, translations), 24, headerBottom + 2, {
    fill: 0xc8cabb,
    fontSize: 13,
    fontWeight: "700",
    wordWrap: true,
    wordWrapWidth: panelWidth - 48,
  });
  const statusY = descriptionLabel.y + descriptionLabel.height + 12;
  host.drawText(panel, translations.ui.weatherStatus ?? "Status", 24, statusY, {
    fill: 0xaeb4b8,
    fontSize: 12,
    fontWeight: "800",
  });
  drawBreakdownRow(host, panel, translations.ui.environmentIntensity, `${intensity}/${ENVIRONMENT_MAX_INTENSITY}`, intensity, panelWidth, statusY + 32);
  drawBreakdownRow(host, panel, translations.ui.environmentEndsIn, endsIn, condition === "stable" ? 0 : -0.01, panelWidth, statusY + 66);
  const penaltiesY = statusY + 100;
  host.drawText(panel, translations.ui.weatherPenalties ?? "Potential penalties", 24, penaltiesY, {
    fill: 0xaeb4b8,
    fontSize: 12,
    fontWeight: "800",
  });
  drawBreakdownRow(
    host,
    panel,
    translations.ui.weatherMoralePenalty ?? "Morale penalty",
    `-${formatRate(moralePenaltyPerHour)}/h`,
    -moralePenaltyPerHour / GAME_HOUR_REAL_SECONDS,
    panelWidth,
    penaltiesY + 32,
  );
  drawBreakdownRow(
    host,
    panel,
    translations.ui.weatherHealthRisk ?? "Health incident pressure",
    `+${Math.round(healthIncidentRisk)}`,
    -Math.max(0.01, healthIncidentRisk),
    panelWidth,
    penaltiesY + 66,
  );

  if (shelterDeadlineHours !== null) {
    const shelterLabel = translations.ui.weatherShelterDeadline ?? "Shelter deadline";
    const shelterValue = state.environment.activeCrisis?.kind === "shelter"
      ? formatScoutingRemaining(Math.max(0, state.environment.activeCrisis.deadlineAt - state.elapsedSeconds))
      : `${shelterDeadlineHours}h`;
    const shelterTitle = state.environment.activeCrisis?.kind === "shelter"
      ? translations.ui.weatherShelterDeadlineCurrent ?? shelterLabel
      : shelterLabel;
    drawBreakdownRow(host, panel, shelterTitle, shelterValue, -0.01, panelWidth, penaltiesY + 100);
  }
}

function getEnvironmentPanelIconId(condition: EnvironmentConditionId): string {
  if (condition === "rain") {
    return "crisis-rain";
  }

  if (condition === "snowFront") {
    return "crisis-snow";
  }

  if (condition === "radiation") {
    return "crisis-radiation";
  }

  return "clock";
}

function getEnvironmentDescription(state: GameState, translations: TranslationPack): string {
  const condition = state.environment.condition;

  if (condition === "rain") {
    return translations.ui.weatherRainDescription ??
      "Rain front lowers morale and increases pressure on health incidents.";
  }

  if (condition === "snowFront") {
    return translations.ui.weatherSnowDescription ??
      "Snow front increases pressure on health and morale. Homeless survivors risk losses.";
  }

  if (condition === "radiation") {
    return translations.ui.weatherRadiationDescription ??
      "Radiation heavily strains community health and lowers morale.";
  }

  return translations.ui.weatherStableDescription ??
    "No active weather front is present. The camp is in a relatively stable state.";
}

function drawOasisOverviewPanel(
  host: InfoPanelsHost,
  state: GameState,
  translations: TranslationPack,
  width: number,
  height: number,
): void {
  const overlay = new Container();
  host.hudLayer.addChild(overlay);
  host.drawModalBackdrop(overlay, width, height, { action: "close-village-modal" });

  const panelWidth = Math.min(700, width - 48);
  const panelHeight = Math.max(300, Math.min(560, height - 72));
  const panel = new Container();
  panel.x = (width - panelWidth) / 2;
  panel.y = Math.max(36, (height - panelHeight) / 2);
  panel.eventMode = "static";
  overlay.addChild(panel);
  host.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);

  const capturedSites = state.resourceSites.filter((site) => site.captured);
  const headerBottom = host.drawOverlayHeader(panel, panelWidth, translations, {
    iconId: "oasis",
    title: translations.ui.oasisOverview ?? "Captured oases",
    rightText: `${capturedSites.length}`,
    closeAction: { action: "close-village-modal" },
  });
  const bodyY = headerBottom + 8;

  if (capturedSites.length === 0) {
    host.drawText(panel, translations.ui.quickNoCapturedOases ?? "No captured oasis yet.", 24, bodyY + 8, {
      fill: 0xbfc7be,
      fontSize: 13,
      fontWeight: "800",
    });
    return;
  }

  const rowHeight = 70;
  capturedSites.forEach((site, index) => {
    const rowY = bodyY + index * rowHeight;
    const row = new Graphics();
    row.rect(18, rowY, panelWidth - 36, rowHeight - 8)
      .fill({ color: 0x161a15, alpha: 0.78 });
    panel.addChild(row);

    const resourceName = translations.resources[site.resourceId] ?? site.resourceId;
    const travelHours = getTravelTilesToSite(site.id);
    const yieldPerHour = site.yieldPerWorker * GAME_HOUR_REAL_SECONDS;
    host.drawIcon(panel, site.resourceId, 34, rowY + 31, 18);
    host.drawText(panel, `${resourceName} ${translations.ui.resourceSiteTitle ?? "Oasis"}`, 52, rowY + 10, {
      fill: 0xf4eedf,
      fontSize: 14,
      fontWeight: "900",
    });
    host.drawText(
      panel,
      `${translations.ui.resourceSiteSettlement ?? "Oasis settlement crew"}: ${site.assignedWorkers}/${site.maxWorkers} · +${formatRate(yieldPerHour)}/h · ${translations.ui.resourceSiteTravelTime ?? "Travel time"}: ${travelHours}h`,
      52,
      rowY + 30,
      {
        fill: 0xaeb4b8,
        fontSize: 11,
        fontWeight: "800",
      },
    );

    const buttonX = panelWidth - 156;
    const buttonY = rowY + 16;
    const openButton = new Graphics();
    openButton.rect(buttonX, buttonY, 122, 34)
      .fill({ color: 0xe0c46f, alpha: 1 });
    panel.addChild(openButton);
    const openLabel = host.drawText(
      panel,
      translations.ui.openOasis ?? "Open oasis",
      buttonX + 61,
      buttonY + 9,
      {
        fill: 0x15180f,
        fontSize: 12,
        fontWeight: "900",
      },
    );
    openLabel.anchor.set(0.5, 0);

    host.bindAction(openButton, {
      action: "open-resource-site-modal",
      resourceSiteId: site.id,
    });
    host.bindTooltip(
      openButton,
      `${translations.ui.openOasis ?? "Open oasis"}\n${resourceName}`,
    );
  });
}

function drawResourceBreakdownPanel(
  host: InfoPanelsHost,
  state: GameState,
  translations: TranslationPack,
  width: number,
  height: number,
  resourceId: ResourceId,
): void {
  const overlay = new Container();
  host.hudLayer.addChild(overlay);
  host.drawModalBackdrop(overlay, width, height, { action: "close-village-modal" });

  const panelWidth = Math.min(620, width - 48);
  const panelHeight = Math.max(320, Math.min(520, height - 72));
  const panel = new Container();
  panel.x = (width - panelWidth) / 2;
  panel.y = Math.max(36, (height - panelHeight) / 2);
  panel.eventMode = "static";
  overlay.addChild(panel);
  host.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);

  const breakdown = getResourceBreakdown(state, resourceId);
  appendResourceSiteBreakdownLines(state, resourceId, breakdown);
  const totalRate = breakdown.reduce((total, line) => total + line.ratePerSecond, 0);
  const stockLabel = resourceId === "morale"
    ? `${Math.floor(state.resources.morale)}%`
    : `${Math.floor(state.resources[resourceId])}/${Math.floor(state.capacities[resourceId])}`;
  const headerBottom = host.drawOverlayHeader(panel, panelWidth, translations, {
    iconId: resourceId,
    title: translations.resources[resourceId],
    rightText: stockLabel,
    closeAction: { action: "close-village-modal" },
  });
  const sectionStartY = headerBottom + 4;
  host.drawText(panel, translations.ui.resourceBreakdown, 24, sectionStartY, {
    fill: 0xaeb4b8,
    fontSize: 12,
    fontWeight: "800",
  });

  drawBreakdownRow(
    host,
    panel,
    translations.ui.resourceNetChange,
    getHourlyRateLabel(totalRate),
    totalRate,
    panelWidth,
    sectionStartY + 32,
    true,
  );

  const activeTab = host.getActiveResourceBreakdownTab();
  const visibleBreakdown = breakdown.filter((line) =>
    activeTab === "production"
      ? line.ratePerSecond > 0
      : line.ratePerSecond < 0,
  );
  host.drawTabs(
    panel,
    [
      { id: "production", label: translations.ui.production },
      { id: "consumption", label: translations.ui.consumption },
    ],
    {
      activeId: activeTab,
      x: 24,
      y: sectionStartY + 72,
      height: 34,
      minWidth: 116,
      maxWidth: panelWidth - 48,
      onSelect: (tab: ResourceBreakdownTab) => {
        host.setActiveResourceBreakdownTab(tab);
        host.setResourceBreakdownScrollY(0);
        host.requestRender();
      },
    },
  );

  const rowHeight = 34;
  const viewportY = sectionStartY + 122;
  const viewportHeight = Math.max(88, panelHeight - viewportY - 24);

  if (
    host.getResourceBreakdownScrollResourceId() !== resourceId ||
    host.getResourceBreakdownScrollTab() !== activeTab
  ) {
    host.setResourceBreakdownScrollResourceId(resourceId);
    host.setResourceBreakdownScrollTab(activeTab);
    host.setResourceBreakdownScrollY(0);
  }

  if (visibleBreakdown.length === 0) {
    host.setResourceBreakdownScrollY(0);
    host.setResourceBreakdownScrollMax(0);
    host.drawText(panel, translations.ui.resourceNoActiveEffects, 24, viewportY, {
      fill: 0xc8cabb,
      fontSize: 13,
      fontWeight: "700",
    });
    return;
  }

  const contentHeight = visibleBreakdown.length * rowHeight;
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  host.setResourceBreakdownScrollMax(maxScroll);
  const scrollY = Math.max(0, Math.min(host.getResourceBreakdownScrollY(), maxScroll));
  host.setResourceBreakdownScrollY(scrollY);
  host.setResourceBreakdownScrollArea({
    x: panel.x + 18,
    y: panel.y + viewportY - 8,
    width: panelWidth - 36,
    height: viewportHeight + 16,
  });

  const content = new Container();
  content.y = viewportY - scrollY;
  panel.addChild(content);

  const mask = new Graphics();
  mask.eventMode = "none";
  mask.rect(18, viewportY - 8, panelWidth - 36, viewportHeight + 16)
    .fill({ color: 0xffffff, alpha: 1 });
  panel.addChild(mask);
  content.mask = mask;

  visibleBreakdown.forEach((line, index) => {
    drawBreakdownRow(
      host,
      content,
      getResourceBreakdownLabel(line, translations),
      getHourlyRateLabel(line.ratePerSecond),
      line.ratePerSecond,
      panelWidth,
      7 + index * rowHeight,
    );
  });

  if (maxScroll > 0) {
    const trackHeight = viewportHeight;
    const thumbHeight = Math.max(30, trackHeight * viewportHeight / contentHeight);
    const thumbY = viewportY + (trackHeight - thumbHeight) * (scrollY / maxScroll);
    const scrollbar = new Graphics();
    scrollbar.rect(panelWidth - 20, viewportY, 5, trackHeight)
      .fill({ color: 0x0b0d0a, alpha: 0.76 });
    scrollbar.rect(panelWidth - 20, thumbY, 5, thumbHeight)
      .fill({ color: 0xe0c46f, alpha: 0.66 });
    panel.addChild(scrollbar);
  }
}

function drawBreakdownRow(
  host: InfoPanelsHost,
  parent: Container,
  label: string,
  value: string,
  ratePerSecond: number,
  width: number,
  y: number,
  highlighted = false,
): void {
  const row = new Graphics();
  row.rect(18, y - 7, width - 36, 28)
    .fill({ color: highlighted ? 0x262719 : 0x0f120e, alpha: highlighted ? 0.72 : 0.38 });
  parent.addChild(row);

  host.drawText(parent, label, 32, y, {
    fill: highlighted ? 0xf5efdf : 0xd8d2bd,
    fontSize: 12,
    fontWeight: highlighted ? "900" : "800",
  });
  const valueText = host.drawText(parent, value, width - 32, y, {
    fill: getRateColor(ratePerSecond),
    fontSize: 12,
    fontWeight: "900",
  });
  valueText.anchor.set(1, 0);
}

function getResourceBreakdownLabel(line: ResourceBreakdownLine, translations: TranslationPack): string {
  if (line.source === "mainBuildingBonus") {
    return translations.ui.mainBuildingProductionBonus;
  }

  if (line.source === "moraleProductionPenalty") {
    return translations.ui.moraleProductionPenalty;
  }

  if ((line.source === "building" || line.source === "coalMine") && line.buildingId) {
    return translations.buildings[line.buildingId].name;
  }

  if (line.source === "survivorConsumption") {
    return `${translations.ui.survivorConsumption}${line.count ? ` (${line.count})` : ""}`;
  }

  if (line.source === "homeless") {
    return `${translations.ui.homeless}${line.count ? ` (${line.count})` : ""}`;
  }

  if (line.source === "foodShortage") {
    return translations.ui.moraleFoodShortage;
  }

  if (line.source === "continuousShifts") {
    return translations.ui.moraleContinuousShifts;
  }

  if (line.source === "environment") {
    return translations.ui.environment;
  }

  if (line.source === "resourceSite") {
    return translations.ui.resourceSiteProduction ?? "Secured oasis production";
  }

  return translations.ui.moraleWaterShortage;
}

function appendResourceSiteBreakdownLines(
  state: GameState,
  resourceId: ResourceId,
  breakdown: ResourceBreakdownLine[],
): void {
  const multiplier = getGlobalProductionMultiplier(state);
  let totalRate = 0;
  let totalWorkers = 0;

  for (const site of state.resourceSites) {
    if (!site.captured || site.assignedWorkers <= 0 || site.resourceId !== resourceId) {
      continue;
    }

    totalWorkers += site.assignedWorkers;
    totalRate += site.yieldPerWorker * site.assignedWorkers * multiplier;
  }

  if (totalRate <= 0) {
    return;
  }

  breakdown.push({
    source: "resourceSite",
    resourceId,
    ratePerSecond: totalRate,
    count: totalWorkers,
  });
}
