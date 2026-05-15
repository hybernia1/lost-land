import { Container, Graphics, Rectangle, Sprite } from "pixi.js";
import { buildingById } from "../../../data/buildings";
import { buildingVisualDefinitions } from "../../../data/buildingVisuals";
import { GAME_HOUR_REAL_SECONDS } from "../../../game/time";
import type { BuildingCategory, BuildingId, GameState, MarketResourceId, ResourceBag, ResourceId } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getAcademyProductionBonus } from "../../../systems/academy";
import {
  getBuildingBuildSeconds,
  getBuildingWorkerLimit,
  getCoalMineCoalRate,
  getConstructionWorkerRequirement,
  getGlobalProductionMultiplier,
  getMainBuildingLevelRequirement,
  getMainBuildingProductionBonus,
  getUpgradeCost,
  getWorkshopCoalRate,
  getWorkshopMaterialRate,
  hasAvailableBuildingSlot,
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
import { getBarracksTrainingRatePerGameHour } from "../../../systems/survivors";
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
import { formatPercentBonus, formatRate, formatScoutingRemaining, formatTemplate, getHourlyRateLabel, getRateColor } from "../helpers/formatters";
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

  getMarketFromResource: () => MarketResourceId;
  setMarketFromResource: (value: MarketResourceId) => void;
  getMarketToResource: () => MarketResourceId;
  setMarketToResource: (value: MarketResourceId) => void;
  getMarketAmount: () => number;
  setMarketAmount: (value: number) => void;
  getBarracksTroopCount: () => number;
  setBarracksTroopCount: (value: number) => void;
};

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
  if (category === "defense") {
    return translations.ui.buildingCategoryDefense;
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
  const titleWidth = modalWidth - titleX - sideMargin;
  const bodyWidth = modalWidth - sideMargin * 2;
  const metricGap = 8;
  const metrics = getBuildingDetailMetrics(buildingId, building, level, maxLevel, state, translations);
  const metricCount = Math.max(1, Math.min(4, metrics.length));
  const metricWidth = (bodyWidth - metricGap * (metricCount - 1)) / metricCount;
  const metricY = contentTop + 120;
  const footerHeight = 54;
  const footerY = modalHeight - sideMargin - footerHeight;
  const sectionY = metricY + 98;
  const sectionHeight = Math.max(176, footerY - sectionY - 22);
  const columnGap = 14;
  const hasControls = hasBuildingControlSection(buildingId);
  const controlWidth = hasControls ? Math.max(360, Math.floor((bodyWidth - columnGap) * 0.56)) : 0;
  const nextLevelWidth = hasControls ? bodyWidth - controlWidth - columnGap : bodyWidth;
  const controlX = sideMargin;
  const nextLevelX = hasControls ? controlX + controlWidth + columnGap : sideMargin;

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

  metrics.slice(0, 4).forEach((metric, index) => {
    drawMetricCard(host, content, metric, sideMargin + index * (metricWidth + metricGap), metricY, metricWidth, 74);
  });

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

function hasBuildingControlSection(buildingId: BuildingId): boolean {
  return buildingId === "coalMine" || buildingId === "workshop" || buildingId === "market" || buildingId === "barracks";
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
  const definition = buildingById[buildingId];
  const defense = (definition.defense ?? 0) * level;
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

  if (defense > 0) {
    metrics.push({
      iconId: "shield",
      label: translations.ui.defense,
      value: `${Math.round(defense)}`,
      fill: uiTheme.text,
      tooltip: `${translations.ui.defense}: ${Math.round(defense)}`,
    });
  }

  pushUniqueBuildingMetric(metrics, getBuildingProductionMetric(buildingId, building, level, state, translations));
  pushUniqueBuildingMetric(metrics, getBuildingCoalMetric(buildingId, building, level, state, translations));

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

function getBuildingProductionMetric(
  buildingId: BuildingId,
  building: GameState["buildings"][BuildingId],
  level: number,
  state: GameState,
  translations: TranslationPack,
): BuildingMetric | null {
  const definition = buildingById[buildingId];
  const productionMultiplier = getGlobalProductionMultiplier(state);

  if (buildingId === "mainBuilding") {
    const bonus = getMainBuildingProductionBonus(level);
    return bonus > 0 ? {
      iconId: "build",
      label: translations.ui.production,
      value: formatPercentBonus(bonus),
      fill: uiTheme.accentStrong,
      tooltip: `${translations.ui.production}: ${formatPercentBonus(bonus)}`,
    } : null;
  }
  if (buildingId === "coalMine") {
    const rate = getCoalMineCoalRate(level, building.workers) * productionMultiplier;
    return {
      iconId: "coal",
      label: translations.ui.production,
      value: getHourlyRateLabel(rate),
      fill: getRateColor(rate),
      tooltip: `${translations.resources.coal}: ${getHourlyRateLabel(rate)}`,
    };
  }
  if (buildingId === "workshop") {
    const rate = getWorkshopMaterialRate(level, building.workers) * productionMultiplier;
    return {
      iconId: "material",
      label: translations.ui.production,
      value: getHourlyRateLabel(rate),
      fill: getRateColor(rate),
      tooltip: `${translations.resources.material}: ${getHourlyRateLabel(rate)}`,
    };
  }
  if (buildingId === "market") {
    const tradeLimit = getMarketTradeLimit(level);
    return {
      iconId: "material",
      label: translations.ui.marketTradeLimit ?? translations.ui.stock,
      value: `${tradeLimit}`,
      fill: tradeLimit > 0 ? uiTheme.accentStrong : uiTheme.textMuted,
      tooltip: `${translations.ui.marketTradeLimit ?? "Trade limit"}: ${tradeLimit}`,
    };
  }
  if (buildingId === "barracks") {
    const trainingRate = getBarracksTrainingRatePerGameHour(level);
    return {
      iconId: "scout",
      label: translations.ui.troopTraining ?? translations.roles.troops,
      value: `+${formatRate(trainingRate)}/h`,
      fill: getRateColor(trainingRate / GAME_HOUR_REAL_SECONDS),
      tooltip: `${translations.ui.troopTraining ?? "Troop training"}: +${formatRate(trainingRate)}/h`,
    };
  }
  if (buildingId === "academy") {
    const productionBonus = getAcademyProductionBonus(level);
    return productionBonus > 0 ? {
      iconId: "build",
      label: translations.ui.production,
      value: formatPercentBonus(productionBonus),
      fill: uiTheme.accentStrong,
      tooltip: `${translations.ui.production}: ${formatPercentBonus(productionBonus)}`,
    } : null;
  }

  const produced = Object.entries(definition.produces ?? {}).find(([, amount]) => (amount ?? 0) > 0);
  if (produced) {
    const [resourceId, amount] = produced;
    const typedResourceId = resourceId as ResourceId;
    const rate = (amount ?? 0) * level * (typedResourceId === "morale" ? 1 : productionMultiplier);
    return {
      iconId: typedResourceId,
      label: translations.ui.production,
      value: getHourlyRateLabel(rate),
      fill: getRateColor(rate),
      tooltip: `${translations.resources[typedResourceId]}: ${getHourlyRateLabel(rate)}`,
    };
  }

  if (definition.housing) {
    const capacity = definition.housing * level;
    return {
      iconId: "home",
      label: translations.ui.housingCapacity,
      value: `+${capacity}`,
      fill: capacity > 0 ? uiTheme.accentStrong : uiTheme.textMuted,
      tooltip: `${translations.ui.housingCapacity}: ${capacity}`,
    };
  }

  const storage = Object.entries(definition.storageBonus ?? {}).find(([, amount]) => (amount ?? 0) > 0);
  if (storage) {
    const [resourceId, amount] = storage;
    const typedResourceId = resourceId as ResourceId;
    const capacity = Math.round((amount ?? 0) * level);
    return {
      iconId: typedResourceId,
      label: translations.ui.stock,
      value: `+${capacity}`,
      fill: capacity > 0 ? uiTheme.accentStrong : uiTheme.textMuted,
      tooltip: `${translations.resources[typedResourceId]} ${translations.ui.stock}: +${capacity}`,
    };
  }

  return null;
}

function getBuildingCoalMetric(
  buildingId: BuildingId,
  building: GameState["buildings"][BuildingId],
  level: number,
  state: GameState,
  translations: TranslationPack,
): BuildingMetric | null {
  const definition = buildingById[buildingId];
  const consumption = ((definition.consumes?.coal ?? 0) + (definition.alwaysConsumes?.coal ?? 0)) * level;
  const production = buildingId === "coalMine"
    ? getCoalMineCoalRate(level, building.workers) * getGlobalProductionMultiplier(state)
    : 0;
  const staffedConsumption = buildingId === "workshop" ? getWorkshopCoalRate(level, building.workers) : consumption;
  const netRate = production - staffedConsumption;

  if (netRate === 0 && production === 0 && staffedConsumption === 0) {
    return null;
  }

  return {
    iconId: "coal",
    label: translations.resources.coal,
    value: getHourlyRateLabel(netRate),
    fill: getRateColor(netRate),
    tooltip: `${translations.resources.coal}: ${getHourlyRateLabel(netRate)}`,
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

  host.drawIcon(card, metric.iconId, 30, height / 2, BUILDING_METRIC_ICON_SIZE);
  host.drawText(card, metric.value, 70, 26, {
    fill: metric.fill ?? uiTheme.text,
    fontSize: uiTextSize.actionValue,
    fontWeight: "900",
    wordWrap: true,
    wordWrapWidth: width - 82,
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

  if (buildingId === "barracks") {
    drawSectionTitle(host, parent, translations.ui.troopTraining ?? translations.roles.troops, x + 22, y + 24);
    drawBarracksControlsContent(host, parent, state, translations, x, y + 56, width);
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

function drawBarracksControlsContent(
  host: BuildingModalsHost,
  parent: Container,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
): void {
  const selectedTroops = Math.max(1, Math.floor(host.getBarracksTroopCount()));
  const maxSelectableTroops = Math.max(1, Math.max(state.survivors.workers, state.survivors.troops));
  host.setBarracksTroopCount(Math.min(selectedTroops, maxSelectableTroops));
  const contentX = x + 22;
  const availableWidth = width - 44;
  const statWidth = Math.max(118, Math.floor((availableWidth - 14) / 2));

  drawModalStatLine(host, parent, "people", translations.ui.availableWorkers, `${state.survivors.workers}`, contentX, y, statWidth);
  drawModalStatLine(host, parent, "scout", translations.ui.availableTroops, `${state.survivors.troops}`, contentX + statWidth + 14, y, statWidth);
  drawLocalStepper(
    host,
    parent,
    `${host.getBarracksTroopCount()}`,
    contentX + Math.max(0, Math.floor((availableWidth - 124) / 2)),
    y + 62,
    () => {
      host.setBarracksTroopCount(Math.max(1, host.getBarracksTroopCount() - 1));
      host.requestRender();
    },
    () => {
      host.setBarracksTroopCount(Math.min(maxSelectableTroops, host.getBarracksTroopCount() + 1));
      host.requestRender();
    },
    host.getBarracksTroopCount() <= 1,
    host.getBarracksTroopCount() >= maxSelectableTroops,
  );

  const buttonY = y + 128;
  const buttonGap = 12;
  const buttonWidth = Math.floor((availableWidth - buttonGap) / 2);
  host.createModalButton(
    parent,
    translations.ui.workerToTroop,
    contentX,
    buttonY,
    buttonWidth,
    32,
    { action: "barracks-worker-to-troop", troopCount: host.getBarracksTroopCount() },
    state.survivors.workers < host.getBarracksTroopCount(),
    state.survivors.workers < host.getBarracksTroopCount() ? translations.ui.notEnoughWorkers : undefined,
  );
  host.createModalButton(
    parent,
    translations.ui.troopToWorker,
    contentX + buttonWidth + buttonGap,
    buttonY,
    buttonWidth,
    32,
    { action: "barracks-troop-to-worker", troopCount: host.getBarracksTroopCount() },
    state.survivors.troops < host.getBarracksTroopCount(),
    state.survivors.troops < host.getBarracksTroopCount() ? translations.ui.notEnoughTroops : undefined,
  );
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
  for (const effect of effects.slice(0, 4)) {
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
