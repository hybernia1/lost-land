import { Container, Sprite } from "pixi.js";
import { buildingById } from "../../../data/buildings";
import { combatUnitDefinitions, enemyUnitIds } from "../../../data/combatUnits";
import { combatUnitNpcKindById } from "../../../data/combatUnitVisuals";
import { mapNpcDefinitions, type MapNpcKindId } from "../../../data/mapNpcs";
import type { BuildingId, EnemyUnitId, GameState, UnitCounts, UnitId } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getAvailableBuildingsForPlot } from "../../../systems/buildings";
import { getResourceSiteDifficultyRating, getTravelTilesToSite } from "../../../systems/resourceSites";
import { getUnitCount, unitIds } from "../../../systems/survivors";
import type {
  DrawCenteredTextFn,
  DrawIconFn,
  DrawOverlayHeaderFn,
  DrawPanelFn,
  DrawTextFn,
  PixiActionDetail,
  RectButtonOptions,
  TabItem,
  TabOptions,
} from "../core/types";
import { uiTextSize, uiTheme } from "../core/constants";
import { formatScoutingRemaining, formatTemplate } from "../helpers/formatters";
import { getUnitIconId } from "../helpers/unitIcons";
import type { MapNpcTextureSet } from "../../villageAssets";
import { drawLocalStepper } from "./modalControls";
import { createModalPanel, drawModalContentPlane, modalLayout, resolveModalFrame } from "./modalLayout";

type ResourceSiteTab = "troops" | "enemy";

type VillageModalsHost = {
  hudLayer: Container;
  drawModalBackdrop: (
    overlay: Container,
    width: number,
    height: number,
    closeAction?: PixiActionDetail,
    blockClose?: boolean,
  ) => void;
  drawPanel: DrawPanelFn;
  drawOverlayHeader: DrawOverlayHeaderFn;
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
  bindTooltip: (target: Container, text: string) => void;
  drawIcon: DrawIconFn;
  drawText: DrawTextFn;
  drawCenteredText: DrawCenteredTextFn;
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
  createRectButton: (parent: Container, options: RectButtonOptions) => Container;
  drawTabs: <T extends string>(parent: Container, tabs: Array<TabItem<T>>, options: TabOptions<T>) => void;
  getActiveResourceSiteTab: () => ResourceSiteTab;
  setActiveResourceSiteTab: (value: ResourceSiteTab) => void;
  getMapNpcTextures: (kindId: MapNpcKindId) => MapNpcTextureSet | null;
  drawBuildChoices: (
    parent: Container,
    plotId: string,
    buildableBuildings: BuildingId[],
    state: GameState,
    translations: TranslationPack,
    modalWidth: number,
    modalHeight: number,
  ) => void;
  drawBuildingDetail: (
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
  ) => void;
  getResourceSiteUnitCounts: (siteId: string, availableUnits: UnitCounts) => UnitCounts;
  setResourceSiteUnitCount: (siteId: string, unitId: UnitId, nextValue: number, availableUnits: UnitCounts) => void;
};

export function drawVillageModal(
  host: VillageModalsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  width: number,
  height: number,
  modalPlotId: string | null,
): void {
  if (!modalPlotId || !translations) {
    return;
  }

  const selectedPlot = state.village.plots.find((plot) => plot.id === modalPlotId);
  const selectedResourceSite = state.resourceSites.find((site) => site.id === modalPlotId);

  if (!selectedPlot && !selectedResourceSite) {
    return;
  }

  const overlay = new Container();
  host.hudLayer.addChild(overlay);
  host.drawModalBackdrop(overlay, width, height, { action: "close-village-modal" });

  const isResourceSiteModal = Boolean(selectedResourceSite);
  const isBuildChoice = selectedPlot?.buildingId === null;
  const preferredHeight = isResourceSiteModal
    ? 560
    : isBuildChoice
      ? 690
      : 650;
  const frame = resolveModalFrame(width, height, {
    maxWidth: isResourceSiteModal ? 820 : isBuildChoice ? 900 : 980,
    preferredHeight,
    maxHeight: preferredHeight,
    marginX: isBuildChoice ? modalLayout.buildViewportMargin : modalLayout.tightViewportMargin,
    marginY: isBuildChoice ? modalLayout.buildViewportMargin : modalLayout.tightViewportMargin,
    topMin: 0,
  });
  const panel = createModalPanel(overlay, host.drawPanel, frame);
  const modalWidth = frame.width;
  const modalHeight = frame.height;
  if (isResourceSiteModal || isBuildChoice) {
    drawModalContentPlane(panel, modalWidth, modalHeight, 86, 0.86, !isBuildChoice);
  }

  if (isResourceSiteModal && selectedResourceSite) {
    const statusLabel = getResourceSiteStatusLabel(selectedResourceSite, translations);
    drawModalHeader(
      host,
      panel,
      translations.ui.resourceSiteTitle ?? "Settlement",
      modalWidth,
      translations,
      statusLabel,
      "home",
    );
    drawResourceSiteModal(
      host,
      panel,
      selectedResourceSite,
      state,
      translations,
      modalWidth,
      modalHeight,
    );
    return;
  }

  if (!selectedPlot) {
    return;
  }

  if (selectedPlot.buildingId === null) {
    const title = translations.ui.availableBuilds;
    drawModalHeader(host, panel, title, modalWidth, translations);
    host.drawBuildChoices(
      panel,
      selectedPlot.id,
      getAvailableBuildingsForPlot(state, selectedPlot.id),
      state,
      translations,
      modalWidth,
      modalHeight,
    );
    return;
  }

  const buildingId = selectedPlot.buildingId;
  const building = state.buildings[buildingId];
  const definition = buildingById[buildingId];
  host.drawBuildingDetail(
    panel,
    selectedPlot.id,
    buildingId,
    building.level,
    building.upgradingRemaining,
    definition.maxLevel,
    state,
    translations,
    modalWidth,
    modalHeight,
  );
  drawModalClose(host, panel, modalWidth, translations);
}

function drawModalHeader(
  host: VillageModalsHost,
  parent: Container,
  title: string,
  modalWidth: number,
  translations: TranslationPack,
  subtitle?: string,
  iconId = "build",
): void {
  host.drawOverlayHeader(parent, modalWidth, translations, {
    iconId,
    title,
    subtitle,
    closeAction: { action: "close-village-modal" },
  });
}

function drawModalClose(
  host: VillageModalsHost,
  parent: Container,
  modalWidth: number,
  translations: TranslationPack,
): void {
  host.createIconButton(
    parent,
    "close",
    modalWidth - 58,
    18,
    38,
    38,
    { action: "close-village-modal" },
    translations.ui.close,
  );
}

function drawResourceSiteModal(
  host: VillageModalsHost,
  parent: Container,
  siteState: GameState["resourceSites"][number],
  state: GameState,
  translations: TranslationPack,
  modalWidth: number,
  modalHeight: number,
): void {
  const travelHours = getTravelTilesToSite(siteState.id);
  const statusLabel = getResourceSiteStatusLabel(siteState, translations);
  const contentX = 34;
  const contentY = 112;
  const contentWidth = modalWidth - 68;
  const cardGap = 10;
  const metricCardWidth = (contentWidth - cardGap * 3) / 4;
  const metricCardHeight = 78;
  const statusColor = siteState.looted ? uiTheme.textMuted : siteState.assault ? uiTheme.warning : uiTheme.negative;
  const difficultyRating = getResourceSiteDifficultyRating(siteState);
  const defenderCount = enemyUnitIds.reduce((total, unitId) => total + Math.max(0, Math.floor(siteState.defenderArmy[unitId] ?? 0)), 0);
  const defenderSummary = enemyUnitIds
    .filter((unitId) => (siteState.defenderArmy[unitId] ?? 0) > 0)
    .map((unitId) => `${translations.roles[unitId] ?? unitId} x${siteState.defenderArmy[unitId]}`)
    .join(", ");
  const defenderLine = formatTemplate(
    translations.ui.resourceSiteDefenders ?? "Defenders: {units}",
    { units: defenderSummary || "0" },
  );

  drawResourceSiteDifficultyCard(
    host,
    parent,
    difficultyRating,
    contentX,
    contentY,
    metricCardWidth,
    metricCardHeight,
    siteState.looted ? uiTheme.textMuted : uiTheme.negative,
    `${translations.ui.resourceSiteDifficultyTooltip ?? "Estimated assault difficulty based on defenders."}\n${defenderLine}`,
  );
  drawResourceSiteMetricCard(
    host,
    parent,
    "shield",
    translations.ui.resourceSiteStatus ?? "Status",
    statusLabel,
    contentX + (metricCardWidth + cardGap),
    contentY,
    metricCardWidth,
    metricCardHeight,
    statusColor,
    `${translations.ui.resourceSiteStatus ?? "Status"}: ${statusLabel}`,
  );
  drawResourceSiteMetricCard(
    host,
    parent,
    "clock",
    translations.ui.resourceSiteTravelTime ?? "Travel time",
    `${travelHours}h`,
    contentX + (metricCardWidth + cardGap) * 2,
    contentY,
    metricCardWidth,
    metricCardHeight,
    uiTheme.text,
    `${translations.ui.resourceSiteTravelTime ?? "Travel time"}: ${travelHours}h`,
  );
  drawResourceSiteMetricCard(
    host,
    parent,
    siteState.looted ? "done" : "troop",
    siteState.looted
      ? translations.ui.resourceSiteStatusLooted ?? "Looted"
      : translations.ui.resourceSiteDefenderStrength ?? "Defenders",
    siteState.looted ? "0" : `${defenderCount}`,
    contentX + (metricCardWidth + cardGap) * 3,
    contentY,
    metricCardWidth,
    metricCardHeight,
    siteState.looted ? uiTheme.textMuted : uiTheme.accentStrong,
    siteState.looted ? translations.ui.resourceSiteLootedTooltip ?? "The settlement has already been looted." : defenderLine,
  );

  const tabsY = contentY + metricCardHeight + 20;
  const activeTab = host.getActiveResourceSiteTab();
  const tabs: Array<TabItem<ResourceSiteTab>> = [
    {
      id: "troops",
      label: translations.ui.resourceSiteTroopsTab ?? translations.ui.resourceSiteSendTroops ?? "Troops",
    },
    {
      id: "enemy",
      label: translations.ui.resourceSiteEnemyTab ?? "Enemy",
    },
  ];
  host.drawTabs(parent, tabs, {
    activeId: activeTab,
    x: contentX,
    y: tabsY,
    height: 36,
    gap: 8,
    minWidth: 138,
    maxTabWidth: 180,
    maxWidth: contentWidth,
    onSelect: (tab) => {
      host.setActiveResourceSiteTab(tab);
    },
  });

  const sectionY = tabsY + 48;
  const sectionHeight = Math.max(1, modalHeight - sectionY - 36);

  if (activeTab === "enemy") {
    drawResourceSiteEnemyTab(
      host,
      parent,
      siteState,
      translations,
      contentX,
      sectionY,
      contentWidth,
      sectionHeight,
    );
    return;
  }

  if (siteState.assault) {
    host.drawPanel(parent, contentX, sectionY, contentWidth, sectionHeight, 0.55);
    host.drawIcon(parent, "expedition", contentX + 34, sectionY + 48, 26);
    const runningLabel = host.drawText(parent, translations.ui.resourceSiteAssaultRunning ?? "Assault team is marching to the settlement.", contentX + 68, sectionY + 28, {
      fill: uiTheme.accentStrong,
      fontSize: uiTextSize.control,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: contentWidth - 108,
    });
    host.drawText(
      parent,
      `${translations.ui.returnsIn ?? "returns in"} ${formatScoutingRemaining(siteState.assault.remainingSeconds)}`,
      contentX + 68,
      runningLabel.y + runningLabel.height + 14,
      {
        fill: uiTheme.text,
        fontSize: uiTextSize.sectionTitle,
        fontWeight: "900",
      },
    );
    return;
  }

  if (!siteState.looted) {
    const availableUnits = state.survivors.units;
    const selectedUnits = host.getResourceSiteUnitCounts(siteState.id, availableUnits);
    const selectedTroops = getUnitCount(selectedUnits);
    const canSend = selectedTroops > 0;
    const disabledTooltip = getResourceSiteAssaultDisabledTooltip(
      translations,
      canSend,
    );
    host.drawPanel(parent, contentX, sectionY, contentWidth, sectionHeight, 0.56);
    const actionX = contentX + 28;
    const actionWidth = contentWidth - 56;
    host.drawText(parent, translations.ui.resourceSiteSendTroops ?? "Send troops", actionX, sectionY + 22, {
      fill: uiTheme.accentStrong,
      fontSize: uiTextSize.emphasis,
      fontWeight: "900",
    });
    unitIds.forEach((unitId, index) => {
      const rowY = sectionY + 62 + index * 50;
      drawResourceSiteUnitSelector(
        host,
        parent,
        siteState.id,
        unitId,
        selectedUnits,
        availableUnits,
        translations,
        actionX,
        rowY,
        actionWidth,
      );
    });
    host.createModalButton(
      parent,
      translations.ui.resourceSiteSendAssault ?? "Raid settlement",
      actionX,
      sectionY + 76 + unitIds.length * 50,
      Math.min(320, actionWidth),
      40,
      {
        action: "resource-site-assault",
        resourceSiteId: siteState.id,
        resourceSiteUnits: selectedUnits,
      },
      !canSend,
      disabledTooltip,
    );
    return;
  }

  host.drawPanel(parent, contentX, sectionY, contentWidth, sectionHeight, 0.52);
  host.drawText(parent, translations.ui.resourceSiteStatusLooted ?? "Looted", contentX + 20, sectionY + 22, {
    fill: uiTheme.accentStrong,
    fontSize: uiTextSize.emphasis,
    fontWeight: "900",
  });
  host.drawText(
    parent,
    translations.ui.resourceSiteLootedBody ?? "The defenders are gone and the useful supplies were moved into the hero inventory.",
    contentX + 20,
    sectionY + 72,
    {
      fill: uiTheme.positive,
      fontSize: uiTextSize.small,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: contentWidth - 40,
    },
  );
}

function getResourceSiteStatusLabel(
  siteState: GameState["resourceSites"][number],
  translations: TranslationPack,
): string {
  if (siteState.assault) {
    return translations.ui.resourceSiteStatusAssault ?? "Assault in progress";
  }

  if (siteState.looted) {
    return translations.ui.resourceSiteStatusLooted ?? "Looted";
  }

  return translations.ui.resourceSiteStatusLocked ?? "Unsecured";
}

function drawResourceSiteEnemyTab(
  host: VillageModalsHost,
  parent: Container,
  siteState: GameState["resourceSites"][number],
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  host.drawPanel(parent, x, y, width, height, 0.56);

  const rows = enemyUnitIds
    .map((unitId) => ({
      unitId,
      count: Math.max(0, Math.floor(siteState.defenderArmy[unitId] ?? 0)),
    }))
    .filter((entry) => entry.count > 0);

  if (rows.length === 0) {
    host.drawIcon(parent, "done", x + 34, y + 48, 24);
    host.drawText(parent, translations.ui.resourceSiteNoEnemies ?? "No known defenders remain.", x + 68, y + 31, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.body,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: width - 108,
    });
    return;
  }

  const rowHeight = Math.max(38, Math.min(48, Math.floor((height - 28) / rows.length)));
  const rowX = x + 18;
  const rowWidth = width - 36;
  const countX = x + width - 184;
  const powerX = x + width - 82;

  host.drawText(parent, translations.ui.resourceSiteEnemyCount ?? "Count", countX, y + 14, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.caption,
    fontWeight: "900",
  });
  host.drawText(parent, translations.ui.resourceSiteEnemyAttack ?? "Attack", powerX, y + 14, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.caption,
    fontWeight: "900",
  });

  rows.forEach((entry, index) => {
    const rowY = y + 36 + index * rowHeight;
    drawResourceSiteEnemyRow(
      host,
      parent,
      entry.unitId,
      entry.count,
      translations,
      rowX,
      rowY,
      rowWidth,
      rowHeight - 4,
      countX,
      powerX,
    );
  });
}

function drawResourceSiteEnemyRow(
  host: VillageModalsHost,
  parent: Container,
  unitId: EnemyUnitId,
  count: number,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
  countX: number,
  powerX: number,
): void {
  const definition = combatUnitDefinitions[unitId];
  const attackPower = Math.max(0, count * definition.damage);
  const row = new Container();
  row.x = x;
  row.y = y;
  parent.addChild(row);
  host.drawPanel(row, 0, 0, width, height, 0.34);
  drawResourceSiteEnemyVisual(host, row, unitId, 25, height / 2 + 3, Math.min(40, height + 8));
  host.drawText(row, translations.roles[definition.nameKey] ?? unitId, 56, 6, {
    fill: uiTheme.text,
    fontSize: uiTextSize.body,
    fontWeight: "900",
  });
  host.drawText(row, `HP ${definition.maxHp} / DMG ${definition.damage} / RNG ${definition.range}`, 56, 25, {
    fill: uiTheme.textMuted,
    fontSize: uiTextSize.caption,
    fontWeight: "800",
  });
  host.drawText(parent, `${count}`, countX, y + 12, {
    fill: uiTheme.accentStrong,
    fontSize: uiTextSize.body,
    fontWeight: "900",
  });
  host.drawText(parent, `${attackPower}`, powerX, y + 12, {
    fill: uiTheme.warning,
    fontSize: uiTextSize.body,
    fontWeight: "900",
  });
  host.bindTooltip(
    row,
    `${translations.roles[definition.nameKey] ?? unitId}: ${translations.ui.resourceSiteEnemyCount ?? "Count"} ${count}, ${translations.ui.resourceSiteEnemyAttack ?? "Attack"} ${attackPower}`,
  );
}

function drawResourceSiteEnemyVisual(
  host: VillageModalsHost,
  parent: Container,
  unitId: EnemyUnitId,
  x: number,
  y: number,
  size: number,
): void {
  const npcKindId = combatUnitNpcKindById[unitId];
  const textureSet = host.getMapNpcTextures(npcKindId);
  const texture = textureSet?.west[0] ?? textureSet?.east[0] ?? null;

  if (!texture) {
    host.drawIcon(parent, "skull", x, y, Math.max(18, size * 0.64));
    return;
  }

  const visual = mapNpcDefinitions[npcKindId];
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.78);
  const scale = Math.min(size / Math.max(1, visual.renderWidth), size / Math.max(1, visual.renderHeight));
  sprite.width = visual.renderWidth * scale;
  sprite.height = visual.renderHeight * scale;
  sprite.x = x;
  sprite.y = y + size * 0.18;
  sprite.roundPixels = true;
  parent.addChild(sprite);
}

function drawResourceSiteUnitSelector(
  host: VillageModalsHost,
  parent: Container,
  siteId: string,
  unitId: UnitId,
  selectedUnits: UnitCounts,
  availableUnits: UnitCounts,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
): void {
  const selected = Math.max(0, Math.floor(selectedUnits[unitId] ?? 0));
  const available = Math.max(0, Math.floor(availableUnits[unitId] ?? 0));

  host.drawIcon(parent, getUnitIconId(unitId), x + 18, y + 18, 18);
  host.drawText(parent, translations.roles[unitId] ?? unitId, x + 42, y + 2, {
    fill: uiTheme.text,
    fontSize: uiTextSize.body,
    fontWeight: "900",
  });
  host.drawText(parent, `${selected}/${available}`, x + 42, y + 25, {
    fill: selected > 0 ? uiTheme.accentStrong : uiTheme.textMuted,
    fontSize: uiTextSize.body,
    fontWeight: "900",
  });
  drawLocalStepper(
    host,
    parent,
    `${selected}`,
    x + Math.max(190, width - 138),
    y + 10,
    () => {
      host.setResourceSiteUnitCount(siteId, unitId, selected - 1, availableUnits);
    },
    () => {
      host.setResourceSiteUnitCount(siteId, unitId, selected + 1, availableUnits);
    },
    selected <= 0,
    selected >= available,
  );
}

function getResourceSiteAssaultDisabledTooltip(
  translations: TranslationPack,
  hasSelectedTroops: boolean,
): string | undefined {
  if (!hasSelectedTroops) {
    return translations.ui.notEnoughTroops ?? "Not enough available troops.";
  }

  return undefined;
}

function drawResourceSiteDifficultyCard(
  host: VillageModalsHost,
  parent: Container,
  rating: number,
  x: number,
  y: number,
  width: number,
  height: number,
  activeFill: number,
  tooltip: string,
): void {
  const card = new Container();
  card.x = x;
  card.y = y;
  parent.addChild(card);

  host.drawPanel(card, 0, 0, width, height, 0.48);

  const normalizedRating = Math.max(0, Math.min(5, Math.floor(rating)));
  const skullSize = Math.max(20, Math.min(28, (width - 42) / 5));
  const gap = Math.max(4, skullSize * 0.2);
  const totalWidth = skullSize * 5 + gap * 4;
  const startX = (width - totalWidth) / 2 + skullSize / 2;
  const skullY = height / 2;

  for (let index = 0; index < 5; index += 1) {
    const icon = host.drawIcon(card, "skull", startX + index * (skullSize + gap), skullY, skullSize);
    icon.alpha = index < normalizedRating ? 1 : 0.22;
    icon.tint = index < normalizedRating ? activeFill : uiTheme.textMuted;
  }

  host.bindTooltip(card, tooltip);
}

function drawResourceSiteMetricCard(
  host: VillageModalsHost,
  parent: Container,
  iconId: string,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  valueFill = uiTheme.text,
  tooltip?: string,
): void {
  const card = new Container();
  card.x = x;
  card.y = y;
  parent.addChild(card);

  host.drawPanel(card, 0, 0, width, height, 0.48);
  host.drawIcon(card, iconId, 26, height / 2, 30);
  host.drawText(card, value, 56, 27, {
    fill: valueFill,
    fontSize: uiTextSize.actionValue,
    fontWeight: "900",
    wordWrap: true,
    wordWrapWidth: width - 68,
  });
  host.bindTooltip(card, tooltip ?? `${label}: ${value}`);
}
