import { Container, Graphics, Rectangle, Sprite } from "pixi.js";
import { buildingById } from "../../../data/buildings";
import { buildingVisualDefinitions } from "../../../data/buildingVisuals";
import { combatUnitDefinitions } from "../../../data/combatUnits";
import { GAME_HOUR_REAL_SECONDS } from "../../../game/time";
import type { BuildingCategory, BuildingId, GameState, MarketResourceId, ResourceBag, ResourceId, UnitId } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import {
  getBuildingBuildSeconds,
  getBuildingWorkerLimit,
  getCoalMineCoalRate,
  getConstructionWorkerRequirement,
  getGlobalProductionMultiplier,
  getMainBuildingLevelRequirement,
  getUpgradeCost,
  getWorkshopCoalRate,
  getWorkshopMaterialRate,
  hasAvailableBuildingSlot,
  isBuildingInactiveDueToCoal,
  isMainBuildingRequirementMet,
} from "../../../systems/buildings";
import {
  canTradeAtMarket,
  getAvailableMarketTrades,
  getMarketTradeCapacity,
  getMarketTradeLimit,
  getMarketTradeSlots,
  isMarketResourceId,
  marketResourceIds,
} from "../../../systems/market";
import { canAfford } from "../../../systems/resources";
import {
  getBarracksTrainingCost,
  getBarracksTrainingCostForCount,
  getBarracksTrainingSeconds,
  unitIds,
} from "../../../systems/survivors";
import { buildCategoryOrder, UI_PANEL_RADIUS, uiTextSize, uiTheme } from "../core/constants";
import type {
  Bounds,
  BuildingMetric,
  DrawCenteredTextFn,
  DrawIconFn,
  DrawPanelFn,
  DrawTextFn,
  EffectLine,
  PixiActionDetail,
  RectButtonOptions,
  TabItem,
  TabOptions,
} from "../core/types";
import { getCostLineParts, getCurrentBuildingEffects, getNextLevelEffects } from "../helpers/buildingEffects";
import { formatPercentBonus, formatRate, formatRealTimeRemaining, formatScoutingRemaining, formatTemplate, getHourlyRateLabel, getRateColor } from "../helpers/formatters";
import { getUnitIconId } from "../helpers/unitIcons";
import { drawActionStepper, drawLocalStepper } from "./modalControls";
import { drawModalContentPlane, drawModalHeaderPlane } from "./modalLayout";

type BuildingModalsHost = {
  requestRender: () => void;
  playTabSwitchSound: () => void;
  drawText: DrawTextFn;
  drawCenteredText: DrawCenteredTextFn;
  drawIcon: DrawIconFn;
  drawPanel: DrawPanelFn;
  drawTabs: <T extends string>(parent: Container, tabs: Array<TabItem<T>>, options: TabOptions<T>) => void;
  bindTooltip: (target: Container, text: string) => void;
  createRectButton: (parent: Container, options: RectButtonOptions) => Container;
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
  createLocalModalButton: (
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    onTap: () => void,
    disabled?: boolean,
  ) => Container;
  createBuildingSprite: (buildingId: BuildingId, level: number, built: boolean) => Sprite;

  getBuildChoicesScrollPlotId: () => string | null;
  setBuildChoicesScrollPlotId: (value: string | null) => void;
  getBuildChoicesScrollY: () => number;
  setBuildChoicesScrollY: (value: number) => void;
  setBuildChoicesScrollMax: (value: number) => void;
  setBuildChoicesScrollArea: (value: Bounds | null) => void;
  getActiveBuildCategory: () => BuildingCategory;
  setActiveBuildCategory: (value: BuildingCategory) => void;
  getActiveBuildingDetailTab: () => BuildingDetailTab;
  setActiveBuildingDetailTab: (value: BuildingDetailTab) => void;
  getBuildingBonusScrollBuildingId: () => BuildingId | null;
  setBuildingBonusScrollBuildingId: (value: BuildingId | null) => void;
  getBuildingBonusScrollY: () => number;
  setBuildingBonusScrollY: (value: number) => void;
  setBuildingBonusScrollMax: (value: number) => void;
  setBuildingBonusScrollArea: (value: Bounds | null) => void;

  getMarketFromResource: () => MarketResourceId;
  setMarketFromResource: (value: MarketResourceId) => void;
  getMarketToResource: () => MarketResourceId;
  setMarketToResource: (value: MarketResourceId) => void;
  getMarketAmount: () => number;
  setMarketAmount: (value: number) => void;
  getBarracksTroopCount: () => number;
  setBarracksTroopCount: (value: number) => void;
  getBarracksTrainingUnitId: () => UnitId;
  setBarracksTrainingUnitId: (value: UnitId) => void;
};

type BuildingDetailTab = "overview" | "training" | "units" | "bonuses";
const BUILDING_METRIC_ICON_SIZE = 30;
const BUILDING_INFO_TOKEN_ICON_SIZE = 22;
const BUILDING_INFO_TOKEN_HEIGHT = 28;

export function drawBuildChoices(
  host: BuildingModalsHost,
  parent: Container,
  plotId: string,
  buildableBuildings: BuildingId[],
  state: GameState,
  translations: TranslationPack,
  modalWidth: number,
  modalHeight: number,
): void {
  if (buildableBuildings.length === 0) {
    host.drawText(parent, translations.ui.alreadyBuilt, 24, 96, { fill: uiTheme.textMuted, fontSize: uiTextSize.body });
    return;
  }

  if (host.getBuildChoicesScrollPlotId() !== plotId) {
    host.setBuildChoicesScrollPlotId(plotId);
    host.setBuildChoicesScrollY(0);
  }

  const availableCategories = buildCategoryOrder.filter((category) =>
    buildableBuildings.some((buildingId) => buildingById[buildingId].category === category),
  );
  const activeCategory = (availableCategories.includes(host.getActiveBuildCategory())
    ? host.getActiveBuildCategory()
    : availableCategories[0]) ?? "resource";
  host.setActiveBuildCategory(activeCategory);

  const filteredBuildings = buildableBuildings.filter(
    (buildingId) => buildingById[buildingId].category === activeCategory,
  );
  const gap = 10;
  const listX = 24;
  const tabY = 104;
  const listY = tabY + 48;
  const availableHeight = modalHeight - listY - 24;
  const rowHeight = 150;
  const contentHeight = filteredBuildings.length * rowHeight + gap * Math.max(0, filteredBuildings.length - 1);
  const maxScroll = Math.max(0, contentHeight - availableHeight);
  const needsScroll = maxScroll > 1;
  const scrollbarGutter = needsScroll ? 22 : 0;
  const rowWidth = modalWidth - 48 - scrollbarGutter;
  const scrollY = Math.max(0, Math.min(maxScroll, host.getBuildChoicesScrollY()));

  drawBuildCategoryTabs(
    host,
    parent,
    availableCategories,
    activeCategory,
    translations,
    listX,
    tabY,
    modalWidth - 48,
  );

  host.setBuildChoicesScrollY(scrollY);
  host.setBuildChoicesScrollMax(maxScroll);
  host.setBuildChoicesScrollArea({
    x: parent.x + listX,
    y: parent.y + listY,
    width: rowWidth + scrollbarGutter,
    height: availableHeight,
  });

  const listContent = new Container();
  listContent.x = listX;
  listContent.y = listY - scrollY;
  parent.addChild(listContent);

  const listMask = new Graphics();
  listMask.eventMode = "none";
  listMask.rect(listX - 4, listY - 4, rowWidth + 8, availableHeight + 8).fill({ color: 0xffffff, alpha: 1 });
  parent.addChild(listMask);
  listContent.mask = listMask;

  filteredBuildings.forEach((buildingId, index) => {
    const translated = translations.buildings[buildingId];
    const cost = getUpgradeCost(buildingId, 0);
    const affordable = canAfford(state.resources, cost);
    const queueAvailable = hasAvailableBuildingSlot(state);
    const requiredWorkers = getConstructionWorkerRequirement(buildingId, 0);
    const workersAvailable = state.survivors.workers >= requiredWorkers;
    const mainBuildingUnlocked = isMainBuildingRequirementMet(state, buildingId, 1);
    const requiredMainBuildingLevel = getMainBuildingLevelRequirement(buildingId, 1);
    const disabled = !mainBuildingUnlocked || !affordable || !queueAvailable || !workersAvailable;
    const disabledTooltip = disabled
      ? getBuildActionDisabledTooltip(
        translations,
        cost,
        state.resources,
        requiredWorkers,
        state.survivors.workers,
        queueAvailable,
        mainBuildingUnlocked,
        requiredMainBuildingLevel,
      )
      : undefined;

    drawBuildRow(host, listContent, {
      x: 2,
      y: index * (rowHeight + gap),
      width: rowWidth - 4,
      height: rowHeight,
      buildingId,
      level: 1,
      built: true,
      title: translated.name,
      description: translated.description,
      cost,
      requiredWorkers,
      buttonLabel: translations.ui.buildHere,
      disabled,
      disabledTooltip,
      action: { action: "build", building: buildingId, plot: plotId },
      state,
      translations,
      effects: getNextLevelEffects(buildingId, 0, translations),
    });
  });

  if (needsScroll) {
    drawBuildChoicesScrollbar(
      parent,
      listX + rowWidth + 9,
      listY,
      10,
      availableHeight,
      scrollY,
      maxScroll,
      contentHeight,
    );
  }
}

function drawBuildCategoryTabs(
  host: BuildingModalsHost,
  parent: Container,
  categories: BuildingCategory[],
  activeCategory: BuildingCategory,
  translations: TranslationPack,
  x: number,
  y: number,
  maxWidth: number,
): void {
  host.drawTabs(
    parent,
    categories.map((category) => ({
      id: category,
      label: getBuildCategoryLabel(category, translations),
    })),
    {
      activeId: activeCategory,
      x,
      y,
      height: 34,
      minWidth: 96,
      maxTabWidth: 148,
      maxWidth,
      onSelect: (category) => {
        host.setActiveBuildCategory(category);
        host.setBuildChoicesScrollY(0);
        host.requestRender();
      },
    },
  );
}

function getBuildCategoryLabel(category: BuildingCategory, translations: TranslationPack): string {
  if (category === "resource") {
    return translations.ui.buildingCategoryResource;
  }
  if (category === "housing") {
    return translations.ui.buildingCategoryHousing;
  }
  return translations.ui.buildingCategorySupport;
}

function drawBuildChoicesScrollbar(
  parent: Container,
  x: number,
  y: number,
  width: number,
  height: number,
  scrollY: number,
  maxScroll: number,
  contentHeight: number,
): void {
  const track = new Graphics();
  track.rect(x, y, width, height)
    .fill({ color: uiTheme.surfaceSunken, alpha: 0.38 });
  parent.addChild(track);

  const thumbHeight = Math.max(46, (height / contentHeight) * height);
  const thumbTravel = Math.max(0, height - thumbHeight - 4);
  const thumbY = y + 2 + (maxScroll > 0 ? (scrollY / maxScroll) * thumbTravel : 0);
  const thumb = new Graphics();
  thumb.rect(x + 2, thumbY, width - 4, thumbHeight)
    .fill({ color: uiTheme.accentStrong, alpha: 0.5 });
  parent.addChild(thumb);
}

function drawBuildRow(
  host: BuildingModalsHost,
  parent: Container,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    buildingId: BuildingId;
    level: number;
    built: boolean;
    title: string;
    description: string;
    cost: ResourceBag;
    requiredWorkers: number;
    buttonLabel: string;
    disabled: boolean;
    disabledTooltip?: string;
    action: PixiActionDetail;
    state: GameState;
    translations: TranslationPack;
    effects: EffectLine[];
  },
): void {
  const row = new Container();
  row.x = options.x;
  row.y = options.y;
  parent.addChild(row);
  host.drawPanel(row, 0, 0, options.width, options.height);

  const asset = host.createBuildingSprite(options.buildingId, options.level, options.built);
  layoutBuildingPreviewSprite(asset, options.buildingId, 18, 8, 112, options.height - 16);
  row.addChild(asset);

  const textX = 150;
  const buttonWidth = 150;
  const buttonHeight = 36;
  const buttonX = options.width - buttonWidth - 28;
  const textWidth = Math.max(240, buttonX - textX - 24);
  const titleY = 16;
  const descriptionY = 42;
  const costTokenY = 92;
  const benefitsTokenY = 122;
  const tokenWidth = Math.max(180, textWidth - 10);

  host.drawText(row, options.title, textX, titleY, {
    fill: uiTheme.text,
    fontSize: uiTextSize.control,
    fontWeight: "900",
  });
  const description = host.drawText(row, options.description, textX, descriptionY, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.small,
    fontWeight: "600",
    lineHeight: 16,
    wordWrap: true,
    wordWrapWidth: textWidth,
  });
  const descriptionMask = new Graphics();
  descriptionMask.rect(textX, descriptionY, textWidth, 34).fill({ color: 0xffffff, alpha: 1 });
  row.addChild(descriptionMask);
  description.mask = descriptionMask;

  const costWidth = drawCostLine(host, row, options.cost, options.state.resources, options.translations, textX, costTokenY, false, tokenWidth);

  if (options.requiredWorkers > 0) {
    drawWorkerRequirement(
      host,
      row,
      options.requiredWorkers,
      options.state.survivors.workers,
      options.translations,
      textX + costWidth + 8,
      costTokenY,
    );
  }
  drawEffects(host, row, options.effects, textX, benefitsTokenY, tokenWidth);
  host.createModalButton(
    row,
    `${options.buttonLabel} ${Math.ceil(getBuildingBuildSeconds(options.state, options.buildingId, 0))}s`,
    buttonX,
    (options.height - buttonHeight) / 2,
    buttonWidth,
    buttonHeight,
    options.action,
    options.disabled,
    options.disabledTooltip,
  );
}

export function drawBuildingDetail(
  host: BuildingModalsHost,
  parent: Container,
  plotId: string,
  buildingId: BuildingId,
  level: number,
  upgradingRemaining: number,
  maxLevel: number,
  state: GameState,
  translations: TranslationPack,
  modalWidth: number,
  modalHeight: number,
): void {
  const translated = translations.buildings[buildingId];
  const building = state.buildings[buildingId];
  const definition = buildingById[buildingId];
  const cost = getUpgradeCost(buildingId, level);
  const locked = level >= maxLevel;
  const upgrading = upgradingRemaining > 0;
  const affordable = canAfford(state.resources, cost);
  const queueAvailable = hasAvailableBuildingSlot(state);
  const requiredWorkers = getConstructionWorkerRequirement(buildingId, level);
  const workersAvailable = state.survivors.workers >= requiredWorkers;
  const requiredMainBuildingLevel = getMainBuildingLevelRequirement(buildingId, level + 1);
  const mainBuildingUnlocked = locked || isMainBuildingRequirementMet(state, buildingId, level + 1);
  const disabled = locked || upgrading || !mainBuildingUnlocked || !affordable || !queueAvailable || !workersAvailable;

  const sideMargin = 36;
  const contentTop = 42;
  const previewWidth = 118;
  const previewSlotX = sideMargin;
  const previewSlotY = 26;
  const previewSlotHeight = 112;
  const titleX = sideMargin + previewWidth + 20;
  const bodyWidth = modalWidth - sideMargin * 2;
  const metricGap = 8;
  const metrics = getBuildingDetailMetrics(buildingId, building, level, maxLevel, state, translations);
  const metricCount = Math.max(1, Math.min(7, metrics.length));
  const metricWidth = (bodyWidth - metricGap * (metricCount - 1)) / metricCount;
  const metricY = contentTop + 120;
  const hasControls = hasBuildingControlSection(buildingId);
  const hasDetailTabs = true;
  const activeDetailTab = hasDetailTabs ? getActiveBuildingDetailTab(host, buildingId) : "overview";
  const showUpgradeFooter = activeDetailTab === "overview";
  const footerHeight = 54;
  const footerY = modalHeight - sideMargin - footerHeight;
  const sectionY = metricY + 98;
  const sectionBottomY = showUpgradeFooter ? footerY - 22 : modalHeight - sideMargin;
  const sectionHeight = Math.max(176, sectionBottomY - sectionY);
  const columnGap = 14;
  const controlWidth = hasControls ? Math.max(360, Math.floor((bodyWidth - columnGap) * 0.56)) : 0;
  const nextLevelWidth = hasControls ? bodyWidth - controlWidth - columnGap : bodyWidth;
  const controlX = sideMargin;
  const nextLevelX = hasControls ? controlX + controlWidth + columnGap : sideMargin;
  const adjacentPlots = getAdjacentBuildingPlotIds(state, plotId);
  const titleWidth = modalWidth - titleX - sideMargin - (adjacentPlots ? 170 : 0);

  const content = new Container();
  parent.addChild(content);
  drawModalHeaderPlane(content, modalWidth, metricY - 18);
  drawModalContentPlane(content, modalWidth, modalHeight, metricY - 18);

  const asset = host.createBuildingSprite(buildingId, Math.max(1, level), level > 0);
  layoutBuildingPreviewSprite(asset, buildingId, previewSlotX, previewSlotY, previewWidth, previewSlotHeight);
  content.addChild(asset);

  host.drawText(content, translated.name, titleX, contentTop + 2, {
    fill: uiTheme.text,
    fontSize: uiTextSize.frontTitle,
    fontWeight: "900",
  });
  host.drawText(content, translated.description, titleX, contentTop + 64, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.bodyLarge,
    fontWeight: "700",
    wordWrap: true,
    wordWrapWidth: titleWidth,
  });

  if (adjacentPlots) {
    drawBuildingModalNavigation(host, content, adjacentPlots.previous, adjacentPlots.next, translations, modalWidth);
  }

  metrics.slice(0, metricCount).forEach((metric, index) => {
    drawMetricCard(host, content, metric, sideMargin + index * (metricWidth + metricGap), metricY, metricWidth, 74);
  });

  if (hasDetailTabs) {
    drawBuildingDetailTabs(host, content, buildingId, activeDetailTab, translations, sideMargin, sectionY, bodyWidth);
    if (activeDetailTab === "bonuses") {
      drawBuildingBonusOverviewSection(
        host,
        content,
        buildingId,
        level,
        maxLevel,
        translations,
        sideMargin,
        sectionY + 52,
        bodyWidth,
        Math.max(120, sectionHeight - 52),
        parent.x + sideMargin,
        parent.y + sectionY + 52,
      );
    } else if (activeDetailTab === "training" && buildingId === "barracks") {
      drawBarracksTrainingSection(
        host,
        content,
        state,
        translations,
        sideMargin,
        sectionY + 52,
        bodyWidth,
        Math.max(120, sectionHeight - 52),
      );
    } else if (activeDetailTab === "units" && buildingId === "barracks") {
      drawBarracksUnitsSection(
        host,
        content,
        translations,
        sideMargin,
        sectionY + 52,
        bodyWidth,
        Math.max(120, sectionHeight - 52),
      );
    } else {
      const tabContentY = sectionY + 52;
      const tabContentHeight = Math.max(120, sectionHeight - 52);
      if (hasControls) {
        drawBuildingControlSection(
          host,
          content,
          buildingId,
          state,
          translations,
          controlX,
          tabContentY,
          controlWidth,
          tabContentHeight,
        );
      }
      drawNextLevelSection(
        host,
        content,
        buildingId,
        level,
        locked,
        cost,
        requiredWorkers,
        state,
        translations,
        hasControls ? nextLevelX : sideMargin,
        tabContentY,
        hasControls ? nextLevelWidth : bodyWidth,
        tabContentHeight,
      );
    }
  } else {
    if (hasControls) {
      drawBuildingControlSection(host, content, buildingId, state, translations, controlX, sectionY, controlWidth, sectionHeight);
    }
    drawNextLevelSection(
      host,
      content,
      buildingId,
      level,
      locked,
      cost,
      requiredWorkers,
      state,
      translations,
      nextLevelX,
      sectionY,
      nextLevelWidth,
      sectionHeight,
    );
  }

  if (!showUpgradeFooter) {
    return;
  }

  const buttonLabel = upgrading
    ? `${Math.ceil(upgradingRemaining)}s`
    : locked
      ? `${level}/${maxLevel}`
      : `${translations.ui.upgrade} ${Math.ceil(getBuildingBuildSeconds(state, buildingId, level))}s`;
  const disabledTooltip = getUpgradeActionDisabledTooltip(
    translations,
    locked,
    upgrading,
    upgradingRemaining,
    cost,
    state.resources,
    requiredWorkers,
    state.survivors.workers,
    queueAvailable,
    mainBuildingUnlocked,
    requiredMainBuildingLevel,
  );
  drawDetailPanel(content, sideMargin, footerY, bodyWidth, footerHeight, 0.44);
  const footerText = locked
    ? translations.ui.maxLevelReached
    : translations.ui.nextLevel;
  host.drawIcon(content, !mainBuildingUnlocked ? "build" : "clock", sideMargin + 24, footerY + footerHeight / 2, 17);
  host.drawText(content, footerText, sideMargin + 50, footerY + 17, {
    fill: !mainBuildingUnlocked ? uiTheme.warning : uiTheme.textMuted,
    fontSize: uiTextSize.body,
    fontWeight: "900",
  });
  host.createModalButton(
    content,
    buttonLabel,
    sideMargin + bodyWidth - 236,
    footerY + 10,
    210,
    34,
    { action: "upgrade", building: buildingId },
    disabled,
    disabledTooltip,
  );
}

function getAdjacentBuildingPlotIds(
  state: GameState,
  currentPlotId: string,
): { previous: string; next: string } | null {
  const occupiedPlots = state.village.plots.filter((plot) => plot.buildingId !== null);
  if (occupiedPlots.length <= 1) {
    return null;
  }

  const currentIndex = occupiedPlots.findIndex((plot) => plot.id === currentPlotId);
  if (currentIndex < 0) {
    return null;
  }

  return {
    previous: occupiedPlots[(currentIndex - 1 + occupiedPlots.length) % occupiedPlots.length].id,
    next: occupiedPlots[(currentIndex + 1) % occupiedPlots.length].id,
  };
}

function drawBuildingModalNavigation(
  host: BuildingModalsHost,
  parent: Container,
  previousPlotId: string,
  nextPlotId: string,
  translations: TranslationPack,
  modalWidth: number,
): void {
  const buttonSize = 38;
  const gap = 8;
  const y = 18;
  const rightEdge = modalWidth - 106;
  const previousX = rightEdge - buttonSize * 2 - gap;
  const nextX = rightEdge - buttonSize;

  host.createRectButton(parent, {
    iconId: "arrow-left",
    x: previousX,
    y,
    width: buttonSize,
    height: buttonSize,
    detail: { action: "open-village-plot", plot: previousPlotId },
    tooltip: translations.ui.previousBuilding,
    tone: "secondary",
  });
  host.createRectButton(parent, {
    iconId: "arrow-right",
    x: nextX,
    y,
    width: buttonSize,
    height: buttonSize,
    detail: { action: "open-village-plot", plot: nextPlotId },
    tooltip: translations.ui.nextBuilding,
    tone: "secondary",
  });
}

function hasBuildingControlSection(buildingId: BuildingId): boolean {
  return buildingId === "coalMine" || buildingId === "workshop" || buildingId === "market";
}

function getActiveBuildingDetailTab(
  host: BuildingModalsHost,
  buildingId: BuildingId,
): BuildingDetailTab {
  const activeTab = host.getActiveBuildingDetailTab();

  if ((activeTab === "training" || activeTab === "units") && buildingId !== "barracks") {
    return "overview";
  }

  return activeTab;
}

function drawBuildingDetailTabs(
  host: BuildingModalsHost,
  parent: Container,
  buildingId: BuildingId,
  activeTab: BuildingDetailTab,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
): void {
  const labels = getBuildingDetailTabLabels(translations);
  const tabs: Array<TabItem<BuildingDetailTab>> = [
    { id: "overview", label: labels.overview },
  ];

  if (buildingId === "barracks") {
    tabs.push({ id: "training", label: labels.training });
    tabs.push({ id: "units", label: labels.units });
  }

  tabs.push({ id: "bonuses", label: labels.bonuses });
  host.drawTabs(
    parent,
    tabs,
    {
      x,
      y,
      height: 38,
      minWidth: 132,
      maxWidth: width,
      activeId: activeTab,
      onSelect: (tab) => {
        host.setActiveBuildingDetailTab(tab);
        host.playTabSwitchSound();
        host.requestRender();
      },
    },
  );
}

function drawBuildingBonusOverviewSection(
  host: BuildingModalsHost,
  parent: Container,
  buildingId: BuildingId,
  level: number,
  maxLevel: number,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
  absoluteX: number,
  absoluteY: number,
): void {
  const copy = getBuildingBonusCopy(translations);

  if (host.getBuildingBonusScrollBuildingId() !== buildingId) {
    host.setBuildingBonusScrollBuildingId(buildingId);
    host.setBuildingBonusScrollY(0);
  }

  const rows = Array.from({ length: maxLevel }, (_, index) => index + 1);
  const rowGap = 8;
  const rowHeight = 42;
  const listX = x;
  const listY = y;
  const viewportHeight = Math.max(48, height);
  const contentHeight = rows.length * rowHeight + rowGap * Math.max(0, rows.length - 1);
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const needsScroll = maxScroll > 1;
  const scrollbarGutter = needsScroll ? 18 : 0;
  const rowWidth = width - scrollbarGutter;
  const scrollY = Math.max(0, Math.min(maxScroll, host.getBuildingBonusScrollY()));
  host.setBuildingBonusScrollY(scrollY);
  host.setBuildingBonusScrollMax(maxScroll);
  host.setBuildingBonusScrollArea({
    x: absoluteX,
    y: absoluteY,
    width,
    height: viewportHeight,
  });

  const listContent = new Container();
  listContent.x = listX;
  listContent.y = listY - scrollY;
  parent.addChild(listContent);

  const listMask = new Graphics();
  listMask.eventMode = "none";
  listMask.rect(listX - 4, listY - 4, width + 8, viewportHeight + 8).fill({ color: 0xffffff, alpha: 1 });
  parent.addChild(listMask);
  listContent.mask = listMask;

  rows.forEach((rowLevel) => {
    const rowY = (rowLevel - 1) * (rowHeight + rowGap);
    drawBuildingBonusRow(host, listContent, buildingId, rowLevel, level, translations, 0, rowY, rowWidth, rowHeight, copy);
  });

  if (needsScroll) {
    drawBuildChoicesScrollbar(
      parent,
      x + width - 12,
      listY,
      8,
      viewportHeight,
      scrollY,
      maxScroll,
      contentHeight,
    );
  }
}

function drawBuildingBonusRow(
  host: BuildingModalsHost,
  parent: Container,
  buildingId: BuildingId,
  rowLevel: number,
  currentLevel: number,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
  copy: ReturnType<typeof getBuildingBonusCopy>,
): void {
  const unlocked = currentLevel >= rowLevel;
  const current = currentLevel === rowLevel;
  const fill = current ? uiTheme.rowActive : uiTheme.row;
  const borderColor = current ? uiTheme.borderStrong : uiTheme.border;
  const effects = getCurrentBuildingEffects(buildingId, rowLevel, translations);
  const status = current ? copy.current : copy.locked;
  const statusFill = current ? uiTheme.accentStrong : unlocked ? uiTheme.positive : uiTheme.textSoft;

  const rowLayer = new Container();
  rowLayer.x = x;
  rowLayer.y = y;
  parent.addChild(rowLayer);

  const background = new Graphics();
  background.roundRect(0, 0, width, height, UI_PANEL_RADIUS)
    .fill({ color: fill, alpha: current ? 0.48 : 0.34 })
    .stroke({ color: borderColor, alpha: current ? 0.72 : 0.36, width: 1 });
  rowLayer.addChild(background);

  host.drawText(rowLayer, `${copy.level} ${rowLevel}`, 16, height / 2 - 8, {
    fill: statusFill,
    fontSize: uiTextSize.body,
    fontWeight: "900",
  });

  if (effects.length > 0) {
    drawEffects(host, rowLayer, effects, 102, Math.max(5, height / 2 - BUILDING_INFO_TOKEN_HEIGHT / 2), width - 210);
  } else {
    host.drawText(rowLayer, copy.noBonus, 104, height / 2 - 8, {
      fill: unlocked ? uiTheme.textMuted : uiTheme.textSoft,
      fontSize: uiTextSize.body,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: Math.max(120, width - 220),
    });
  }

  if (unlocked) {
    const doneIcon = host.drawIcon(rowLayer, "done", width - 42, height / 2, 18);
    host.bindTooltip(doneIcon, current ? copy.current : copy.unlocked);
  } else if (!unlocked) {
    const lockIcon = host.drawIcon(rowLayer, "lock", width - 42, height / 2, 18);
    host.bindTooltip(lockIcon, copy.locked);
  }
  if (effects.length === 0) {
    host.bindTooltip(rowLayer, `${copy.level} ${rowLevel}: ${copy.noBonus}`);
  }
}

function getBuildingDetailTabLabels(translations: TranslationPack): Record<BuildingDetailTab, string> {
  return {
    overview: translations.ui.buildingDetailOverview ?? "Overview",
    training: translations.ui.training ?? "Training",
    units: translations.ui.units ?? "Units",
    bonuses: translations.ui.buildingDetailBonuses ?? "Bonuses",
  };
}

function getBuildingBonusCopy(translations: TranslationPack): {
  title: string;
  level: string;
  current: string;
  unlocked: string;
  locked: string;
  noBonus: string;
} {
  return {
    title: translations.ui.buildingBonusTitle ?? "Bonuses by level",
    level: translations.ui.level ?? "Lvl",
    current: translations.ui.buildingLevelCurrent ?? "Current",
    unlocked: translations.ui.buildingLevelUnlocked ?? "Unlocked",
    locked: translations.ui.buildingLevelLocked ?? "Locked",
    noBonus: translations.ui.buildingNoLevelBonus ?? "No listed bonus",
  };
}

function layoutBuildingPreviewSprite(
  sprite: Sprite,
  buildingId: BuildingId,
  slotX: number,
  slotY: number,
  slotWidth: number,
  slotHeight: number,
): void {
  const bounds = buildingVisualDefinitions[buildingId]?.previewBounds ?? {
    x: 0,
    y: 0,
    width: sprite.texture.width,
    height: sprite.texture.height,
  };
  const scale = Math.min(slotWidth / bounds.width, slotHeight / bounds.height);
  sprite.anchor.set(0, 0);
  sprite.scale.set(scale);
  sprite.x = slotX + (slotWidth - bounds.width * scale) / 2 - bounds.x * scale;
  sprite.y = slotY + slotHeight - (bounds.y + bounds.height) * scale;
}

function getBuildingDetailMetrics(
  buildingId: BuildingId,
  building: GameState["buildings"][BuildingId],
  level: number,
  maxLevel: number,
  state: GameState,
  translations: TranslationPack,
): BuildingMetric[] {
  const metrics: BuildingMetric[] = [
    {
      iconId: "build",
      label: translations.ui.level,
      value: `${level}/${maxLevel}`,
      fill: uiTheme.accentStrong,
      tooltip: `${translations.ui.level} ${level}/${maxLevel}`,
    },
  ];

  const workerLimit = getBuildingWorkerLimit(state, buildingId);
  if (workerLimit > 0) {
    metrics.push({
      iconId: "people",
      label: translations.ui.workers,
      value: `${building.workers}/${workerLimit}`,
      fill: building.workers > 0 ? uiTheme.accentStrong : uiTheme.textMuted,
      tooltip: `${translations.ui.workers}: ${building.workers}/${workerLimit}`,
    });
  }

  getBuildingCurrentEffectMetrics(buildingId, building, level, state, translations)
    .forEach((metric) => pushUniqueBuildingMetric(metrics, metric));

  return metrics;
}

function pushUniqueBuildingMetric(metrics: BuildingMetric[], metric: BuildingMetric | null): void {
  if (!metric) {
    return;
  }
  const duplicate = metrics.some((existing) =>
    existing.iconId === metric.iconId && existing.value === metric.value,
  );
  if (!duplicate) {
    metrics.push(metric);
  }
}

function getBuildingCurrentEffectMetrics(
  buildingId: BuildingId,
  building: GameState["buildings"][BuildingId],
  level: number,
  state: GameState,
  translations: TranslationPack,
): BuildingMetric[] {
  const definition = buildingById[buildingId];
  const productionMultiplier = getGlobalProductionMultiplier(state);

  if (buildingId === "coalMine") {
    const rate = getCoalMineCoalRate(level, building.workers) * productionMultiplier;
    return [getResourceRateMetric("coal", rate, translations)];
  }

  if (buildingId === "workshop") {
    const materialRate = getWorkshopMaterialRate(level, building.workers) * productionMultiplier;
    const coalRate = -getWorkshopCoalRate(level, building.workers);
    return [
      getResourceRateMetric("material", materialRate, translations),
      getResourceRateMetric("coal", coalRate, translations),
    ];
  }

  const effectMetrics = getCurrentBuildingEffects(buildingId, level, translations)
    .filter((effect) => !isDefinitionResourceRateEffect(effect, definition))
    .map((effect) => ({
      iconId: effect.iconId,
      label: effect.tooltip,
      value: effect.value,
      fill: effect.negative ? uiTheme.negative : uiTheme.accentStrong,
      tooltip: effect.tooltip,
    }));
  const resourceMetrics = getDefinitionResourceRateMetrics(definition, level, productionMultiplier, translations);

  return [...effectMetrics, ...resourceMetrics];
}

function getDefinitionResourceRateMetrics(
  definition: typeof buildingById[BuildingId],
  level: number,
  productionMultiplier: number,
  translations: TranslationPack,
): BuildingMetric[] {
  const metrics: BuildingMetric[] = [];

  for (const [resourceId, amount] of Object.entries(definition.produces ?? {})) {
    if ((amount ?? 0) <= 0) {
      continue;
    }
    const typedResourceId = resourceId as ResourceId;
    const multiplier = typedResourceId === "morale" ? 1 : productionMultiplier;
    metrics.push(getResourceRateMetric(typedResourceId, (amount ?? 0) * level * multiplier, translations));
  }

  for (const [resourceId, amount] of Object.entries(definition.consumes ?? {})) {
    if ((amount ?? 0) <= 0) {
      continue;
    }
    metrics.push(getResourceRateMetric(resourceId as ResourceId, -(amount ?? 0) * level, translations));
  }

  for (const [resourceId, amount] of Object.entries(definition.alwaysConsumes ?? {})) {
    if ((amount ?? 0) <= 0) {
      continue;
    }
    metrics.push(getResourceRateMetric(resourceId as ResourceId, -(amount ?? 0) * level, translations));
  }

  return metrics;
}

function isDefinitionResourceRateEffect(
  effect: EffectLine,
  definition: typeof buildingById[BuildingId],
): boolean {
  if (!effect.value.includes("/h")) {
    return false;
  }

  return Boolean(
    definition.produces?.[effect.iconId as ResourceId] ||
      definition.consumes?.[effect.iconId as ResourceId] ||
      definition.alwaysConsumes?.[effect.iconId as ResourceId],
  );
}

function getResourceRateMetric(
  resourceId: ResourceId,
  ratePerSecond: number,
  translations: TranslationPack,
): BuildingMetric {
  return {
    iconId: resourceId,
    label: translations.resources[resourceId],
    value: getHourlyRateLabel(ratePerSecond),
    fill: getRateColor(ratePerSecond),
    tooltip: `${translations.resources[resourceId]}: ${getHourlyRateLabel(ratePerSecond)}`,
  };
}

function drawMetricCard(
  host: BuildingModalsHost,
  parent: Container,
  metric: BuildingMetric,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const card = new Container();
  card.x = x;
  card.y = y;
  parent.addChild(card);

  drawDetailPanel(card, 0, 0, width, height, 0.34);

  const compact = width < 132;
  const iconX = compact ? 28 : 30;
  const valueX = compact ? 60 : 70;
  const valueFontSize = compact ? uiTextSize.value : uiTextSize.actionValue;

  host.drawIcon(card, metric.iconId, iconX, height / 2, BUILDING_METRIC_ICON_SIZE);
  host.drawText(card, metric.value, valueX, 26, {
    fill: metric.fill ?? uiTheme.text,
    fontSize: valueFontSize,
    fontWeight: "900",
  });

  if (metric.tooltip) {
    host.bindTooltip(card, metric.tooltip);
  }
}

function drawDetailPanel(
  parent: Container,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 0.36,
): Graphics {
  const panel = new Graphics();
  panel.roundRect(x, y, width, height, UI_PANEL_RADIUS)
    .fill({ color: uiTheme.modalContentPanel, alpha })
    .stroke({ color: uiTheme.border, alpha: 0.48, width: 1 });
  parent.addChild(panel);
  return panel;
}

function drawSectionTitle(host: BuildingModalsHost, parent: Container, label: string, x: number, y: number): void {
  host.drawText(parent, label, x, y, { fill: uiTheme.accentStrong, fontSize: uiTextSize.body, fontWeight: "900" });
}

function drawBuildingControlSection(
  host: BuildingModalsHost,
  parent: Container,
  buildingId: BuildingId,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  drawDetailPanel(parent, x, y, width, height);

  if (buildingId === "coalMine" || buildingId === "workshop") {
    drawStaffedControlContent(host, parent, buildingId, state, translations, x, y, width);
    return;
  }

  if (buildingId === "market") {
    drawMarketControlContent(host, parent, state, translations, x, y, width);
    return;
  }

  drawSectionTitle(host, parent, translations.ui.operations ?? "Operations", x + 22, y + 24);
  host.drawText(parent, translations.ui.resourceNoActiveEffects ?? "-", x + 22, y + 66, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.body,
    fontWeight: "800",
    wordWrap: true,
    wordWrapWidth: width - 44,
  });
}

function drawStaffedControlContent(
  host: BuildingModalsHost,
  parent: Container,
  buildingId: BuildingId,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
): void {
  const building = state.buildings[buildingId];
  const workerLimit = getBuildingWorkerLimit(state, buildingId);
  drawSectionTitle(host, parent, translations.ui.workers, x + 22, y + 24);
  drawActionStepper(
    host,
    parent,
    `${building.workers}`,
    x + Math.max(22, width / 2 - 72),
    y + 72,
    { action: "building-workers", building: buildingId, delta: -1 },
    { action: "building-workers", building: buildingId, delta: 1 },
    building.workers <= 0,
    building.workers >= workerLimit || state.survivors.workers <= 0,
    building.workers <= 0 ? `${translations.ui.workers}: 0/${workerLimit}` : undefined,
    building.workers >= workerLimit
      ? `${translations.ui.workers}: ${building.workers}/${workerLimit}`
      : state.survivors.workers <= 0
        ? translations.ui.notEnoughWorkers
        : undefined,
  );
}

function drawMarketControlContent(
  host: BuildingModalsHost,
  parent: Container,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
): void {
  normalizeMarketSelection(host);
  const marketLevel = state.buildings.market.level;
  const availableTrades = getAvailableMarketTrades(state);
  const tradeSlots = getMarketTradeSlots(marketLevel);
  const fromResource = host.getMarketFromResource();
  const toResource = host.getMarketToResource();
  const tradeCapacity = getMarketTradeCapacity(state, fromResource, toResource);
  const maxAmount = Math.max(1, tradeCapacity);
  host.setMarketAmount(Math.max(1, Math.min(host.getMarketAmount(), maxAmount)));
  const amount = host.getMarketAmount();
  const disabled = !canTradeAtMarket(state, fromResource, toResource, amount);
  const disabledTooltip = getMarketTradeDisabledTooltip(host, state, translations, tradeCapacity);

  drawSectionTitle(host, parent, translations.ui.marketExchange ?? "Exchange", x + 22, y + 24);
  host.drawText(parent, `${translations.ui.marketTrades ?? "Trades"}: ${availableTrades}/${tradeSlots}`, x + 22, y + 54, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.caption,
    fontWeight: "800",
  });
  drawMarketResourceButtons(host, parent, translations.ui.marketGive ?? "Give", fromResource, x + 22, y + 86, (resourceId) => {
    host.setMarketFromResource(resourceId);
    if (host.getMarketToResource() === resourceId) {
      host.setMarketToResource(getNextMarketResource(resourceId));
    }
    host.requestRender();
  }, translations);
  drawMarketResourceButtons(host, parent, translations.ui.marketReceive ?? "Receive", toResource, x + 22, y + 126, (resourceId) => {
    host.setMarketToResource(resourceId);
    if (host.getMarketFromResource() === resourceId) {
      host.setMarketFromResource(getNextMarketResource(resourceId));
    }
    host.requestRender();
  }, translations);
  drawMarketAmountStepper(host, parent, x + 22, y + 170, tradeCapacity);
  host.createModalButton(
    parent,
    translations.ui.marketTrade ?? "Trade",
    x + width - 176,
    y + 170,
    154,
    34,
    {
      action: "market-trade",
      marketFromResource: host.getMarketFromResource(),
      marketToResource: host.getMarketToResource(),
      marketAmount: host.getMarketAmount(),
    },
    disabled,
    disabledTooltip,
  );
}

function drawNextLevelSection(
  host: BuildingModalsHost,
  parent: Container,
  buildingId: BuildingId,
  level: number,
  locked: boolean,
  cost: ResourceBag,
  requiredWorkers: number,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  drawDetailPanel(parent, x, y, width, height);
  drawSectionTitle(host, parent, locked ? translations.ui.maxLevelReached : translations.ui.nextLevel, x + 22, y + 24);

  if (locked) {
    host.drawText(parent, translations.ui.maxLevelReached, x + 22, y + 66, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.body,
      fontWeight: "800",
    });
    return;
  }

  let cursorY = y + 68;
  const costWidth = drawCostLine(host, parent, cost, state.resources, translations, x + 22, cursorY, true);
  if (requiredWorkers > 0) {
    drawWorkerRequirement(host, parent, requiredWorkers, state.survivors.workers, translations, x + 22 + costWidth + 12, cursorY, true);
  }

  cursorY += 42;
  drawEffects(host, parent, getNextLevelEffects(buildingId, level, translations), x + 22, cursorY, width - 44);
}

function drawMarketResourceButtons(
  host: BuildingModalsHost,
  parent: Container,
  label: string,
  activeResourceId: MarketResourceId,
  x: number,
  y: number,
  onSelect: (resourceId: MarketResourceId) => void,
  translations: TranslationPack,
): void {
  host.drawText(parent, label, x, y, { fill: uiTheme.textMuted, fontSize: uiTextSize.caption, fontWeight: "900" });
  let offsetX = 74;
  for (const resourceId of marketResourceIds) {
    host.createRectButton(parent, {
      label: translations.resources[resourceId],
      x: x + offsetX,
      y: y - 8,
      width: 66,
      height: 30,
      onTap: () => {
        host.playTabSwitchSound();
        onSelect(resourceId);
      },
      active: resourceId === activeResourceId,
      tone: "secondary",
      fontSize: uiTextSize.caption,
      fontWeight: "900",
    });
    offsetX += 72;
  }
}

function drawMarketAmountStepper(
  host: BuildingModalsHost,
  parent: Container,
  x: number,
  y: number,
  tradeCapacity: number,
): void {
  drawLocalStepper(
    host,
    parent,
    `${host.getMarketAmount()}`,
    x,
    y,
    () => {
      host.setMarketAmount(Math.max(1, host.getMarketAmount() - 10));
      host.requestRender();
    },
    () => {
      host.setMarketAmount(Math.min(Math.max(1, tradeCapacity), host.getMarketAmount() + 10));
      host.requestRender();
    },
    host.getMarketAmount() <= 1,
    tradeCapacity <= 0 || host.getMarketAmount() >= tradeCapacity,
    tradeCapacity > 0 ? uiTheme.accentStrong : uiTheme.negative,
  );
}

function normalizeMarketSelection(host: BuildingModalsHost): void {
  if (!isMarketResourceId(host.getMarketFromResource())) {
    host.setMarketFromResource("material");
  }
  if (!isMarketResourceId(host.getMarketToResource())) {
    host.setMarketToResource("food");
  }
  if (host.getMarketFromResource() === host.getMarketToResource()) {
    host.setMarketToResource(getNextMarketResource(host.getMarketFromResource()));
  }
}

function getNextMarketResource(resourceId: MarketResourceId): MarketResourceId {
  return marketResourceIds.find((candidate) => candidate !== resourceId) ?? "food";
}

function getMarketTradeDisabledTooltip(
  host: BuildingModalsHost,
  state: GameState,
  translations: TranslationPack,
  tradeCapacity: number,
): string | undefined {
  if (state.market.cooldownRemainingSeconds > 0) {
    return `${translations.ui.marketCooldown ?? "Cooldown"}: ${formatScoutingRemaining(state.market.cooldownRemainingSeconds)}`;
  }
  if (getAvailableMarketTrades(state) <= 0) {
    return translations.ui.marketNoTrades ?? "No trade slot available.";
  }
  if (host.getMarketFromResource() === host.getMarketToResource()) {
    return translations.ui.marketSameResource ?? "Choose two different resources.";
  }
  if (tradeCapacity <= 0) {
    return translations.ui.marketNoCapacity ?? "Not enough stock or storage capacity.";
  }
  return undefined;
}

function drawBarracksUnitsSection(
  host: BuildingModalsHost,
  parent: Container,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const contentX = x;
  const contentY = y;
  const gap = 14;
  const rowHeight = Math.max(118, Math.floor((height - gap) / 2));
  unitIds.forEach((unitId, index) => {
    const unitY = contentY + index * (rowHeight + gap);
    drawBarracksUnitCard(host, parent, unitId, translations, contentX, unitY, width, rowHeight);
  });
}

function drawBarracksUnitCard(
  host: BuildingModalsHost,
  parent: Container,
  unitId: UnitId,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const definition = combatUnitDefinitions[unitId];
  drawDetailPanel(parent, x, y, width, height, 0.3);

  const name = translations.roles[unitId] ?? unitId;
  const description = translations.ui[`${unitId}Description`] ?? "";
  host.drawIcon(parent, getUnitIconId(unitId), x + 22, y + 30, 24);
  host.drawText(parent, name, x + 52, y + 16, {
    fill: uiTheme.text,
    fontSize: uiTextSize.emphasis,
    fontWeight: "900",
  });
  host.drawText(parent, description, x + 52, y + 44, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.caption,
    fontWeight: "700",
    wordWrap: true,
    wordWrapWidth: Math.max(260, width - 340),
    lineHeight: 15,
  });

  const statsX = x + Math.max(330, Math.floor(width * 0.48));
  const statGap = 8;
  const statWidth = Math.max(64, Math.floor((width - (statsX - x) - 22 - statGap * 3) / 4));
  const stats = [
    { label: translations.ui.hp ?? "HP", value: `${definition.maxHp}` },
    { label: translations.ui.damage ?? "DMG", value: `${definition.damage}` },
    { label: translations.ui.range ?? "Range", value: `${definition.range}` },
    { label: translations.ui.move ?? "Move", value: `${definition.move}` },
  ];

  stats.forEach((stat, index) => {
    drawMiniStat(host, parent, stat.label, stat.value, statsX + index * (statWidth + statGap), y + 18, statWidth);
  });

  const costY = y + Math.min(height - 34, 82);
  host.drawText(parent, translations.ui.trainingCost ?? "Cost", statsX, costY, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.caption,
    fontWeight: "900",
  });
  drawCostLine(host, parent, getBarracksTrainingCost(unitId), {
    food: Number.POSITIVE_INFINITY,
    water: Number.POSITIVE_INFINITY,
    material: Number.POSITIVE_INFINITY,
    coal: Number.POSITIVE_INFINITY,
    morale: Number.POSITIVE_INFINITY,
  }, translations, statsX + 58, costY - 5, false, Math.max(220, width - (statsX - x) - 80));
  host.drawText(parent, `${translations.ui.trainingTime ?? "Training time"}: ${formatRealTimeRemaining(getBarracksTrainingSeconds(unitId))}`, statsX, costY + 30, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.caption,
    fontWeight: "800",
  });
}

function drawMiniStat(
  host: BuildingModalsHost,
  parent: Container,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
): void {
  drawDetailPanel(parent, x, y, width, 42, 0.28);
  host.drawText(parent, label, x + 8, y + 5, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.caption,
    fontWeight: "800",
  });
  host.drawText(parent, value, x + 8, y + 21, {
    fill: uiTheme.accentStrong,
    fontSize: uiTextSize.caption,
    fontWeight: "900",
  });
}

function drawBarracksTrainingSection(
  host: BuildingModalsHost,
  parent: Container,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  drawDetailPanel(parent, x, y, width, height);

  const selectedUnitId = host.getBarracksTrainingUnitId();
  const maxTrainableTroops = getMaxBarracksTrainingCount(state, selectedUnitId);
  const selectedTroops = Math.max(1, Math.floor(host.getBarracksTroopCount()));
  const maxSelectableTroops = Math.max(1, maxTrainableTroops);
  host.setBarracksTroopCount(Math.min(selectedTroops, maxSelectableTroops));
  const currentSelection = host.getBarracksTroopCount();
  const contentX = x + 22;
  const availableWidth = width - 44;
  const statGap = 10;
  const statWidth = Math.max(92, Math.floor((availableWidth - statGap * unitIds.length) / (unitIds.length + 1)));
  const cost = getBarracksTrainingCostForCount(selectedUnitId, currentSelection);
  const trainDisabled = maxTrainableTroops <= 0 || !canAfford(state.resources, cost);

  drawBarracksUnitSelector(host, parent, selectedUnitId, translations, contentX, y + 16);
  unitIds.forEach((unitId, index) => {
    drawModalStatLine(
      host,
      parent,
      getUnitIconId(unitId),
      translations.roles[unitId] ?? unitId,
      `${state.survivors.units[unitId]}`,
      contentX + (statWidth + statGap) * index,
      y + 58,
      statWidth,
    );
  });
  drawModalStatLine(
    host,
    parent,
    "clock",
    translations.ui.troopTrainingQueue ?? "Training queue",
    `${state.survivors.barracksTrainingQueue.length}`,
    contentX + (statWidth + statGap) * unitIds.length,
    y + 58,
    statWidth,
  );

  const costY = y + 120;
  host.drawText(parent, translations.ui.trainingCost ?? "Cost", contentX, costY, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.caption,
    fontWeight: "900",
  });
  drawCostLine(host, parent, cost, state.resources, translations, contentX + 76, costY - 5, true);
  host.drawText(
    parent,
    `${translations.ui.trainingTime ?? "Training time"}: ${formatRealTimeRemaining(getBarracksTrainingSeconds(selectedUnitId))}`,
    contentX,
    costY + 34,
    {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.caption,
      fontWeight: "800",
    },
  );

  const controlsY = y + 166;
  const stepperWidth = 136;
  const buttonX = contentX + stepperWidth + 24;
  const buttonWidth = Math.max(220, availableWidth - stepperWidth - 24);
  drawLocalStepper(
    host,
    parent,
    `${host.getBarracksTroopCount()}`,
    contentX,
    controlsY,
    () => {
      host.setBarracksTroopCount(Math.max(1, host.getBarracksTroopCount() - 1));
      host.requestRender();
    },
    () => {
      host.setBarracksTroopCount(Math.min(maxSelectableTroops, host.getBarracksTroopCount() + 1));
      host.requestRender();
    },
    host.getBarracksTroopCount() <= 1,
    host.getBarracksTroopCount() >= maxTrainableTroops,
  );

  host.createModalButton(
    parent,
    translations.ui.startTroopTraining ?? translations.ui.workerToTroop,
    buttonX,
    controlsY,
    buttonWidth,
    32,
    { action: "barracks-start-training", unitId: selectedUnitId, troopCount: host.getBarracksTroopCount() },
    trainDisabled,
    trainDisabled ? getBarracksTrainingDisabledTooltip(state, translations, selectedUnitId, currentSelection) : undefined,
  );

  const queueY = controlsY + 50;
  drawBarracksTrainingQueue(
    host,
    parent,
    state,
    translations,
    contentX,
    queueY,
    availableWidth,
    y + height - queueY - 18,
  );
}

function drawBarracksUnitSelector(
  host: BuildingModalsHost,
  parent: Container,
  activeUnitId: UnitId,
  translations: TranslationPack,
  x: number,
  y: number,
): void {
  let offsetX = 0;

  for (const unitId of unitIds) {
    const label = translations.roles[unitId] ?? unitId;
    host.createRectButton(parent, {
      label,
      x: x + offsetX,
      y,
      width: 118,
      height: 30,
      active: unitId === activeUnitId,
      tone: "secondary",
      fontSize: uiTextSize.caption,
      fontWeight: "900",
      onTap: () => {
        host.setBarracksTrainingUnitId(unitId);
        host.setBarracksTroopCount(1);
        host.playTabSwitchSound();
        host.requestRender();
      },
    });
    offsetX += 126;
  }
}

function getMaxBarracksTrainingCount(state: GameState, unitId: UnitId): number {
  const barracks = state.buildings.barracks;
  if (
    barracks.level <= 0 ||
    barracks.upgradingRemaining > 0 ||
    isBuildingInactiveDueToCoal(state, "barracks")
  ) {
    return 0;
  }

  const resourceLimit = Object.entries(getBarracksTrainingCost(unitId)).reduce((limit, [resourceId, amount]) => {
    if ((amount ?? 0) <= 0) {
      return limit;
    }

    const available = state.resources[resourceId as ResourceId] ?? 0;
    return Math.min(limit, Math.floor(available / (amount ?? 1)));
  }, Number.POSITIVE_INFINITY);

  return Math.max(0, Number.isFinite(resourceLimit) ? resourceLimit : 0);
}

function getBarracksTrainingDisabledTooltip(
  state: GameState,
  translations: TranslationPack,
  unitId: UnitId,
  selectedTroops: number,
): string | undefined {
  const barracks = state.buildings.barracks;
  if (barracks.upgradingRemaining > 0 || isBuildingInactiveDueToCoal(state, "barracks")) {
    return translations.ui.trainingUnavailable ?? "Training is unavailable right now.";
  }

  if (!canAfford(state.resources, getBarracksTrainingCostForCount(unitId, selectedTroops))) {
    return translations.ui.notEnoughResources;
  }

  return undefined;
}

function drawBarracksTrainingQueue(
  host: BuildingModalsHost,
  parent: Container,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const queue = state.survivors.barracksTrainingQueue;
  const safeHeight = Math.max(42, height);

  drawSectionTitle(host, parent, translations.ui.troopTrainingQueue ?? "Training queue", x, y);

  if (queue.length === 0) {
    host.drawText(parent, translations.ui.troopTrainingQueueEmpty ?? "No troops in training.", x, y + 36, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.body,
      fontWeight: "800",
    });
    return;
  }

  const rowGap = 8;
  const rowHeight = 38;
  const maxRows = Math.max(1, Math.floor((safeHeight - 34) / (rowHeight + rowGap)));
  const visibleJobs = queue.slice(0, maxRows);

  visibleJobs.forEach((job, index) => {
    const rowY = y + 34 + index * (rowHeight + rowGap);
    drawDetailPanel(parent, x, rowY, width, rowHeight, 0.28);

    const isActive = index === 0;
    const label = isActive
      ? `${translations.ui.trainingActive ?? "Training"}: ${translations.roles[job.unitId] ?? job.unitId}`
      : `${translations.ui.trainingQueued ?? "Queued"}: ${translations.roles[job.unitId] ?? job.unitId}`;
    host.drawIcon(parent, isActive ? getUnitIconId(job.unitId) : "clock", x + 17, rowY + rowHeight / 2, 16);
    host.drawText(parent, label, x + 38, rowY + 9, {
      fill: isActive ? uiTheme.accentStrong : uiTheme.textMuted,
      fontSize: uiTextSize.caption,
      fontWeight: "900",
    });
    host.drawText(parent, formatRealTimeRemaining(job.remainingSeconds), x + width - 82, rowY + 9, {
      fill: uiTheme.text,
      fontSize: uiTextSize.caption,
      fontWeight: "900",
    });

    const progress = isActive
      ? 1 - Math.max(0, Math.min(1, job.remainingSeconds / Math.max(1, job.durationSeconds)))
      : 0;
    const bar = new Graphics();
    bar.rect(x + 110, rowY + 16, Math.max(20, width - 202), 6)
      .fill({ color: uiTheme.surfaceSunken, alpha: 0.7 });
    bar.rect(x + 110, rowY + 16, Math.max(0, width - 202) * progress, 6)
      .fill({ color: uiTheme.accentStrong, alpha: 0.9 });
    parent.addChild(bar);
  });

  if (queue.length > visibleJobs.length) {
    host.drawText(
      parent,
      formatTemplate(translations.ui.trainingQueueMore ?? "+{count} more", { count: queue.length - visibleJobs.length }),
      x,
      y + 34 + visibleJobs.length * (rowHeight + rowGap),
      {
        fill: uiTheme.textMuted,
        fontSize: uiTextSize.caption,
        fontWeight: "800",
      },
    );
  }
}

function drawModalStatLine(
  host: BuildingModalsHost,
  parent: Container,
  iconId: string,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  valueFill = uiTheme.text,
): void {
  host.drawIcon(parent, iconId, x + 9, y + 16, 16);
  host.drawText(parent, label, x + 28, y + 4, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.caption,
    fontWeight: "800",
    wordWrap: true,
    wordWrapWidth: width - 32,
  });
  host.drawText(parent, value, x + 28, y + 24, {
    fill: valueFill,
    fontSize: uiTextSize.value,
    fontWeight: "900",
  });
}

function drawEffects(host: BuildingModalsHost, parent: Container, effects: EffectLine[], x: number, y: number, maxWidth: number): number {
  let offsetX = 0;
  let offsetY = 0;
  let maxOffsetX = 0;
  const visibleEffects = effects.slice(0, 4);
  const orderedEffects = [
    ...visibleEffects.filter((effect) => !effect.negative),
    ...visibleEffects.filter((effect) => effect.negative),
  ];
  const hasPositive = visibleEffects.some((effect) => !effect.negative);
  const hasNegative = visibleEffects.some((effect) => effect.negative);
  let separatorDrawn = false;

  for (const effect of orderedEffects) {
    if (hasPositive && hasNegative && effect.negative && !separatorDrawn) {
      if (offsetX > 0 && offsetX + 14 > maxWidth) {
        offsetX = 0;
        offsetY += BUILDING_INFO_TOKEN_HEIGHT;
      }
      drawEffectSeparator(parent, x + offsetX + 4, y + offsetY + 4);
      offsetX += 14;
      separatorDrawn = true;
    }

    const token = drawInfoToken(host, parent, {
      iconId: effect.iconId,
      text: effect.value,
      tooltip: effect.tooltip,
      missing: effect.negative,
      x: x + offsetX,
      y: y + offsetY,
    });

    if (offsetX > 0 && offsetX + token.width > maxWidth) {
      offsetX = 0;
      offsetY += BUILDING_INFO_TOKEN_HEIGHT;
      token.x = x;
      token.y = y + offsetY;
    }

    offsetX += token.width + 8;
    maxOffsetX = Math.max(maxOffsetX, offsetX);
  }
  return maxOffsetX;
}

function drawEffectSeparator(parent: Container, x: number, y: number): void {
  const separator = new Graphics();
  separator.rect(x, y, 1, 18).fill({ color: uiTheme.borderStrong, alpha: 0.5 });
  parent.addChild(separator);
}

function drawCostLine(
  host: BuildingModalsHost,
  parent: Container,
  bag: ResourceBag,
  availableResources: GameState["resources"],
  translations: TranslationPack,
  x: number,
  y: number,
  showAvailable = false,
  maxWidth = Number.POSITIVE_INFINITY,
): number {
  let offset = 0;
  let offsetY = 0;
  const parts = showAvailable
    ? getAvailableCostLineParts(bag, availableResources, translations)
    : getCostLineParts(bag, availableResources, translations);
  for (const part of parts) {
    const item = drawInfoToken(host, parent, {
      iconId: part.iconId,
      text: part.text,
      tooltip: part.tooltip,
      missing: part.missing,
      x: x + offset,
      y: y + offsetY,
    });
    if (offset > 0 && offset + item.width > maxWidth) {
      offset = 0;
      offsetY += BUILDING_INFO_TOKEN_HEIGHT;
      item.x = x;
      item.y = y + offsetY;
    }
    offset += item.width + 8;
  }
  return offset;
}

function getAvailableCostLineParts(
  bag: ResourceBag,
  availableResources: GameState["resources"],
  translations: TranslationPack,
): ReturnType<typeof getCostLineParts> {
  return Object.entries(bag)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([resourceId, amount]) => {
      const typedResourceId = resourceId as ResourceId;
      const required = Math.ceil(amount ?? 0);
      const available = Math.floor(availableResources[typedResourceId] ?? 0);
      return {
        text: `${available}/${required}`,
        iconId: typedResourceId,
        missing: available < required,
        tooltip: `${translations.resources[typedResourceId]}: ${translations.resourceDescriptions[typedResourceId]} (${available}/${required})`,
      };
    });
}

function drawWorkerRequirement(
  host: BuildingModalsHost,
  parent: Container,
  required: number,
  available: number,
  translations: TranslationPack,
  x: number,
  y: number,
  showAvailable = false,
): number {
  const missing = available < required;
  const availableWorkers = Math.floor(available);
  const token = drawInfoToken(host, parent, {
    iconId: "people",
    text: showAvailable ? `${availableWorkers}/${required}` : `${required}`,
    tooltip: `${translations.ui.constructionWorkers}: ${availableWorkers}/${required}`,
    missing,
    x,
    y,
  });
  return token.width;
}

function getMainBuildingRequirementTooltip(translations: TranslationPack, requiredLevel: number): string {
  return formatTemplate(translations.ui.requiresMainBuildingLevel ?? "Requires main building level {level}.", { level: requiredLevel });
}

function getUpgradeActionDisabledTooltip(
  translations: TranslationPack,
  locked: boolean,
  upgrading: boolean,
  upgradingRemaining: number,
  cost: ResourceBag,
  resources: GameState["resources"],
  requiredWorkers: number,
  availableWorkers: number,
  queueAvailable: boolean,
  mainBuildingUnlocked: boolean,
  requiredMainBuildingLevel: number,
): string | undefined {
  const blockerTooltip = getBuildActionDisabledTooltip(
    translations,
    cost,
    resources,
    requiredWorkers,
    availableWorkers,
    queueAvailable,
    mainBuildingUnlocked,
    requiredMainBuildingLevel,
  );
  if (blockerTooltip) {
    return blockerTooltip;
  }
  if (locked) {
    return translations.ui.maxLevelReached;
  }
  if (upgrading) {
    return `${translations.ui.upgrade}: ${Math.ceil(upgradingRemaining)}s`;
  }
  return undefined;
}

function getBuildActionDisabledTooltip(
  translations: TranslationPack,
  cost: ResourceBag,
  resources: GameState["resources"],
  requiredWorkers: number,
  availableWorkers: number,
  queueAvailable: boolean,
  mainBuildingUnlocked: boolean,
  requiredMainBuildingLevel: number,
): string {
  const reasons: string[] = [];
  if (!mainBuildingUnlocked) {
    reasons.push(getMainBuildingRequirementTooltip(translations, requiredMainBuildingLevel));
  }
  if (!queueAvailable) {
    reasons.push(translations.ui.queueFull);
  }
  if (availableWorkers < requiredWorkers) {
    reasons.push(translations.ui.notEnoughWorkers);
  }
  const missingResourceLabels = getMissingResourceLabels(cost, resources, translations);
  if (missingResourceLabels.length > 0) {
    reasons.push(`${translations.ui.notEnoughResources ?? "Not enough resources"}: ${missingResourceLabels.join(", ")}`);
  }
  return reasons.join("\n");
}

function getMissingResourceLabels(
  bag: ResourceBag,
  availableResources: GameState["resources"],
  translations: TranslationPack,
): string[] {
  const labels: string[] = [];
  for (const [resourceId, amount] of Object.entries(bag)) {
    if ((amount ?? 0) <= 0) {
      continue;
    }
    const typedResourceId = resourceId as ResourceId;
    const required = Math.ceil(amount ?? 0);
    const available = availableResources[typedResourceId] ?? 0;
    if (available < required) {
      labels.push(translations.resources[typedResourceId]);
    }
  }
  return labels;
}

function drawInfoToken(
  host: BuildingModalsHost,
  parent: Container,
  options: {
    iconId: string;
    text: string;
    tooltip: string;
    missing?: boolean;
    x: number;
    y: number;
  },
): Container {
  const token = new Container();
  token.x = options.x;
  token.y = options.y;
  parent.addChild(token);

  host.drawIcon(token, options.iconId, 11, 11, BUILDING_INFO_TOKEN_ICON_SIZE);
  const label = host.drawText(token, options.text, 30, 2, {
    fill: options.missing ? uiTheme.negative : uiTheme.accentStrong,
    fontSize: uiTextSize.bodyLarge,
    fontWeight: "900",
  });
  host.bindTooltip(token, options.tooltip);

  token.hitArea = new Rectangle(0, -2, label.width + 38, BUILDING_INFO_TOKEN_HEIGHT);
  return token;
}
