import { Container } from "pixi.js";
import { buildingById } from "../../../data/buildings";
import { GAME_HOUR_REAL_SECONDS } from "../../../game/time";
import type { BuildingId, GameState } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getAvailableBuildingsForPlot, getGlobalProductionMultiplier } from "../../../systems/buildings";
import { getTravelTilesToSite } from "../../../systems/resourceSites";
import type { DrawCenteredTextFn, DrawIconFn, DrawOverlayHeaderFn, DrawPanelFn, DrawTextFn, PixiActionDetail, RectButtonOptions } from "../core/types";
import { uiTextSize, uiTheme } from "../core/constants";
import { formatRate, formatScoutingRemaining, formatTemplate } from "../helpers/formatters";
import { drawActionStepper, drawLocalStepper } from "./modalControls";
import { createModalPanel, drawModalContentPlane, modalLayout, resolveModalFrame } from "./modalLayout";

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
  getResourceSiteTroopCount: (siteId: string, availableTroops: number, minimumTroops: number) => number;
  setResourceSiteTroopCount: (siteId: string, nextValue: number, availableTroops: number, minimumTroops: number) => void;
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
      translations.ui.resourceSiteTitle ?? "Oasis",
      modalWidth,
      translations,
      `${translations.resources[selectedResourceSite.resourceId]} / ${statusLabel}`,
      selectedResourceSite.resourceId,
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
  const resourceName = translations.resources[siteState.resourceId];
  const productionMultiplier = getGlobalProductionMultiplier(state);
  const yieldPerWorkerPerHour = siteState.yieldPerWorker * productionMultiplier * GAME_HOUR_REAL_SECONDS;
  const currentProductionPerHour = siteState.captured
    ? yieldPerWorkerPerHour * siteState.assignedWorkers
    : 0;
  const travelHours = getTravelTilesToSite(siteState.id);
  const statusLabel = getResourceSiteStatusLabel(siteState, translations);
  const contentX = 34;
  const contentY = 112;
  const contentWidth = modalWidth - 68;
  const cardGap = 10;
  const metricCardWidth = (contentWidth - cardGap * 3) / 4;
  const metricCardHeight = 78;
  const statusColor = siteState.captured ? uiTheme.positive : siteState.assault ? uiTheme.warning : uiTheme.negative;

  drawResourceSiteMetricCard(
    host,
    parent,
    siteState.resourceId,
    translations.ui.resourceSiteCommodity ?? "Commodity",
    resourceName,
    contentX,
    contentY,
    metricCardWidth,
    metricCardHeight,
    uiTheme.text,
    `${translations.ui.resourceSiteCommodity ?? "Commodity"}: ${resourceName}`,
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
    siteState.captured ? siteState.resourceId : "clock",
    siteState.captured ? translations.ui.production : translations.ui.resourceSiteTravelTime ?? "Travel time",
    siteState.captured ? `+${formatRate(currentProductionPerHour)}/h` : `${travelHours}h`,
    contentX + (metricCardWidth + cardGap) * 2,
    contentY,
    metricCardWidth,
    metricCardHeight,
    siteState.captured ? uiTheme.positive : uiTheme.text,
    siteState.captured
      ? `${translations.ui.production}: +${formatRate(currentProductionPerHour)}/h`
      : `${translations.ui.resourceSiteTravelTime ?? "Travel time"}: ${travelHours}h`,
  );
  drawResourceSiteMetricCard(
    host,
    parent,
    siteState.captured ? "people" : "troop",
    siteState.captured
      ? translations.ui.resourceSiteSettlement ?? "Oasis settlement crew"
      : translations.ui.resourceSiteCaptureRequirement ?? "Minimum assault strength",
    siteState.captured ? `${siteState.assignedWorkers}/${siteState.maxWorkers}` : `${siteState.captureMinTroops}`,
    contentX + (metricCardWidth + cardGap) * 3,
    contentY,
    metricCardWidth,
    metricCardHeight,
    siteState.captured ? uiTheme.text : uiTheme.accentStrong,
    siteState.captured
      ? `${translations.ui.resourceSiteSettlement ?? "Oasis settlement crew"}: ${siteState.assignedWorkers}/${siteState.maxWorkers}`
      : `${translations.ui.resourceSiteCaptureRequirement ?? "Minimum assault strength"}: ${siteState.captureMinTroops}`,
  );

  const sectionY = contentY + metricCardHeight + 24;
  const sectionHeight = Math.max(1, modalHeight - sectionY - 36);

  if (siteState.assault) {
    host.drawPanel(parent, contentX, sectionY, contentWidth, sectionHeight, 0.55);
    host.drawIcon(parent, "expedition", contentX + 34, sectionY + 48, 26);
    const runningLabel = host.drawText(parent, translations.ui.resourceSiteAssaultRunning ?? "Assault team is marching to the oasis.", contentX + 68, sectionY + 28, {
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

  if (!siteState.captured) {
    const selectedTroops = host.getResourceSiteTroopCount(siteState.id, state.survivors.troops, siteState.captureMinTroops);
    const selectedMeetsRequirement = selectedTroops >= siteState.captureMinTroops;
    const enoughTroopsAvailable = selectedTroops <= state.survivors.troops;
    const canSend = selectedMeetsRequirement && enoughTroopsAvailable;
    const disabledTooltip = getResourceSiteAssaultDisabledTooltip(
      translations,
      selectedTroops,
      siteState.captureMinTroops,
      enoughTroopsAvailable,
    );
    host.drawPanel(parent, contentX, sectionY, contentWidth, sectionHeight, 0.56);
    const actionX = contentX + 28;
    const actionWidth = contentWidth - 56;
    host.drawText(parent, translations.ui.resourceSiteSendTroops ?? "Send troops", actionX, sectionY + 22, {
      fill: uiTheme.accentStrong,
      fontSize: uiTextSize.emphasis,
      fontWeight: "900",
    });
    drawLocalStepper(
      host,
      parent,
      `${selectedTroops}`,
      actionX,
      sectionY + 68,
      () => {
        host.setResourceSiteTroopCount(siteState.id, selectedTroops - 1, state.survivors.troops, siteState.captureMinTroops);
      },
      () => {
        host.setResourceSiteTroopCount(siteState.id, selectedTroops + 1, state.survivors.troops, siteState.captureMinTroops);
      },
      selectedTroops <= 1,
      selectedTroops >= Math.max(1, state.survivors.troops),
    );
    const requirementColor = selectedMeetsRequirement ? uiTheme.positive : uiTheme.warning;
    host.createModalButton(
      parent,
      translations.ui.resourceSiteSendAssault ?? "Capture oasis",
      actionX,
      sectionY + 144,
      Math.min(320, actionWidth),
      40,
      {
        action: "resource-site-assault",
        resourceSiteId: siteState.id,
        resourceSiteTroops: selectedTroops,
      },
      !canSend,
      disabledTooltip,
    );
    host.drawText(
      parent,
      selectedMeetsRequirement
        ? translations.ui.resourceSiteReadyThreshold ?? "Troop minimum met."
        : formatTemplate(
            translations.ui.resourceSiteBelowThreshold ?? "Below requirement: need at least {required} troops.",
            { required: siteState.captureMinTroops },
          ),
      actionX,
      sectionY + 198,
      {
        fill: requirementColor,
        fontSize: uiTextSize.small,
        fontWeight: "900",
        wordWrap: true,
        wordWrapWidth: actionWidth,
      },
    );
    return;
  }

  host.drawPanel(parent, contentX, sectionY, contentWidth, sectionHeight, 0.52);
  host.drawText(parent, translations.ui.resourceSiteSettlement ?? "Oasis settlement crew", contentX + 20, sectionY + 22, {
    fill: uiTheme.accentStrong,
    fontSize: uiTextSize.emphasis,
    fontWeight: "900",
  });
  drawActionStepper(
    host,
    parent,
    `${siteState.assignedWorkers}`,
    contentX + 20,
    sectionY + 76,
    { action: "resource-site-workers", resourceSiteId: siteState.id, delta: -1 },
    { action: "resource-site-workers", resourceSiteId: siteState.id, delta: 1 },
    siteState.assignedWorkers <= 0,
    siteState.assignedWorkers >= siteState.maxWorkers || state.survivors.workers <= 0,
    siteState.assignedWorkers <= 0 ? `${translations.ui.workers}: 0/${siteState.maxWorkers}` : undefined,
    siteState.assignedWorkers >= siteState.maxWorkers
      ? `${translations.ui.workers}: ${siteState.assignedWorkers}/${siteState.maxWorkers}`
      : state.survivors.workers <= 0
        ? translations.ui.notEnoughWorkers
        : undefined,
  );
  host.drawText(parent, `${siteState.assignedWorkers}/${siteState.maxWorkers}`, contentX + 198, sectionY + 96, {
    fill: uiTheme.text,
    fontSize: uiTextSize.sectionTitle,
    fontWeight: "900",
  });

  host.drawText(
    parent,
    formatTemplate(
      translations.ui.resourceSiteWorkerYield ?? "Each worker adds +{amount}/h {resource}.",
      {
        amount: formatRate(yieldPerWorkerPerHour),
        resource: resourceName,
      },
    ),
    contentX + 20,
    sectionY + 142,
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

  if (siteState.captured) {
    return translations.ui.resourceSiteStatusCaptured ?? "Secured";
  }

  return translations.ui.resourceSiteStatusLocked ?? "Unsecured";
}

function getResourceSiteAssaultDisabledTooltip(
  translations: TranslationPack,
  selectedTroops: number,
  minimumTroops: number,
  enoughTroopsAvailable: boolean,
): string | undefined {
  if (!enoughTroopsAvailable) {
    return translations.ui.notEnoughTroops ?? "Not enough available troops.";
  }

  if (selectedTroops < minimumTroops) {
    return formatTemplate(
      translations.ui.resourceSiteBelowThreshold ?? "Below requirement: need at least {required} troops.",
      { required: minimumTroops },
    );
  }

  return undefined;
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
