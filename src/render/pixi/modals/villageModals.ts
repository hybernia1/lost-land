import { Container, Graphics } from "pixi.js";
import { buildingById } from "../../../data/buildings";
import { GAME_HOUR_REAL_SECONDS } from "../../../game/time";
import type { BuildingId, GameState } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getAvailableBuildingsForPlot } from "../../../systems/buildings";
import { getTravelTilesToSite } from "../../../systems/resourceSites";
import type { DrawCenteredTextFn, DrawOverlayHeaderFn, DrawPanelFn, DrawTextFn, PixiActionDetail, RectButtonOptions } from "../core/types";
import { formatRate, formatScoutingRemaining, formatTemplate } from "../helpers/formatters";

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
  const detailBuildingId = selectedPlot?.buildingId;
  const modalWidth = isResourceSiteModal
    ? Math.min(720, width - 40)
    : isBuildChoice
      ? Math.min(900, width - 56)
      : Math.min(860, width - 40);
  const modalHeight = isResourceSiteModal
    ? Math.min(500, height - 40)
    : isBuildChoice
      ? Math.min(690, height - 56)
      : Math.min(detailBuildingId === "barracks" ? 590 : 510, height - 40);
  const panel = new Container();
  panel.x = (width - modalWidth) / 2;
  panel.y = (height - modalHeight) / 2;
  panel.eventMode = "static";
  overlay.addChild(panel);
  host.drawPanel(panel, 0, 0, modalWidth, modalHeight, 1, 0);

  if (isResourceSiteModal && selectedResourceSite) {
    drawModalHeader(
      host,
      panel,
      translations.ui.resourceSiteTitle ?? "Oasis",
      `${translations.resources[selectedResourceSite.resourceId]} / ${translations.ui.resourceSiteStatus ?? "Status"}`,
      modalWidth,
      translations,
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
    const subtitle = `${selectedPlot.id} / ${translations.ui.emptyPlot}`;
    drawModalHeader(host, panel, title, subtitle, modalWidth, translations);
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

  drawModalClose(host, panel, modalWidth, translations);
  const buildingId = selectedPlot.buildingId;
  const building = state.buildings[buildingId];
  const definition = buildingById[buildingId];
  host.drawBuildingDetail(
    panel,
    buildingId,
    building.level,
    building.upgradingRemaining,
    definition.maxLevel,
    state,
    translations,
    modalWidth,
    modalHeight,
  );
}

function drawModalHeader(
  host: VillageModalsHost,
  parent: Container,
  title: string,
  subtitle: string,
  modalWidth: number,
  translations: TranslationPack,
): void {
  host.drawOverlayHeader(parent, modalWidth, translations, {
    iconId: "build",
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
  const panelX = 26;
  const panelY = 86;
  const panelWidth = modalWidth - 52;
  const panelHeight = modalHeight - 112;
  const card = new Graphics();
  card.rect(panelX, panelY, panelWidth, panelHeight).fill({ color: 0x0f120f, alpha: 0.78 }).stroke({
    color: 0x2b352f,
    alpha: 0.9,
    width: 1.5,
  });
  parent.addChild(card);

  const resourceName = translations.resources[siteState.resourceId];
  const yieldPerWorkerPerHour = siteState.yieldPerWorker * GAME_HOUR_REAL_SECONDS;
  const travelHours = getTravelTilesToSite(siteState.id);
  const contentX = panelX + 16;
  const contentWidth = panelWidth - 32;
  let cursorY = panelY + 14;
  const statusLabel = siteState.assault
    ? translations.ui.resourceSiteStatusAssault ?? "Assault in progress"
    : siteState.captured
      ? translations.ui.resourceSiteStatusCaptured ?? "Secured"
      : translations.ui.resourceSiteStatusLocked ?? "Unsecured";
  const commodityLabel = host.drawText(parent, `${translations.ui.resourceSiteCommodity ?? "Commodity"}: ${resourceName}`, contentX, cursorY, {
    fill: 0xf5efdf,
    fontSize: 16,
    fontWeight: "900",
  });
  cursorY = commodityLabel.y + commodityLabel.height + 6;
  const statusText = host.drawText(parent, `${translations.ui.resourceSiteStatus ?? "Status"}: ${statusLabel}`, contentX, cursorY, {
    fill: siteState.captured ? 0x9ed99b : siteState.assault ? 0xf1c17f : 0xd38a8a,
    fontSize: 13,
    fontWeight: "900",
  });
  cursorY = statusText.y + statusText.height + 6;
  const requirementText = host.drawText(
    parent,
    `${translations.ui.resourceSiteCaptureRequirement ?? "Minimum assault strength"}: ${siteState.captureMinTroops} ${translations.ui.availableTroops?.toLowerCase() ?? "troops"}`,
    contentX,
    cursorY,
    {
      fill: 0xaeb4b8,
      fontSize: 12,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: contentWidth,
    },
  );
  cursorY = requirementText.y + requirementText.height + 6;
  const travelText = host.drawText(
    parent,
    `${translations.ui.resourceSiteTravelTime ?? "Travel time"}: ${travelHours}h (${travelHours} tiles)`,
    contentX,
    cursorY,
    {
      fill: 0xaeb4b8,
      fontSize: 12,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: contentWidth,
    },
  );
  cursorY = travelText.y + travelText.height + 14;

  if (siteState.assault) {
    const runningLabel = host.drawText(parent, translations.ui.resourceSiteAssaultRunning ?? "Assault team is marching to the oasis.", contentX, cursorY, {
      fill: 0xf1df9a,
      fontSize: 13,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: contentWidth,
    });
    host.drawText(
      parent,
      `${translations.ui.returnsIn ?? "returns in"} ${formatScoutingRemaining(siteState.assault.remainingSeconds)}`,
      contentX,
      runningLabel.y + runningLabel.height + 12,
      {
        fill: 0xf5efdf,
        fontSize: 16,
        fontWeight: "900",
      },
    );
    return;
  }

  if (!siteState.captured) {
    const selectedTroops = host.getResourceSiteTroopCount(siteState.id, state.survivors.troops, siteState.captureMinTroops);
    host.drawText(parent, translations.ui.resourceSiteSendTroops ?? "Send troops", contentX, cursorY, {
      fill: 0xd7ddd8,
      fontSize: 14,
      fontWeight: "900",
    });
    const controlsY = cursorY + 24;
    host.createLocalModalButton(parent, "-", contentX, controlsY, 42, 34, () => {
      host.setResourceSiteTroopCount(siteState.id, selectedTroops - 1, state.survivors.troops, siteState.captureMinTroops);
    }, selectedTroops <= 1);
    host.drawCenteredText(parent, `${selectedTroops}`, contentX + 74, controlsY + 17, {
      fill: 0xf5efdf,
      fontSize: 16,
      fontWeight: "900",
    });
    host.createLocalModalButton(parent, "+", contentX + 106, controlsY, 42, 34, () => {
      host.setResourceSiteTroopCount(siteState.id, selectedTroops + 1, state.survivors.troops, siteState.captureMinTroops);
    }, selectedTroops >= Math.max(1, state.survivors.troops));
    const canSend = selectedTroops > 0 && selectedTroops <= state.survivors.troops;
    const sendDisabledTooltip = canSend
      ? undefined
      : translations.ui.notEnoughTroops ?? "Not enough available troops.";
    const sendButtonWidth = Math.max(
      120,
      Math.min(194, panelX + panelWidth - (contentX + 170) - 16),
    );
    const sendButtonX = panelX + panelWidth - sendButtonWidth - 16;
    host.createRectButton(parent, {
      label: translations.ui.resourceSiteSendAssault ?? "Capture oasis",
      x: sendButtonX,
      y: controlsY,
      width: sendButtonWidth,
      height: 34,
      detail: {
        action: "resource-site-assault",
        resourceSiteId: siteState.id,
        resourceSiteTroops: selectedTroops,
      },
      disabled: !canSend,
      tooltip: sendDisabledTooltip,
      tone: "primary",
    });

    host.drawText(
      parent,
      formatTemplate(
        translations.ui.resourceSiteTroopAvailability ?? "Available troops: {available} / selected: {selected}",
        {
          available: state.survivors.troops,
          selected: selectedTroops,
        },
      ),
      contentX,
      controlsY + 68,
      {
        fill: canSend ? 0xaeb4b8 : 0xd38a8a,
        fontSize: 12,
        fontWeight: "800",
        wordWrap: true,
        wordWrapWidth: contentWidth,
      },
    );

    const requirementColor = selectedTroops >= siteState.captureMinTroops ? 0x9ed99b : 0xf1c17f;
    host.drawText(
      parent,
      selectedTroops >= siteState.captureMinTroops
        ? translations.ui.resourceSiteReadyThreshold ?? "Troop minimum met."
        : formatTemplate(
            translations.ui.resourceSiteBelowThreshold ?? "Below requirement: need at least {required} troops.",
            { required: siteState.captureMinTroops },
          ),
      contentX,
      controlsY + 44,
      {
        fill: requirementColor,
        fontSize: 12,
        fontWeight: "900",
        wordWrap: true,
        wordWrapWidth: contentWidth,
      },
    );
    return;
  }

  host.drawText(parent, translations.ui.resourceSiteSettlement ?? "Oasis settlement crew", contentX, cursorY, {
    fill: 0xd7ddd8,
    fontSize: 14,
    fontWeight: "900",
  });
  const workerControlsY = cursorY + 24;
  host.createRectButton(parent, {
    label: "-",
    x: contentX,
    y: workerControlsY,
    width: 42,
    height: 34,
    detail: { action: "resource-site-workers", resourceSiteId: siteState.id, delta: -1 },
    disabled: siteState.assignedWorkers <= 0,
  });
  host.drawCenteredText(
    parent,
    `${siteState.assignedWorkers}/${siteState.maxWorkers}`,
    contentX + 80,
    workerControlsY + 17,
    {
      fill: 0xf5efdf,
      fontSize: 16,
      fontWeight: "900",
    },
  );
  host.createRectButton(parent, {
    label: "+",
    x: contentX + 120,
    y: workerControlsY,
    width: 42,
    height: 34,
    detail: { action: "resource-site-workers", resourceSiteId: siteState.id, delta: 1 },
    disabled: siteState.assignedWorkers >= siteState.maxWorkers || state.survivors.workers <= 0,
    tooltip: state.survivors.workers <= 0
      ? translations.ui.notEnoughWorkers
      : undefined,
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
    contentX,
    workerControlsY + 46,
    {
      fill: 0x9ed99b,
      fontSize: 12,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: contentWidth,
    },
  );
}
