import {
  Application,
  CanvasTextMetrics,
  Container,
  Graphics,
  Rectangle,
  Text,
  TextStyle,
  Sprite,
  type TextStyleFontWeight,
} from "pixi.js";
import { resourceDefinitions } from "../data/resources";
import { buildingById, buildingDefinitions } from "../data/buildings";
import {
  getEnvironmentDefinition,
  getEnvironmentIntensityIndex,
} from "../data/environment";
import { decisionQuestById } from "../data/decisions";
import { defaultVillageLayout } from "../data/villageLayouts";
import type { VillagePlotDefinition, VillageResourceSiteDefinition } from "../data/villagePlots";
import { DAY_START_HOUR, formatGameClock, GAME_HOUR_REAL_SECONDS, getDaylightState, getGameDay, NIGHT_START_HOUR } from "../game/time";
import type { BuildingCategory, BuildingId, DecisionHistoryEntry, GameState, MarketResourceId, ResourceBag, ResourceId } from "../game/types";
import type { TranslationPack } from "../i18n/types";
import {
  getAvailableBuildingsForPlot,
  getBuildingBuildSeconds,
  getBuildingWorkerLimit,
  getConstructionWorkerRequirement,
  getCoalMineCoalRate,
  getGlobalProductionMultiplier,
  getHousingStatus,
  getMainBuildingLevelRequirement,
  getMainBuildingMoraleRate,
  getMainBuildingProductionBonus,
  getResourceBreakdown,
  getResourceProductionRates,
  getSurvivorAttractionOnCompletedLevel,
  getUpgradeCost,
  getWorkshopCoalRate,
  getWorkshopMaterialRate,
  hasAvailableBuildingSlot,
  isMainBuildingRequirementMet,
  isBuildingInactiveDueToCoal,
  type ResourceBreakdownLine,
} from "../systems/buildings";
import {
  getClinicFoodPerTreatment,
  getClinicTreatmentRatePerGameHour,
} from "../systems/health";
import { formatLogEntry } from "../systems/log";
import {
  canTradeAtMarket,
  getAvailableMarketTrades,
  getMarketTradeCapacity,
  getMarketTradeLimit,
  getMarketTradeSlots,
  isMarketResourceId,
  marketResourceIds,
} from "../systems/market";
import {
  getAssignedBuildingWorkerCount,
  getConstructionWorkerCount,
  getPopulation,
} from "../systems/population";
import {
  getAssignedResourceSiteWorkerCount,
  getResourceSiteAssaultTroopCount,
} from "../systems/resourceSites";
import { canAfford } from "../systems/resources";
import {
  decisionProfileAxes,
  getDecisionProfileAxisValue,
  getDecisionProfileKind,
} from "../systems/quests";
import { getTravelTilesToSite } from "../systems/resourceSites";
import {
  BUILDING_PREVIEW_RENDER_SCALE,
  HUD_DESIGN_SCALE,
  HUD_FONT_FAMILY,
  HUD_LEFT_PANEL_WIDTH,
  HUD_TOP_STRIP_HEIGHT,
  MAX_RENDER_RESOLUTION,
  MODAL_BACKDROP_ALPHA,
  TOOLTIP_POSITION_EPSILON,
  VILLAGE_BUILDING_RENDER_SCALE,
  buildCategoryOrder,
  capitalize,
  decisionProfileIconByKind,
  environmentAlertIconByCondition,
  environmentAlertToneByCondition,
  getHudTextLineHeight,
  nonPerimeterVillagePlots,
  normalizeHudFontWeight,
  palisadePlotDefinition,
  resourceColors,
  resourceSiteDefinitions,
  upgradingTooltip,
  villagePlotDefinitions,
} from "./pixi/core/constants";
import { drawHudLeftArea, drawHudPanels } from "./pixi/hud/hudPanels";
import {
  clampCamera as clampCameraState,
  getLayout as getSceneLayout,
  handleHostPointerDown as handlePointerDownWithCamera,
  handleHostPointerMove as handlePointerMoveWithCamera,
  handleHostPointerUp as handlePointerUpWithCamera,
  handleHostWheel as handleWheelWithCamera,
  isHudPointer as isHudPointerArea,
  refreshCameraTransform as refreshCameraStateTransform,
  shouldAnimateCamera as shouldAnimateCameraState,
  type CameraDragState,
} from "./pixi/camera/cameraController";
import type {
  Bounds,
  BrandAlert,
  BuildingMetric,
  CircleButtonOptions,
  ConquestResultPreview,
  DecisionHistoryRow,
  EffectLine,
  FormattedLogEntry,
  GameOverPreview,
  PixiActionDetail,
  RectButtonOptions,
  ResourceBreakdownTab,
  SceneLayout,
  TabItem,
  TabOptions,
  VillageInfoPanel,
} from "./pixi/core/types";
import {
  drawConquestResultModal,
  drawGameOverModal,
  drawQuestDecisionModal,
} from "./pixi/modals/resultModals";
import {
  drawBackground as drawWorldBackground,
  drawDecorObjects as drawWorldDecorObjects,
  drawPalisade as drawWorldPalisade,
  drawPlot as drawWorldPlot,
  drawResourceSites as drawWorldResourceSites,
  drawTerrain as drawWorldTerrain,
} from "./pixi/scene/worldRenderer";
import { AmbientEffectsController } from "./pixi/ambient/ambientEffects";
import { drawInfoPanel } from "./pixi/modals/infoPanels";
import { drawVillageModal } from "./pixi/modals/villageModals";
import {
  drawBuildChoices as drawBuildChoicesModal,
  drawBuildingDetail as drawBuildingDetailModal,
} from "./pixi/modals/buildingModals";
import {
  createCircleButtonPrimitive,
  createPillPrimitive,
  createRectButtonPrimitive,
  drawCenteredTextPrimitive,
  drawPanelPrimitive,
  drawTextPrimitive,
} from "./pixi/ui/primitives";
import {
  getCostLineParts,
  getCurrentBuildingEffects,
  getNextLevelEffects,
} from "./pixi/helpers/buildingEffects";
import {
  formatPercentBonus,
  formatRate,
  formatScoutingRemaining,
  formatTemplate,
  getHourlyRateLabel,
  getRateColor,
} from "./pixi/helpers/formatters";
import {
  getDecisionHistoryOption,
  getDecisionImpactLines,
  getDecisionProfileOverallLabel,
} from "./pixi/helpers/decisionHelpers";
import { getLogEntryFillColor, getLogEntryIconId } from "./pixi/helpers/logFormatting";
import { drawPixiIcon } from "./pixiIcons";
import { VillageAssets } from "./villageAssets";
export type {
  ConquestResultPreview,
  GameOverPreview,
  PixiActionDetail,
  VillageInfoPanel,
} from "./pixi/core/types";

export class PixiVillageRenderer {
  private app: Application | null = null;
  private readonly rootLayer = new Container();
  private readonly worldLayer = new Container();
  private readonly backgroundLayer = new Container();
  private readonly cameraLayer = new Container();
  private readonly cameraStaticLayer = new Container();
  private readonly cameraDynamicLayer = new Container();
  private readonly environmentOverlayLayer = new Container();
  private readonly daylightOverlayLayer = new Container();
  private readonly environmentOverlayGraphic = new Graphics();
  private readonly daylightOverlayGraphic = new Graphics();
  private readonly hudLayer = new Container();
  private readonly tooltipLayer = new Container();
  private readonly canvasTooltipPanel = new Graphics();
  private readonly canvasTooltipLabel = new Text({
    text: "",
    style: {
      fill: 0xf4eedf,
      fontFamily: HUD_FONT_FAMILY,
      fontSize: 13,
      fontWeight: normalizeHudFontWeight("700"),
      lineHeight: 18,
      wordWrap: true,
      wordWrapWidth: 280,
    },
  });
  private readonly assets = new VillageAssets();
  private layout: SceneLayout = {
    originX: 0,
    originY: 0,
    width: 0,
    height: 0,
    scale: 1,
  };
  private lastState: GameState | null = null;
  private lastTranslations: TranslationPack | undefined;
  private buildChoicesScrollArea: Bounds | null = null;
  private buildChoicesScrollMax = 0;
  private buildChoicesScrollY = 0;
  private buildChoicesScrollPlotId: string | null = null;
  private logScrollArea: Bounds | null = null;
  private logScrollMax = 0;
  private logScrollY = 0;
  private resourceBreakdownScrollArea: Bounds | null = null;
  private resourceBreakdownScrollMax = 0;
  private resourceBreakdownScrollY = 0;
  private hudInteractionAreas: Bounds[] = [];
  private resourceBreakdownScrollResourceId: ResourceId | null = null;
  private resourceBreakdownScrollTab: ResourceBreakdownTab = "production";
  private decisionHistoryScrollArea: Bounds | null = null;
  private decisionHistoryScrollMax = 0;
  private decisionHistoryScrollY = 0;
  private activeResourceBreakdownTab: ResourceBreakdownTab = "production";
  private selectedDecisionHistoryIndex: number | null = null;
  private activeModalPlotId: string | null = null;
  private activeBuildCategory: BuildingCategory = "resource";
  private barracksTroopCount = 1;
  private readonly resourceSiteTroopCountById = new Map<string, number>();
  private marketFromResource: MarketResourceId = "material";
  private marketToResource: MarketResourceId = "food";
  private marketAmount = 10;
  private hudPixelScale = 1;
  private cameraOffsetX = 0;
  private cameraOffsetY = 0;
  private cameraZoom = 1;
  private cameraTargetOffsetX = 0;
  private cameraTargetOffsetY = 0;
  private cameraTargetZoom = 1;
  private cameraDragStart: CameraDragState | null = null;
  private cameraDragMoved = false;
  private cameraDragBlocked = false;
  private lastStaticWorldKey: string | null = null;
  private lastBackgroundKey: string | null = null;
  private readonly ambientEffects: AmbientEffectsController;
  private lastFormattedLogSource: ReadonlyArray<GameState["log"][number]> | null = null;
  private lastFormattedLogTranslations: TranslationPack | undefined;
  private lastFormattedLogEntries: FormattedLogEntry[] = [];
  private canvasTooltipText = "";
  private canvasTooltipWidth = 0;
  private canvasTooltipHeight = 0;
  private canvasTooltipX = Number.NaN;
  private canvasTooltipY = Number.NaN;
  private hadBlockingOverlayOpen = false;
  private readonly handleWheel = (event: WheelEvent) => this.handleHostWheel(event);
  private readonly handleMouseLeave = () => this.hideCanvasTooltip();
  private readonly handlePointerDown = (event: PointerEvent) => this.handleHostPointerDown(event);
  private readonly handlePointerMove = (event: PointerEvent) => this.handleHostPointerMove(event);
  private readonly handlePointerUp = (event: PointerEvent) => this.handleHostPointerUp(event);

  constructor(
    private readonly host: HTMLElement,
    private readonly requestRender: () => void = () => {},
    private readonly playTabSwitchSound: () => void = () => {},
  ) {
    this.tooltipLayer.eventMode = "none";
    this.canvasTooltipLabel.x = 12;
    this.canvasTooltipLabel.y = 9;
    this.tooltipLayer.addChild(this.canvasTooltipPanel, this.canvasTooltipLabel);
    this.tooltipLayer.visible = false;
    this.environmentOverlayGraphic.eventMode = "none";
    this.daylightOverlayGraphic.eventMode = "none";
    this.environmentOverlayLayer.addChild(this.environmentOverlayGraphic);
    this.daylightOverlayLayer.addChild(this.daylightOverlayGraphic);
    this.cameraLayer.addChild(this.cameraStaticLayer, this.cameraDynamicLayer);
    this.worldLayer.addChild(
      this.backgroundLayer,
      this.cameraLayer,
      this.environmentOverlayLayer,
      this.daylightOverlayLayer,
    );
    this.rootLayer.addChild(this.worldLayer, this.hudLayer, this.tooltipLayer);
    this.host.addEventListener("wheel", this.handleWheel, { passive: false });
    this.host.addEventListener("mouseleave", this.handleMouseLeave);
    this.host.addEventListener("pointerdown", this.handlePointerDown);
    this.host.addEventListener("pointermove", this.handlePointerMove);
    this.host.addEventListener("pointerup", this.handlePointerUp);
    this.host.addEventListener("pointercancel", this.handlePointerUp);
    this.ambientEffects = new AmbientEffectsController({
      host: this.host,
      getApp: () => this.app,
      environmentOverlayGraphic: this.environmentOverlayGraphic,
      daylightOverlayGraphic: this.daylightOverlayGraphic,
      shouldAnimateCamera: () => this.shouldAnimateCamera(),
      refreshCameraTransform: () => this.refreshCameraTransform(),
    });
    void this.initialize();
  }

  render(
    state: GameState,
    translations?: TranslationPack,
    modalPlotId?: string | null,
    infoPanel?: VillageInfoPanel | null,
    resolvedDecisionPreview?: DecisionHistoryEntry | null,
    conquestResultPreview?: ConquestResultPreview | null,
    gameOverPreview?: GameOverPreview | null,
  ): void {
    this.lastState = state;
    this.lastTranslations = translations;
    this.activeModalPlotId = modalPlotId ?? null;
    const hasBlockingOverlay = Boolean(
      modalPlotId ||
      infoPanel ||
      state.quests.activeDecision ||
      resolvedDecisionPreview ||
      conquestResultPreview ||
      gameOverPreview,
    );
    this.cameraDragBlocked = hasBlockingOverlay;
    if (hasBlockingOverlay && !this.hadBlockingOverlayOpen) {
      this.hideCanvasTooltip();
    }
    this.hadBlockingOverlayOpen = hasBlockingOverlay;

    if (!this.app) {
      return;
    }

    const width = this.host.clientWidth;
    const height = this.host.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    this.layout = this.getLayout(width, height);
    const hudPixelScale = 1;
    const hudRenderScale = HUD_DESIGN_SCALE * hudPixelScale;
    const hudWidth = width / hudRenderScale;
    const hudHeight = height / hudRenderScale;
    this.hudPixelScale = hudRenderScale;
    this.clearContainerChildren(this.cameraDynamicLayer);
    this.clearContainerChildren(this.hudLayer);
    this.buildChoicesScrollArea = null;
    this.buildChoicesScrollMax = 0;
    this.logScrollArea = null;
    this.logScrollMax = 0;
    this.resourceBreakdownScrollArea = null;
    this.resourceBreakdownScrollMax = 0;
    this.decisionHistoryScrollArea = null;
    this.decisionHistoryScrollMax = 0;
    this.hudInteractionAreas = [];
    this.hudLayer.scale.set(1);
    this.clampCurrentCamera(width, height);
    this.clampTargetCamera(width, height);
    this.applyCameraTransform();
    const staticWorldKey = this.getStaticWorldKey(state);
    if (staticWorldKey !== this.lastStaticWorldKey) {
      this.clearContainerChildren(this.cameraStaticLayer);
      drawWorldTerrain(this.worldRendererHost(), state);
      drawWorldDecorObjects(this.worldRendererHost());
      this.lastStaticWorldKey = staticWorldKey;
    }
    const backgroundKey = `${Math.round(width)}x${Math.round(height)}`;
    if (backgroundKey !== this.lastBackgroundKey) {
      this.clearContainerChildren(this.backgroundLayer);
      drawWorldBackground(this.worldRendererHost(), width, height);
      this.lastBackgroundKey = backgroundKey;
    }
    drawWorldPalisade(this.worldRendererHost(), state, translations);
    drawWorldResourceSites(this.worldRendererHost(), state, translations);

    for (const plot of nonPerimeterVillagePlots) {
      drawWorldPlot(this.worldRendererHost(), plot, state, translations);
    }

    this.drawHud(state, translations, hudWidth, hudHeight);
    drawVillageModal(this.villageModalsHost(), state, translations, hudWidth, hudHeight, modalPlotId ?? null);
    drawInfoPanel(this.infoPanelsHost(), state, translations, hudWidth, hudHeight, infoPanel ?? null);
    drawQuestDecisionModal(
      this.resultModalsHost(),
      state,
      translations,
      hudWidth,
      hudHeight,
      resolvedDecisionPreview ?? null,
    );
    drawConquestResultModal(
      this.resultModalsHost(),
      translations,
      hudWidth,
      hudHeight,
      conquestResultPreview ?? null,
    );
    drawGameOverModal(
      this.resultModalsHost(),
      translations,
      hudWidth,
      hudHeight,
      gameOverPreview ?? null,
    );
    this.ambientEffects.syncState(state);
    this.ambientEffects.refreshOverlays(performance.now(), true);
    this.ambientEffects.updateAnimationLoop();
    this.applyHudPixelScale(this.hudLayer, hudRenderScale);
    this.scaleHudInteractionBounds(hudRenderScale);
    this.app.render();
  }

  private clearContainerChildren(container: Container): void {
    const children = container.removeChildren();

    for (const child of children) {
      this.ambientEffects.unregisterTextureAnimationsForNode(child as Container);

      child.destroy({ children: true });
    }
  }

  hitTest(clientX: number, clientY: number): string | null {
    const rect = this.host.getBoundingClientRect();
    const x = (clientX - rect.left - this.cameraOffsetX) / this.cameraZoom;
    const y = (clientY - rect.top - this.cameraOffsetY) / this.cameraZoom;

    const siteHit = resourceSiteDefinitions.find((site) => {
      const bounds = this.getPlotBounds(site);
      return (
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      );
    });

    if (siteHit) {
      return siteHit.id;
    }

    return villagePlotDefinitions.find((plot) => {
      const bounds = this.getPlotBounds(plot);
      return (
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      );
    })?.id ?? null;
  }

  private handleHostWheel(event: WheelEvent): void {
    handleWheelWithCamera(
      {
        host: this.host,
        hudPixelScale: this.hudPixelScale,
        hudInteractionAreas: this.hudInteractionAreas,
        buildChoicesScrollArea: this.buildChoicesScrollArea,
        buildChoicesScrollMax: this.buildChoicesScrollMax,
        buildChoicesScrollY: this.buildChoicesScrollY,
        setBuildChoicesScrollY: (value: number) => {
          this.buildChoicesScrollY = value;
        },
        resourceBreakdownScrollArea: this.resourceBreakdownScrollArea,
        resourceBreakdownScrollMax: this.resourceBreakdownScrollMax,
        resourceBreakdownScrollY: this.resourceBreakdownScrollY,
        setResourceBreakdownScrollY: (value: number) => {
          this.resourceBreakdownScrollY = value;
        },
        logScrollArea: this.logScrollArea,
        logScrollMax: this.logScrollMax,
        logScrollY: this.logScrollY,
        setLogScrollY: (value: number) => {
          this.logScrollY = value;
        },
        decisionHistoryScrollArea: this.decisionHistoryScrollArea,
        decisionHistoryScrollMax: this.decisionHistoryScrollMax,
        decisionHistoryScrollY: this.decisionHistoryScrollY,
        setDecisionHistoryScrollY: (value: number) => {
          this.decisionHistoryScrollY = value;
        },
        requestRender: () => this.requestRender(),
        cameraDragBlocked: this.cameraDragBlocked,
        cameraTargetZoom: this.cameraTargetZoom,
        cameraTargetOffsetX: this.cameraTargetOffsetX,
        cameraTargetOffsetY: this.cameraTargetOffsetY,
        setCameraTarget: (zoom: number, offsetX: number, offsetY: number) => {
          this.cameraTargetZoom = zoom;
          this.cameraTargetOffsetX = offsetX;
          this.cameraTargetOffsetY = offsetY;
        },
        clampTargetCamera: (viewportWidth: number, viewportHeight: number) =>
          this.clampTargetCamera(viewportWidth, viewportHeight),
        updateAmbientAnimationLoop: () => this.ambientEffects.updateAnimationLoop(),
      },
      event,
    );
  }

  private handleHostPointerDown(event: PointerEvent): void {
    this.hideCanvasTooltip();

    const dragStart = handlePointerDownWithCamera(
      this.host,
      this.hudInteractionAreas,
      this.cameraDragBlocked,
      event,
      this.cameraTargetOffsetX,
      this.cameraTargetOffsetY,
    );
    if (!dragStart) {
      return;
    }
    this.cameraDragStart = dragStart;
    this.cameraDragMoved = false;
  }

  private handleHostPointerMove(event: PointerEvent): void {
    const next = handlePointerMoveWithCamera(this.host, this.cameraDragStart, event);
    if (!next) {
      return;
    }
    if (!next.moved && !this.cameraDragMoved) {
      return;
    }
    this.cameraDragMoved = true;
    this.cameraTargetOffsetX = next.offsetX;
    this.cameraTargetOffsetY = next.offsetY;
    this.clampTargetCamera(this.host.clientWidth, this.host.clientHeight);
    this.ambientEffects.updateAnimationLoop();
  }

  private handleHostPointerUp(event: PointerEvent): void {
    if (!handlePointerUpWithCamera(this.host, this.cameraDragStart, event)) {
      return;
    }

    this.cameraDragStart = null;

    if (this.cameraDragMoved) {
      this.cameraDragMoved = false;
      this.consumeHostClick();
    }
  }

  private isHudPointer(clientX: number, clientY: number): boolean {
    return isHudPointerArea(this.host, this.hudInteractionAreas, clientX, clientY);
  }

  destroy(): void {
    this.host.removeEventListener("wheel", this.handleWheel);
    this.host.removeEventListener("mouseleave", this.handleMouseLeave);
    this.host.removeEventListener("pointerdown", this.handlePointerDown);
    this.host.removeEventListener("pointermove", this.handlePointerMove);
    this.host.removeEventListener("pointerup", this.handlePointerUp);
    this.host.removeEventListener("pointercancel", this.handlePointerUp);
    this.ambientEffects.stopAnimation();
    this.app?.destroy(true);
    this.app = null;
  }

  private async initialize(): Promise<void> {
    const app = new Application();
    await app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: false,
      autoStart: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, MAX_RENDER_RESOLUTION),
    });

    app.canvas.classList.add("pixi-canvas");
    this.host.append(app.canvas);
    app.stage.addChild(this.rootLayer);
    this.app = app;

    await this.assets.load();
    this.requestRender();
  }

  private drawHud(
    state: GameState,
    translations: TranslationPack | undefined,
    width: number,
    height: number,
  ): void {
    const t = translations;
    const day = getGameDay(state.elapsedSeconds);
    const clock = formatGameClock(state.elapsedSeconds);
    const population = getPopulation(state);
    const housing = getHousingStatus(state);
    const rates = this.getTotalResourceProductionRates(state);
    const moraleRate = getHourlyRateLabel(rates.morale);
    const moraleRateColor = getRateColor(rates.morale);

    const profileKind = getDecisionProfileKind(state);
    const profileLabel = t ? getDecisionProfileOverallLabel(state, t) : undefined;
    const profileTooltip = t && profileLabel
      ? `${t.ui.leadershipProfile ?? "Leadership profile"}\n${profileLabel}`
      : undefined;

    const topStripBottom = this.drawTopStrip(width);
    const topRowY = 8;
    const topPanelsY = topStripBottom + 10;
    drawHudLeftArea(this.hudPanelsHost(), height);

    this.drawBrand(
      state.communityName,
      decisionProfileIconByKind[profileKind],
      profileTooltip,
      this.getBrandAlerts(state, t),
      20,
      topRowY - 2,
    );
    this.drawTopPills(
      [
        {
          iconId: "clock",
          label: `${t?.ui.day ?? "Day"} ${day} / ${clock}`,
          tooltip: this.getDaylightTooltip(state, t),
        },
        {
          iconId: "people",
          label: `${population}`,
          tooltip: t
            ? `${t.ui.populationTooltip}\n${t.ui.housed}: ${housing.housed}\n${t.ui.homeless}: ${housing.homeless}`
            : undefined,
          action: { action: "open-survivor-overview" },
        },
        { iconId: "shield", label: `${Math.round(this.getDefenseScore(state))}`, tooltip: t?.ui.defenseTooltip },
        {
          iconId: "morale",
          label: `${Math.floor(state.resources.morale)}%`,
          sublabel: moraleRate,
          sublabelFill: moraleRateColor,
          tooltip: t ? `${t.resources.morale}: ${t.resourceDescriptions.morale}` : undefined,
          action: { action: "open-resource-breakdown", resourceId: "morale" },
        },
      ],
      width,
      topRowY,
    );
    this.drawResourcePills(state, translations, width, rates, topRowY);
    drawHudPanels(this.hudPanelsHost(), state, translations, width, height, topPanelsY);
  }

  private hudPanelsHost() {
    return {
      hudLayer: this.hudLayer,
      getLogScrollY: () => this.logScrollY,
      setLogScrollY: (value: number) => {
        this.logScrollY = value;
      },
      setLogScrollMax: (value: number) => {
        this.logScrollMax = value;
      },
      setLogScrollArea: (value: Bounds | null) => {
        this.logScrollArea = value;
      },
      drawIcon: (parent: Container, iconId: string, x: number, y: number, size: number) =>
        this.drawIcon(parent, iconId, x, y, size),
      drawText: (
        parent: Container,
        text: string,
        x: number,
        y: number,
        options: {
          fill: number;
          fontSize: number;
          fontWeight?: TextStyleFontWeight;
          alpha?: number;
          align?: "left" | "center" | "right";
          wordWrap?: boolean;
          wordWrapWidth?: number;
          lineHeight?: number;
        },
      ) => this.drawText(parent, text, x, y, options),
      drawPanel: (
        parent: Container,
        x: number,
        y: number,
        width: number,
        height: number,
        fillAlpha?: number,
        cornerRadius?: number,
      ) => this.drawPanel(parent, x, y, width, height, fillAlpha, cornerRadius),
      bindAction: (target: Container, detail: PixiActionDetail) => this.bindAction(target, detail),
      registerHudInteractionArea: (x: number, y: number, width: number, height: number, padding = 0) =>
        this.registerHudInteractionArea(x, y, width, height, padding),
      createIconButton: (
        parent: Container,
        iconId: string,
        x: number,
        y: number,
        width: number,
        height: number,
        detail: PixiActionDetail,
        tooltip?: string,
        active = false,
      ) => this.createIconButton(parent, iconId, x, y, width, height, detail, tooltip, active),
      createHudButton: (
        parent: Container,
        label: string,
        x: number,
        y: number,
        width: number,
        height: number,
        detail: PixiActionDetail,
        active = false,
      ) => this.createHudButton(parent, label, x, y, width, height, detail, active),
      createCircularActionButton: (
        parent: Container,
        iconId: string,
        x: number,
        y: number,
        radius: number,
        detail: PixiActionDetail,
        tooltip: string,
        active = false,
        disabled = false,
      ) => this.createCircularActionButton(parent, iconId, x, y, radius, detail, tooltip, active, disabled),
      getFormattedLogEntries: (state: GameState, translations: TranslationPack | undefined) =>
        this.getFormattedLogEntries(state, translations),
      wrapLogText: (text: string, fontWeight: TextStyleFontWeight, maxWidth: number) =>
        this.wrapLogText(text, fontWeight, maxWidth),
      drawRewardLine: (parent: Container, bag: ResourceBag, translations: TranslationPack, x: number, y: number) =>
        this.drawRewardLine(parent, bag, translations, x, y),
    };
  }

  private resultModalsHost() {
    return {
      hudLayer: this.hudLayer,
      drawModalBackdrop: (
        overlay: Container,
        width: number,
        height: number,
        closeAction?: PixiActionDetail,
        blockClose = false,
      ) => this.drawModalBackdrop(overlay, width, height, closeAction, blockClose),
      measureWrappedTextHeight: (
        text: string,
        fontSize: number,
        fontWeight: TextStyleFontWeight,
        maxWidth: number,
      ) => this.measureWrappedTextHeight(text, fontSize, fontWeight, maxWidth),
      drawPanel: (
        parent: Container,
        x: number,
        y: number,
        width: number,
        height: number,
        fillAlpha?: number,
        cornerRadius?: number,
      ) => this.drawPanel(parent, x, y, width, height, fillAlpha, cornerRadius),
      drawOverlayHeader: (
        parent: Container,
        panelWidth: number,
        translations: TranslationPack,
        options: {
          iconId: string;
          title: string;
          closeAction?: PixiActionDetail;
          kicker?: string;
          subtitle?: string;
          rightText?: string;
        },
      ) => this.drawOverlayHeader(parent, panelWidth, translations, options),
      drawText: (
        parent: Container,
        text: string,
        x: number,
        y: number,
        options: {
          fill: number;
          fontSize: number;
          fontWeight?: TextStyleFontWeight;
          alpha?: number;
          align?: "left" | "center" | "right";
          wordWrap?: boolean;
          wordWrapWidth?: number;
          lineHeight?: number;
        },
      ) => this.drawText(parent, text, x, y, options),
      createModalButton: (
        parent: Container,
        label: string,
        x: number,
        y: number,
        width: number,
        height: number,
        detail: PixiActionDetail,
        disabled = false,
        tooltip?: string,
      ) => this.createModalButton(parent, label, x, y, width, height, detail, disabled, tooltip),
      drawDecisionImpactChips: (
        parent: Container,
        impacts: EffectLine[],
        rightX: number,
        y: number,
      ) => this.drawDecisionImpactChips(parent, impacts, rightX, y),
    };
  }

  private infoPanelsHost() {
    return {
      hudLayer: this.hudLayer,
      requestRender: () => this.requestRender(),
      drawModalBackdrop: (
        overlay: Container,
        width: number,
        height: number,
        closeAction?: PixiActionDetail,
        blockClose = false,
      ) => this.drawModalBackdrop(overlay, width, height, closeAction, blockClose),
      drawPanel: (
        parent: Container,
        x: number,
        y: number,
        width: number,
        height: number,
        fillAlpha?: number,
        cornerRadius?: number,
      ) => this.drawPanel(parent, x, y, width, height, fillAlpha, cornerRadius),
      drawOverlayHeader: (
        parent: Container,
        panelWidth: number,
        translations: TranslationPack,
        options: {
          iconId: string;
          title: string;
          closeAction?: PixiActionDetail;
          kicker?: string;
          subtitle?: string;
          rightText?: string;
        },
      ) => this.drawOverlayHeader(parent, panelWidth, translations, options),
      drawText: (
        parent: Container,
        text: string,
        x: number,
        y: number,
        options: {
          fill: number;
          fontSize: number;
          fontWeight?: TextStyleFontWeight;
          alpha?: number;
          align?: "left" | "center" | "right";
          wordWrap?: boolean;
          wordWrapWidth?: number;
          lineHeight?: number;
        },
      ) => this.drawText(parent, text, x, y, options),
      drawIcon: (parent: Container, iconId: string, x: number, y: number, size: number) =>
        this.drawIcon(parent, iconId, x, y, size),
      drawTabs: <T extends string>(
        parent: Container,
        tabs: Array<TabItem<T>>,
        options: TabOptions<T>,
      ) => this.drawTabs(parent, tabs, options),
      createModalButton: (
        parent: Container,
        label: string,
        x: number,
        y: number,
        width: number,
        height: number,
        detail: PixiActionDetail,
        disabled = false,
        tooltip?: string,
      ) => this.createModalButton(parent, label, x, y, width, height, detail, disabled, tooltip),
      bindLocalAction: (target: Container, onTap: () => void) => this.bindLocalAction(target, onTap),
      bindAction: (target: Container, detail: PixiActionDetail) => this.bindAction(target, detail),
      bindTooltip: (target: Container, text: string) => this.bindTooltip(target, text),
      measureWrappedTextHeight: (
        text: string,
        fontSize: number,
        fontWeight: TextStyleFontWeight,
        maxWidth: number,
      ) => this.measureWrappedTextHeight(text, fontSize, fontWeight, maxWidth),
      drawDecisionImpactChips: (
        parent: Container,
        impacts: EffectLine[],
        rightX: number,
        y: number,
      ) => this.drawDecisionImpactChips(parent, impacts, rightX, y),
      drawRewardLine: (parent: Container, bag: ResourceBag, translations: TranslationPack, x: number, y: number) =>
        this.drawRewardLine(parent, bag, translations, x, y),
      getTroopHousingCapacity: (state: GameState) => this.getTroopHousingCapacity(state),
      getDecisionHistoryScrollY: () => this.decisionHistoryScrollY,
      setDecisionHistoryScrollY: (value: number) => {
        this.decisionHistoryScrollY = value;
      },
      setDecisionHistoryScrollMax: (value: number) => {
        this.decisionHistoryScrollMax = value;
      },
      setDecisionHistoryScrollArea: (value: Bounds | null) => {
        this.decisionHistoryScrollArea = value;
      },
      getSelectedDecisionHistoryIndex: () => this.selectedDecisionHistoryIndex,
      setSelectedDecisionHistoryIndex: (value: number | null) => {
        this.selectedDecisionHistoryIndex = value;
      },
      getActiveResourceBreakdownTab: () => this.activeResourceBreakdownTab,
      setActiveResourceBreakdownTab: (value: ResourceBreakdownTab) => {
        this.activeResourceBreakdownTab = value;
      },
      getResourceBreakdownScrollY: () => this.resourceBreakdownScrollY,
      setResourceBreakdownScrollY: (value: number) => {
        this.resourceBreakdownScrollY = value;
      },
      setResourceBreakdownScrollMax: (value: number) => {
        this.resourceBreakdownScrollMax = value;
      },
      setResourceBreakdownScrollArea: (value: Bounds | null) => {
        this.resourceBreakdownScrollArea = value;
      },
      getResourceBreakdownScrollResourceId: () => this.resourceBreakdownScrollResourceId,
      setResourceBreakdownScrollResourceId: (value: ResourceId | null) => {
        this.resourceBreakdownScrollResourceId = value;
      },
      getResourceBreakdownScrollTab: () => this.resourceBreakdownScrollTab,
      setResourceBreakdownScrollTab: (value: ResourceBreakdownTab) => {
        this.resourceBreakdownScrollTab = value;
      },
    };
  }

  private villageModalsHost() {
    return {
      hudLayer: this.hudLayer,
      drawModalBackdrop: (
        overlay: Container,
        width: number,
        height: number,
        closeAction?: PixiActionDetail,
        blockClose = false,
      ) => this.drawModalBackdrop(overlay, width, height, closeAction, blockClose),
      drawPanel: (
        parent: Container,
        x: number,
        y: number,
        width: number,
        height: number,
        fillAlpha?: number,
        cornerRadius?: number,
      ) => this.drawPanel(parent, x, y, width, height, fillAlpha, cornerRadius),
      drawOverlayHeader: (
        parent: Container,
        panelWidth: number,
        translations: TranslationPack,
        options: {
          iconId: string;
          title: string;
          closeAction?: PixiActionDetail;
          kicker?: string;
          subtitle?: string;
          rightText?: string;
        },
      ) => this.drawOverlayHeader(parent, panelWidth, translations, options),
      createIconButton: (
        parent: Container,
        iconId: string,
        x: number,
        y: number,
        width: number,
        height: number,
        detail: PixiActionDetail,
        tooltip?: string,
        active = false,
      ) => this.createIconButton(parent, iconId, x, y, width, height, detail, tooltip, active),
      drawText: (
        parent: Container,
        text: string,
        x: number,
        y: number,
        options: {
          fill: number;
          fontSize: number;
          fontWeight?: TextStyleFontWeight;
          alpha?: number;
          align?: "left" | "center" | "right";
          wordWrap?: boolean;
          wordWrapWidth?: number;
          lineHeight?: number;
        },
      ) => this.drawText(parent, text, x, y, options),
      drawCenteredText: (
        parent: Container,
        text: string,
        x: number,
        y: number,
        options: {
          fill: number;
          fontSize: number;
          fontWeight?: TextStyleFontWeight;
          alpha?: number;
        },
      ) => this.drawCenteredText(parent, text, x, y, options),
      createLocalModalButton: (
        parent: Container,
        label: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onTap: () => void,
        disabled = false,
      ) => this.createLocalModalButton(parent, label, x, y, width, height, onTap, disabled),
      createRectButton: (parent: Container, options: RectButtonOptions) => this.createRectButton(parent, options),
      drawBuildChoices: (
        parent: Container,
        plotId: string,
        buildableBuildings: BuildingId[],
        state: GameState,
        translations: TranslationPack,
        modalWidth: number,
        modalHeight: number,
      ) => drawBuildChoicesModal(
        this.buildingModalsHost(),
        parent,
        plotId,
        buildableBuildings,
        state,
        translations,
        modalWidth,
        modalHeight,
      ),
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
      ) => drawBuildingDetailModal(
        this.buildingModalsHost(),
        parent,
        buildingId,
        level,
        upgradingRemaining,
        maxLevel,
        state,
        translations,
        modalWidth,
        modalHeight,
      ),
      getResourceSiteTroopCount: (siteId: string, availableTroops: number, minimumTroops: number) =>
        this.getResourceSiteTroopCount(siteId, availableTroops, minimumTroops),
      setResourceSiteTroopCount: (
        siteId: string,
        nextValue: number,
        availableTroops: number,
        minimumTroops: number,
      ) => this.setResourceSiteTroopCount(siteId, nextValue, availableTroops, minimumTroops),
    };
  }

  private buildingModalsHost() {
    return {
      requestRender: () => this.requestRender(),
      playTabSwitchSound: () => this.playTabSwitchSound(),
      drawText: (
        parent: Container,
        text: string,
        x: number,
        y: number,
        options: {
          fill: number;
          fontSize: number;
          fontWeight?: TextStyleFontWeight;
          alpha?: number;
          align?: "left" | "center" | "right";
          wordWrap?: boolean;
          wordWrapWidth?: number;
          lineHeight?: number;
        },
      ) => this.drawText(parent, text, x, y, options),
      drawCenteredText: (
        parent: Container,
        text: string,
        x: number,
        y: number,
        options: {
          fill: number;
          fontSize: number;
          fontWeight?: TextStyleFontWeight;
          alpha?: number;
        },
      ) => this.drawCenteredText(parent, text, x, y, options),
      drawIcon: (parent: Container, iconId: string, x: number, y: number, size: number) =>
        this.drawIcon(parent, iconId, x, y, size),
      drawPanel: (
        parent: Container,
        x: number,
        y: number,
        width: number,
        height: number,
        fillAlpha?: number,
        cornerRadius?: number,
      ) => this.drawPanel(parent, x, y, width, height, fillAlpha, cornerRadius),
      drawTabs: <T extends string>(
        parent: Container,
        tabs: Array<TabItem<T>>,
        options: TabOptions<T>,
      ) => this.drawTabs(parent, tabs, options),
      bindTooltip: (target: Container, text: string) => this.bindTooltip(target, text),
      createRectButton: (parent: Container, options: RectButtonOptions) => this.createRectButton(parent, options),
      createModalButton: (
        parent: Container,
        label: string,
        x: number,
        y: number,
        width: number,
        height: number,
        detail: PixiActionDetail,
        disabled = false,
        tooltip?: string,
      ) => this.createModalButton(parent, label, x, y, width, height, detail, disabled, tooltip),
      createLocalModalButton: (
        parent: Container,
        label: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onTap: () => void,
        disabled = false,
      ) => this.createLocalModalButton(parent, label, x, y, width, height, onTap, disabled),
      createBuildingSprite: (buildingId: BuildingId, level: number, built: boolean) =>
        this.createBuildingSprite(buildingId, level, built),
      fitSprite: (sprite: Sprite, maxWidth: number, maxHeight: number) => this.fitSprite(sprite, maxWidth, maxHeight),

      getBuildChoicesScrollPlotId: () => this.buildChoicesScrollPlotId,
      setBuildChoicesScrollPlotId: (value: string | null) => {
        this.buildChoicesScrollPlotId = value;
      },
      getBuildChoicesScrollY: () => this.buildChoicesScrollY,
      setBuildChoicesScrollY: (value: number) => {
        this.buildChoicesScrollY = value;
      },
      setBuildChoicesScrollMax: (value: number) => {
        this.buildChoicesScrollMax = value;
      },
      setBuildChoicesScrollArea: (value: Bounds | null) => {
        this.buildChoicesScrollArea = value;
      },
      getActiveBuildCategory: () => this.activeBuildCategory,
      setActiveBuildCategory: (value: BuildingCategory) => {
        this.activeBuildCategory = value;
      },

      getMarketFromResource: () => this.marketFromResource,
      setMarketFromResource: (value: MarketResourceId) => {
        this.marketFromResource = value;
      },
      getMarketToResource: () => this.marketToResource,
      setMarketToResource: (value: MarketResourceId) => {
        this.marketToResource = value;
      },
      getMarketAmount: () => this.marketAmount,
      setMarketAmount: (value: number) => {
        this.marketAmount = value;
      },
      getBarracksTroopCount: () => this.barracksTroopCount,
      setBarracksTroopCount: (value: number) => {
        this.barracksTroopCount = value;
      },
    };
  }

  private worldRendererHost() {
    return {
      cameraStaticLayer: this.cameraStaticLayer,
      cameraDynamicLayer: this.cameraDynamicLayer,
      backgroundLayer: this.backgroundLayer,
      layout: this.layout,
      activeModalPlotId: this.activeModalPlotId,
      drawIcon: (parent: Container, iconId: string, x: number, y: number, size: number) =>
        this.drawIcon(parent, iconId, x, y, size),
      drawText: (
        parent: Container,
        text: string,
        x: number,
        y: number,
        options: {
          fill: number;
          fontSize: number;
          fontWeight?: TextStyleFontWeight;
          alpha?: number;
          align?: "left" | "center" | "right";
          wordWrap?: boolean;
          wordWrapWidth?: number;
          lineHeight?: number;
        },
      ) => this.drawText(parent, text, x, y, options),
      bindTooltip: (target: Container, text: string) => this.bindTooltip(target, text),
      createTerrainSprite: (textureKey: string) => this.ambientEffects.createTerrainSprite(
        textureKey,
        (key) => this.assets.getTerrainTileAnimationFrames(key),
        (key) => this.assets.getTerrainTileTexture(key),
      ),
      createBuildingSprite: (buildingId: BuildingId, level: number, built: boolean) =>
        this.createBuildingSprite(buildingId, level, built),
      fitSprite: (sprite: Sprite, maxWidth: number, maxHeight: number) => this.fitSprite(sprite, maxWidth, maxHeight),
      getPlotBounds: (plot: Pick<VillagePlotDefinition, "x" | "y" | "width" | "height">) =>
        this.getPlotBounds(plot),
      addPalisadeTooltip: (
        plot: VillagePlotDefinition,
        selected: boolean,
        level: number,
        upgradingRemaining: number,
        name: string,
      ) => this.addPalisadeTooltip(plot, selected, level, upgradingRemaining, name),
      drawBuildingLevelBadge: (
        parent: Container,
        level: number,
        x: number,
        y: number,
        translations?: TranslationPack,
        buildingName?: string,
      ) => this.drawBuildingLevelBadge(parent, level, x, y, translations, buildingName),
      drawBuildingWorkerBadge: (
        parent: Container,
        buildingId: BuildingId,
        workers: number,
        workerLimit: number,
        bounds: Bounds,
        translations?: TranslationPack,
      ) => this.drawBuildingWorkerBadge(parent, buildingId, workers, workerLimit, bounds, translations),
      drawConstructionCountdown: (
        parent: Container,
        remainingSeconds: number,
        x: number,
        y: number,
        width: number,
        translations?: TranslationPack,
      ) => this.drawConstructionCountdown(parent, remainingSeconds, x, y, width, translations),
      drawPowerWarning: (parent: Container, bounds: Bounds) => this.drawPowerWarning(parent, bounds),
    };
  }

  private drawTopStrip(width: number): number {
    const strip = new Graphics();
    strip
      .rect(0, 0, width, HUD_TOP_STRIP_HEIGHT)
      .fill({ color: 0x151812, alpha: 1 });
    this.hudLayer.addChild(strip);
    return HUD_TOP_STRIP_HEIGHT;
  }

  private drawBrand(
    title: string,
    iconId: string,
    tooltip?: string,
    alerts: BrandAlert[] = [],
    x = 28,
    y = 22,
  ): void {
    const layer = new Container();
    layer.x = x;
    layer.y = y;
    this.hudLayer.addChild(layer);

    const mark = new Graphics();
    mark
      .rect(0, 0, 44, 44)
      .fill({ color: 0x141611, alpha: 0.62 });
    layer.addChild(mark);
    this.drawIcon(layer, iconId, 22, 22, 24);
    if (tooltip) {
      mark.hitArea = new Rectangle(0, 0, 44, 44);
      this.bindTooltip(mark, tooltip);
    }
    const titleLabel = this.drawText(layer, title.toUpperCase(), 56, 2, {
      fill: 0xf5efdf,
      fontSize: 25,
      fontWeight: "900",
    });
    const titleBottom = titleLabel.y + titleLabel.height;

    this.drawBrandAlerts(layer, alerts, 56, titleBottom + 4);
  }

  private drawBrandAlerts(parent: Container, alerts: BrandAlert[], x: number, y: number): void {
    let cursorX = x;

    for (const alert of alerts.slice(0, 4)) {
      const badge = this.createBrandAlertBadge(alert);
      badge.x = cursorX;
      badge.y = y;
      parent.addChild(badge);
      cursorX += badge.width + 6;
    }
  }

  private createBrandAlertBadge(alert: BrandAlert): Container {
    const group = new Container();
    const label = alert.label
      ? new Text({
        text: alert.label,
        style: {
          fill: 0xf5efdf,
          fontFamily: HUD_FONT_FAMILY,
          fontSize: 11,
          fontWeight: normalizeHudFontWeight("900"),
        },
      })
      : null;
    const width = label ? Math.max(48, label.width + 32) : 28;
    const height = 22;
    const colors = this.getBrandAlertColors(alert.tone);
    const background = new Graphics();
    background.rect(0, 0, width, height)
      .fill({ color: colors.fill, alpha: 0.82 });
    group.addChild(background);
    this.drawIcon(group, alert.iconId, 12, height / 2, 13);

    if (label) {
      label.x = 22;
      label.y = 6;
      group.addChild(label);
    }

    if (alert.tooltip) {
      group.hitArea = new Rectangle(0, 0, width, height);
      this.bindTooltip(group, alert.tooltip);
    }

    if (alert.action) {
      this.bindAction(group, alert.action);
    }

    return group;
  }

  private getBrandAlertColors(tone: BrandAlert["tone"]): { fill: number } {
    if (tone === "cold") {
      return { fill: 0x12232d };
    }

    if (tone === "danger") {
      return { fill: 0x2c1715 };
    }

    if (tone === "warning") {
      return { fill: 0x2a2412 };
    }

    return { fill: 0x141611 };
  }

  private getBrandAlerts(state: GameState, translations?: TranslationPack): BrandAlert[] {
    const alerts: BrandAlert[] = [];
    const condition = state.environment.condition;
    const crisis = state.environment.activeCrisis;

    if (crisis?.kind === "shelter") {
      const remaining = formatScoutingRemaining(Math.max(0, crisis.deadlineAt - state.elapsedSeconds));
      const tooltip = translations
        ? `${translations.ui.shelterCrisis}: ${remaining}`
        : `Shelter crisis: ${remaining}`;

      alerts.push({
        iconId: "crisis-shelter",
        label: remaining,
        tooltip,
        tone: "warning",
      });
    }

    if (condition !== "stable") {
      const definition = getEnvironmentDefinition(condition);
      const conditionLabel = translations?.ui[definition.labelKey] ?? definition.id;
      const remaining = formatScoutingRemaining(Math.max(0, state.environment.endsAt - state.elapsedSeconds));
      const tooltip = translations
        ? [
          `${translations.ui.environment}: ${conditionLabel}`,
          `${translations.ui.environmentIntensity}: ${state.environment.intensity}`,
          `${translations.ui.environmentEndsIn}: ${remaining}`,
        ].join("\n")
        : conditionLabel;

      alerts.push({
        iconId: environmentAlertIconByCondition[condition],
        tooltip,
        action: { action: "open-weather-overview" },
        tone: environmentAlertToneByCondition[condition],
      });
      alerts.push({
        iconId: "crisis-countdown",
        label: remaining,
        tooltip,
        action: { action: "open-weather-overview" },
        tone: condition === "radiation" ? "danger" : "warning",
      });
    }

    const housing = getHousingStatus(state);
    if (housing.homeless > 0) {
      const tooltip = translations
        ? [
          `${translations.ui.homeless}: ${housing.homeless}`,
          `${translations.ui.housed}: ${housing.housed}/${housing.civilianCapacity + this.getTroopHousingCapacity(state)}`,
          translations.ui.housingTooltip,
        ].join("\n")
        : `Homeless: ${housing.homeless}`;

      alerts.push({
        iconId: "crisis-homeless",
        label: `${housing.homeless}`,
        tooltip,
        tone: "warning",
      });
    }

    if (state.health.injured > 0) {
      const tooltip = translations
        ? [
          `${translations.roles.injured}: ${state.health.injured}`,
          `${translations.buildings.clinic.name}: ${translations.buildings.clinic.description}`,
        ].join("\n")
        : `Injured: ${state.health.injured}`;

      alerts.push({
        iconId: "crisis-injured",
        label: `${state.health.injured}`,
        tooltip,
        tone: "danger",
      });
    }

    return alerts;
  }

  private getDaylightTooltip(state: GameState, translations?: TranslationPack): string | undefined {
    if (!translations) {
      return undefined;
    }

    const daylight = getDaylightState(state.elapsedSeconds);
    const phaseLabel = translations.ui[`daylight${capitalize(daylight.phase)}`] ?? daylight.phase;

    return [
      translations.ui.dayTooltip,
      `${translations.ui.daylightPhase ?? "Light"}: ${phaseLabel}`,
      `${translations.ui.daylightSchedule ?? "Day"}: ${DAY_START_HOUR}:00-${NIGHT_START_HOUR}:00`,
    ].join("\n");
  }

  private drawTopPills(
    items: Array<{
      iconId: string;
      label: string;
      tooltip?: string;
      sublabel?: string;
      sublabelFill?: number;
      action?: PixiActionDetail;
    }>,
    width: number,
    y: number,
  ): void {
    const group = new Container();
    group.y = y;
    this.hudLayer.addChild(group);

    let x = 0;
    for (const item of items) {
      const pill = this.createPill(
        item.label,
        item.iconId,
        item.tooltip,
        item.sublabel,
        item.sublabelFill,
        item.action,
        0xe9e4d2,
        true,
      );
      pill.x = x;
      group.addChild(pill);
      x += pill.width + 6;
    }

    group.x = Math.max(300, (width - x) / 2);
    this.registerHudInteractionForContainer(group, 6);
  }

  private drawResourcePills(
    state: GameState,
    translations: TranslationPack | undefined,
    width: number,
    rates: Record<ResourceId, number>,
    y: number,
  ): void {
    const group = new Container();
    group.y = y;
    this.hudLayer.addChild(group);

    let x = 0;
    for (const resource of resourceDefinitions.filter((definition) => definition.id !== "morale")) {
      const label = `${Math.floor(state.resources[resource.id])}/${Math.floor(state.capacities[resource.id])}`;
      const stockRatio = state.capacities[resource.id] > 0
        ? state.resources[resource.id] / state.capacities[resource.id]
        : 1;
      const rate = rates[resource.id];
      const rateLabel = getHourlyRateLabel(rate);
      const tooltip = translations
        ? `${translations.resources[resource.id]}: ${translations.resourceDescriptions[resource.id]}`
        : resource.id;
      const pill = this.createPill(
        label,
        resource.id,
        tooltip,
        rateLabel,
        getRateColor(rate),
        { action: "open-resource-breakdown", resourceId: resource.id },
        stockRatio < 0.2 ? 0xff6f7d : undefined,
        true,
      );
      pill.x = x;
      group.addChild(pill);
      x += pill.width + 6;
    }

    group.x = Math.max(18, width - x - 18);
    this.registerHudInteractionForContainer(group, 6);
  }

  private getTotalResourceProductionRates(state: GameState): Record<ResourceId, number> {
    const rates = getResourceProductionRates(state);
    const multiplier = getGlobalProductionMultiplier(state);

    for (const site of state.resourceSites) {
      if (!site.captured || site.assignedWorkers <= 0) {
        continue;
      }

      rates[site.resourceId] += site.yieldPerWorker * site.assignedWorkers * multiplier;
    }

    return rates;
  }

  private drawModalBackdrop(
    overlay: Container,
    width: number,
    height: number,
    closeAction?: PixiActionDetail,
    blockClose = false,
  ): void {
    const backdrop = new Graphics();
    backdrop.rect(0, 0, width, height).fill({ color: 0x030405, alpha: MODAL_BACKDROP_ALPHA });

    if (blockClose) {
      backdrop.eventMode = "static";
      backdrop.on("pointerdown", (event) => {
        event.stopPropagation();
      });
    } else if (closeAction) {
      this.bindAction(backdrop, closeAction);
    }

    overlay.addChild(backdrop);
  }

  private drawOverlayHeader(
    parent: Container,
    panelWidth: number,
    translations: TranslationPack,
    options: {
      iconId: string;
      title: string;
      closeAction?: PixiActionDetail;
      kicker?: string;
      subtitle?: string;
      rightText?: string;
    },
  ): number {
    if (options.closeAction) {
      this.createIconButton(
        parent,
        "close",
        panelWidth - 54,
        18,
        34,
        34,
        options.closeAction,
        translations.ui.close,
      );
    }

    const badge = new Container();
    badge.x = 22;
    badge.y = 18;
    parent.addChild(badge);
    const badgeBox = new Graphics();
    badgeBox.rect(0, 0, 42, 42)
      .fill({ color: 0x11140f, alpha: 0.9 });
    badge.addChild(badgeBox);
    this.drawIcon(badge, options.iconId, 21, 21, 22);

    if (options.kicker) {
      this.drawText(parent, options.kicker, 72, 18, {
        fill: 0xd8c890,
        fontSize: 12,
        fontWeight: "900",
      });
    }

    const titleY = options.kicker ? 36 : 26;
    const titleLabel = this.drawText(parent, options.title, 72, titleY, {
      fill: 0xf5efdf,
      fontSize: 22,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: panelWidth - 152,
    });
    let contentY = titleLabel.y + titleLabel.height + 8;

    if (options.subtitle) {
      const subtitleLabel = this.drawText(parent, options.subtitle, 72, contentY, {
        fill: 0xaeb6ad,
        fontSize: 11,
        fontWeight: "800",
        wordWrap: true,
        wordWrapWidth: panelWidth - 152,
      });
      contentY = subtitleLabel.y + subtitleLabel.height + 8;
    }

    if (options.rightText) {
      this.drawText(parent, options.rightText, panelWidth - 72, 23, {
        fill: 0xf1df9a,
        fontSize: 18,
        fontWeight: "900",
      }).anchor.set(1, 0);
    }

    return Math.max(72, contentY);
  }

  private getResourceSiteTroopCount(
    siteId: string,
    availableTroops: number,
    minimumTroops: number,
  ): number {
    const maxTroops = Math.max(1, availableTroops);
    const desiredDefault = Math.max(1, Math.min(maxTroops, minimumTroops));
    const current = this.resourceSiteTroopCountById.get(siteId) ?? desiredDefault;
    const normalized = Math.max(1, Math.min(maxTroops, Math.floor(current)));
    this.resourceSiteTroopCountById.set(siteId, normalized);
    return normalized;
  }

  private setResourceSiteTroopCount(
    siteId: string,
    nextValue: number,
    availableTroops: number,
    minimumTroops: number,
  ): void {
    const maxTroops = Math.max(1, availableTroops);
    const fallback = Math.max(1, Math.min(maxTroops, minimumTroops));
    const normalized = Math.max(1, Math.min(maxTroops, Math.floor(nextValue || fallback)));
    this.resourceSiteTroopCountById.set(siteId, normalized);
    this.requestRender();
  }

  private createModalButton(
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    detail: PixiActionDetail,
    disabled = false,
    tooltip?: string,
  ): Container {
    return this.createRectButton(parent, {
      label,
      x,
      y,
      width,
      height,
      detail,
      disabled,
      tooltip,
      tone: "primary",
      fontSize: 12,
      fontWeight: "900",
    });
  }

  private drawRewardLine(
    parent: Container,
    bag: ResourceBag,
    translations: TranslationPack,
    x: number,
    y: number,
  ): number {
    let offset = 0;

    for (const [resourceId, amount] of Object.entries(bag)) {
      if ((amount ?? 0) <= 0) {
        continue;
      }

      const typedResourceId = resourceId as ResourceId;
      const roundedAmount = Math.ceil(amount ?? 0);
      const token = new Container();
      token.x = x + offset;
      token.y = y;
      parent.addChild(token);

      this.drawIcon(token, typedResourceId, 8, 8, 14);
      const label = this.drawText(token, `+${roundedAmount}`, 20, 0, {
        fill: 0xf1df9a,
        fontSize: 12,
        fontWeight: "900",
      });
      this.bindTooltip(
        token,
        `${translations.resources[typedResourceId]}: ${translations.resourceDescriptions[typedResourceId]}`,
      );
      token.hitArea = new Rectangle(0, -2, label.width + 26, 20);

      offset += token.width + 8;
    }

    return offset;
  }

  private createLocalModalButton(
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    onTap: () => void,
    disabled = false,
  ): Container {
    return this.createRectButton(parent, {
      label,
      x,
      y,
      width,
      height,
      onTap,
      disabled,
      tone: "secondary",
      fontSize: 14,
      fontWeight: "900",
    });
  }

  private createPill(
    label: string,
    iconId: string,
    tooltip?: string,
    sublabel?: string,
    sublabelFill = 0xaeb4b8,
    action?: PixiActionDetail,
    labelFill = 0xe9e4d2,
    compact = false,
  ): Container {
    return createPillPrimitive(
      {
        drawIcon: (parent, tokenIconId, x, y, size) => this.drawIcon(parent, tokenIconId, x, y, size),
        bindTooltip: (target, text) => this.bindTooltip(target, text),
        bindAction: (target, detail) => this.bindAction(target, detail),
        bindLocalAction: (target, onTap) => this.bindLocalAction(target, onTap),
        consumeHostClick: () => this.consumeHostClick(),
      },
      drawTextPrimitive,
      {
        label,
        iconId,
        tooltip,
        sublabel,
        sublabelFill,
        action,
        labelFill,
        compact,
      },
    );
  }

  private createHudButton(
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    detail: PixiActionDetail,
    active = false,
  ): Container {
    return this.createRectButton(parent, {
      label,
      x,
      y,
      width,
      height,
      detail,
      active,
      tone: "toolbar",
      fontSize: 13,
      fontWeight: "700",
    });
  }

  private createIconButton(
    parent: Container,
    iconId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    detail: PixiActionDetail,
    tooltip?: string,
    active = false,
  ): Container {
    return this.createRectButton(parent, {
      iconId,
      x,
      y,
      width,
      height,
      detail,
      tooltip,
      active,
      tone: "toolbar",
    });
  }

  private createCircularActionButton(
    parent: Container,
    iconId: string,
    x: number,
    y: number,
    radius: number,
    detail: PixiActionDetail,
    tooltip: string,
    active = false,
    disabled = false,
  ): Container {
    return this.createCircleButton(parent, {
      iconId,
      x,
      y,
      radius,
      detail,
      tooltip,
      active,
      disabled,
    });
  }

  private createRectButton(parent: Container, options: RectButtonOptions): Container {
    return createRectButtonPrimitive(
      {
        drawIcon: (tokenParent, iconId, x, y, size) => this.drawIcon(tokenParent, iconId, x, y, size),
        bindTooltip: (target, text) => this.bindTooltip(target, text),
        bindAction: (target, detail) => this.bindAction(target, detail),
        bindLocalAction: (target, onTap) => this.bindLocalAction(target, onTap),
        consumeHostClick: () => this.consumeHostClick(),
      },
      parent,
      options,
      (labelParent, text, x, y, opts) => this.drawCenteredText(labelParent, text, x, y, opts),
    );
  }

  private createCircleButton(parent: Container, options: CircleButtonOptions): Container {
    return createCircleButtonPrimitive(
      {
        drawIcon: (tokenParent, iconId, x, y, size) => this.drawIcon(tokenParent, iconId, x, y, size),
        bindTooltip: (target, text) => this.bindTooltip(target, text),
        bindAction: (target, detail) => this.bindAction(target, detail),
        bindLocalAction: (target, onTap) => this.bindLocalAction(target, onTap),
        consumeHostClick: () => this.consumeHostClick(),
      },
      parent,
      options,
    );
  }

  private drawDecisionImpactChips(
    parent: Container,
    impacts: EffectLine[],
    rightX: number,
    y: number,
  ): void {
    let cursorX = rightX;

    for (const impact of [...impacts].reverse()) {
      const chip = new Container();
      const value = this.drawText(chip, impact.value, 24, 4, {
        fill: impact.negative ? 0xff9c8f : 0x9ed99b,
        fontSize: 11,
        fontWeight: "900",
      });
      const chipWidth = Math.max(42, 32 + value.width);
      const background = new Graphics();
      background.rect(0, 0, chipWidth, 22)
        .fill({ color: impact.negative ? 0x291513 : 0x122117, alpha: 0.84 });
      chip.addChildAt(background, 0);
      this.drawIcon(chip, impact.iconId, 13, 11, 13);
      chip.x = cursorX - chipWidth;
      chip.y = y;
      parent.addChild(chip);
      this.bindTooltip(chip, impact.tooltip);
      cursorX -= chipWidth + 5;
    }
  }

  private drawTabs<T extends string>(
    parent: Container,
    tabs: Array<TabItem<T>>,
    options: TabOptions<T>,
  ): void {
    let offsetX = 0;
    const gap = options.gap ?? 8;

    tabs.forEach((tab) => {
      const active = tab.id === options.activeId;
      const tabWidth = Math.min(
        options.maxTabWidth ?? Number.POSITIVE_INFINITY,
        Math.max(options.minWidth, tab.label.length * 8 + 34),
      );
      const tabLayer = new Container();
      tabLayer.x = options.x + offsetX;
      tabLayer.y = options.y;
      parent.addChild(tabLayer);

      const box = new Graphics();
      box.rect(0, 0, tabWidth, options.height)
        .fill({ color: active ? 0xe0c46f : 0x151813, alpha: active ? 1 : 0.78 });
      tabLayer.addChild(box);
      this.drawCenteredText(tabLayer, tab.label, tabWidth / 2, options.height / 2, {
        fill: active ? 0x11140f : 0xd8d2bd,
        fontSize: 12,
        fontWeight: "900",
      });

      if (!active) {
        this.bindLocalAction(tabLayer, () => {
          this.playTabSwitchSound();
          options.onSelect(tab.id);
        });
      }

      offsetX += tabWidth + gap;
      if (options.maxWidth !== undefined && offsetX > options.maxWidth) {
        tabLayer.visible = false;
      }
    });
  }

  private drawIcon(parent: Container, iconId: string, x: number, y: number, size: number): Container {
    return drawPixiIcon(parent, iconId, x, y, size);
  }

  private drawPanel(
    parent: Container,
    x: number,
    y: number,
    width: number,
    height: number,
    fillAlpha = 0.76,
    _cornerRadius = 0,
  ): Graphics {
    return drawPanelPrimitive(parent, x, y, width, height, fillAlpha);
  }

  private bindAction(target: Container, detail: PixiActionDetail): void {
    target.eventMode = "static";
    target.cursor = "pointer";
    target.on("pointerdown", (event) => {
      event.stopPropagation();
      this.consumeHostClick();
      this.host.dispatchEvent(new CustomEvent<PixiActionDetail>("pixi-action", { detail }));
    });
  }

  private bindLocalAction(target: Container, onTap: () => void): void {
    target.eventMode = "static";
    target.cursor = "pointer";
    target.on("pointerdown", (event) => {
      event.stopPropagation();
      this.consumeHostClick();
      onTap();
    });
  }

  private consumeHostClick(): void {
    this.host.dispatchEvent(new CustomEvent<PixiActionDetail>("pixi-action", {
      detail: { action: "consume-pointer" },
    }));
  }

  private bindTooltip(target: Container, text: string): void {
    target.eventMode = "static";
    target.on("pointerenter", (event) => {
      this.showCanvasTooltip(text, event.global.x, event.global.y);
    });
    target.on("pointermove", (event) => {
      this.showCanvasTooltip(text, event.global.x, event.global.y);
    });
    target.on("pointerleave", () => {
      this.hideCanvasTooltip();
    });
    target.on("pointercancel", () => {
      this.hideCanvasTooltip();
    });
  }

  private showCanvasTooltip(text: string, x: number, y: number): void {
    if (!text) {
      this.hideCanvasTooltip();
      return;
    }

    let shouldRender = !this.tooltipLayer.visible;

    if (this.canvasTooltipText !== text) {
      this.canvasTooltipText = text;
      this.canvasTooltipLabel.text = text;
      this.canvasTooltipWidth = Math.min(320, Math.max(92, this.canvasTooltipLabel.width + 24));
      this.canvasTooltipHeight = Math.max(36, this.canvasTooltipLabel.height + 18);
      this.canvasTooltipPanel.clear();
      this.canvasTooltipPanel.rect(0, 0, this.canvasTooltipWidth, this.canvasTooltipHeight)
        .fill({ color: 0x111519, alpha: 0.96 });
      shouldRender = true;
    }

    this.tooltipLayer.visible = true;
    if (this.positionCanvasTooltip(x, y, this.canvasTooltipWidth, this.canvasTooltipHeight)) {
      shouldRender = true;
    }

    if (shouldRender) {
      this.renderTooltipFrame();
    }
  }

  private positionCanvasTooltip(x: number, y: number, width: number, height: number): boolean {
    const margin = 10;
    const offset = 14;
    const stageWidth = this.host.clientWidth;
    const stageHeight = this.host.clientHeight;
    let nextX = x + offset;
    let nextY = y + offset;

    if (nextX + width > stageWidth - margin) {
      nextX = x - width - offset;
    }

    if (nextY + height > stageHeight - margin) {
      nextY = y - height - offset;
    }

    const clampedX = Math.max(margin, Math.min(stageWidth - width - margin, nextX));
    const clampedY = Math.max(margin, Math.min(stageHeight - height - margin, nextY));
    const moved = (
      Number.isNaN(this.canvasTooltipX) ||
      Number.isNaN(this.canvasTooltipY) ||
      Math.abs(this.canvasTooltipX - clampedX) > TOOLTIP_POSITION_EPSILON ||
      Math.abs(this.canvasTooltipY - clampedY) > TOOLTIP_POSITION_EPSILON
    );

    if (moved) {
      this.tooltipLayer.x = clampedX;
      this.tooltipLayer.y = clampedY;
      this.canvasTooltipX = clampedX;
      this.canvasTooltipY = clampedY;
    }

    return moved;
  }

  private hideCanvasTooltip(): void {
    if (!this.tooltipLayer.visible && !this.canvasTooltipText) {
      return;
    }

    this.tooltipLayer.visible = false;
    this.canvasTooltipText = "";
    this.canvasTooltipX = Number.NaN;
    this.canvasTooltipY = Number.NaN;
    this.renderTooltipFrame();
  }

  private renderTooltipFrame(): void {
    if (this.app) {
      this.app.render();
      return;
    }

    this.requestRender();
  }

  private addPalisadeTooltip(
    plot: VillagePlotDefinition,
    selected: boolean,
    level: number,
    upgradingRemaining: number,
    name: string,
  ): void {
    const bounds = this.getPlotBounds(plot);
    const hitLayer = new Container();
    hitLayer.x = bounds.x;
    hitLayer.y = bounds.y;
    hitLayer.hitArea = {
      contains: (x: number, y: number) =>
        x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height,
    };
    this.bindTooltip(
      hitLayer,
      upgradingTooltip(name, level, upgradingRemaining, "Lvl"),
    );
    this.cameraDynamicLayer.addChild(hitLayer);

    if (!selected) {
      return;
    }

    const marker = new Graphics();
    marker.rect(bounds.x, bounds.y, bounds.width, bounds.height)
      .fill({ color: 0xf6e58d, alpha: 0.18 });
    this.cameraDynamicLayer.addChild(marker);
  }

  private drawPowerWarning(parent: Container, bounds: Bounds): void {
    const badge = new Container();
    badge.x = bounds.width * 0.28;
    badge.y = -bounds.height * 0.44;
    parent.addChild(badge);

    const shadow = new Graphics();
    shadow.circle(2, 3, 16).fill({ color: 0x000000, alpha: 0.42 });
    badge.addChild(shadow);

    const ring = new Graphics();
    ring.circle(0, 0, 16)
      .fill({ color: 0x2a090b, alpha: 0.94 });
    badge.addChild(ring);

    const bolt = new Graphics();
    bolt
      .poly([
        -2, -11,
        8, -11,
        3, -2,
        10, -2,
        -4, 13,
        0, 3,
        -7, 3,
      ])
      .fill({ color: 0xff4f62, alpha: 1 });
    badge.addChild(bolt);
  }

  private drawBuildingLevelBadge(
    parent: Container,
    level: number,
    x: number,
    y: number,
    translations?: TranslationPack,
    buildingName?: string,
  ): void {
    const levelLabel = translations?.ui.level ?? "Lvl";
    const label = `${level}`;
    const radius = level >= 10 ? 16 : 15;
    const badge = new Container();
    badge.x = x;
    badge.y = y;
    parent.addChild(badge);

    const shadow = new Graphics();
    shadow.circle(radius + 2, radius + 3, radius)
      .fill({ color: 0x000000, alpha: 0.34 });
    badge.addChild(shadow);

    const box = new Graphics();
    box.circle(radius, radius, radius)
      .fill({ color: 0x24494d, alpha: 0.95 });
    box.circle(radius - radius * 0.25, radius - radius * 0.28, radius * 0.42)
      .fill({ color: 0xffffff, alpha: 0.08 });
    badge.addChild(box);

    this.drawCenteredText(badge, label, radius, radius, {
      fill: 0xf3fff6,
      fontSize: level >= 10 ? 11 : 12,
      fontWeight: "900",
    });

    this.bindTooltip(
      badge,
      buildingName
        ? `${buildingName}: ${levelLabel} ${level}`
        : `${levelLabel} ${level}`,
    );
  }

  private drawBuildingWorkerBadge(
    parent: Container,
    buildingId: BuildingId,
    workers: number,
    workerLimit: number,
    bounds: Bounds,
    translations?: TranslationPack,
  ): void {
    if (workerLimit <= 0) {
      return;
    }

    const asleep = workers <= 0;
    const label = asleep
      ? translations?.ui.sleeping ?? "Idle"
      : `${workers}/${workerLimit}`;
    const width = asleep ? 68 : 58;
    const height = 24;
    const badge = new Container();
    badge.x = -bounds.width * 0.42;
    badge.y = bounds.height * 0.16;
    parent.addChild(badge);

    const shadow = new Graphics();
    shadow.rect(2, 3, width, height)
      .fill({ color: 0x000000, alpha: 0.32 });
    badge.addChild(shadow);

    const box = new Graphics();
    box.rect(0, 0, width, height)
      .fill({ color: asleep ? 0x1a1d18 : 0x10120e, alpha: 0.94 });
    badge.addChild(box);

    this.drawIcon(badge, asleep ? "clock" : "people", 14, height / 2, 13);
    this.drawText(badge, label, 28, 5, {
      fill: asleep ? 0xaeb4b8 : 0xf1df9a,
      fontSize: 11,
      fontWeight: "900",
    });

    const buildingName = translations?.buildings[buildingId].name ?? buildingById[buildingId].name;
    const workerLabel = translations?.ui.workers ?? "Workers";
    const sleepLabel = translations?.ui.sleeping ?? "Idle";
    const tooltip = asleep
      ? `${buildingName}: ${sleepLabel} (${workerLabel} 0/${workerLimit})`
      : `${buildingName}: ${workerLabel} ${workers}/${workerLimit}`;
    this.bindTooltip(badge, tooltip);
  }

  private drawConstructionCountdown(
    parent: Container,
    remainingSeconds: number,
    x: number,
    y: number,
    width: number,
    translations?: TranslationPack,
  ): void {
    const label = `${Math.ceil(remainingSeconds)}s`;
    const badge = new Container();
    badge.x = x;
    badge.y = y;
    parent.addChild(badge);

    const height = 26;
    const shadow = new Graphics();
    shadow.rect(-width / 2 + 2, 3, width, height)
      .fill({ color: 0x000000, alpha: 0.34 });
    badge.addChild(shadow);

    const box = new Graphics();
    box.rect(-width / 2, 0, width, height)
      .fill({ color: 0x10120e, alpha: 0.94 });
    badge.addChild(box);

    this.drawIcon(badge, "clock", -width / 2 + 15, height / 2, 13);
    this.drawText(badge, label, -width / 2 + 29, 5, {
      fill: 0xf1df9a,
      fontSize: 12,
      fontWeight: "900",
    });
    this.bindTooltip(
      badge,
      `${translations?.ui.buildingQueue ?? "Building queue"}: ${label}`,
    );
  }

  private createBuildingSprite(buildingId: BuildingId, level: number, built: boolean): Sprite {
    const animationFrames = this.assets.getBuildingAnimationFrames(buildingId, level, built);

    if (animationFrames) {
      const texture = this.ambientEffects.resolveAnimationTexture(animationFrames, performance.now());
      if (texture) {
        return new Sprite(texture);
      }
    }

    return new Sprite(this.assets.getBuildingTexture(buildingId, level, built));
  }

  private fitSprite(sprite: Sprite, maxWidth: number, maxHeight: number): void {
    const widthScale = maxWidth / sprite.texture.width;
    const heightScale = maxHeight / sprite.texture.height;
    const scale = Math.min(widthScale, heightScale);
    sprite.scale.set(scale);
  }

  private drawCenteredText(
    parent: Container,
    text: string,
    x: number,
    y: number,
    options: {
      fill: number;
      fontSize: number;
      fontWeight?: TextStyleFontWeight;
      alpha?: number;
      align?: "left" | "center" | "right";
      wordWrap?: boolean;
      wordWrapWidth?: number;
      lineHeight?: number;
    },
  ): Text {
    return drawCenteredTextPrimitive(
      parent,
      (tokenParent, tokenText, tokenX, tokenY, tokenOptions) =>
        this.drawText(tokenParent, tokenText, tokenX, tokenY, tokenOptions),
      text,
      x,
      y,
      options,
    );
  }

  private drawText(
    parent: Container,
    text: string,
    x: number,
    y: number,
    options: {
      fill: number;
      fontSize: number;
      fontWeight?: TextStyleFontWeight;
      alpha?: number;
      align?: "left" | "center" | "right";
      wordWrap?: boolean;
      wordWrapWidth?: number;
      lineHeight?: number;
    },
  ): Text {
    return drawTextPrimitive(parent, text, x, y, options);
  }

  private measureWrappedTextHeight(
    text: string,
    fontSize: number,
    fontWeight: TextStyleFontWeight,
    maxWidth: number,
  ): number {
    const lineHeight = getHudTextLineHeight(fontSize);
    const style = new TextStyle({
      fill: 0xffffff,
      fontFamily: HUD_FONT_FAMILY,
      fontSize,
      fontWeight: normalizeHudFontWeight(fontWeight),
      lineHeight,
      wordWrap: true,
      wordWrapWidth: Math.max(1, maxWidth),
    });
    const sample = text && text.trim().length > 0 ? text : " ";
    const metrics = CanvasTextMetrics.measureText(sample, style);
    return Math.max(lineHeight, Math.ceil(metrics.height));
  }

  private applyHudPixelScale(container: Container, scale: number): void {
    if (scale === 1) {
      return;
    }

    for (const child of container.children) {
      child.x = Math.round(child.x * scale);
      child.y = Math.round(child.y * scale);
      this.scaleHitArea(child, scale);

      if (child instanceof Text) {
        const fontSize = this.scaleTextStyleValue(child.style.fontSize, scale);
        const lineHeight = this.scaleTextStyleValue(child.style.lineHeight, scale);
        const wordWrapWidth = this.scaleTextStyleValue(child.style.wordWrapWidth, scale);

        if (fontSize !== undefined) {
          child.style.fontSize = fontSize;
        }
        const effectiveFontSize = typeof child.style.fontSize === "number" ? child.style.fontSize : 12;
        child.style.lineHeight = lineHeight ?? getHudTextLineHeight(effectiveFontSize);
        if (wordWrapWidth !== undefined) {
          child.style.wordWrapWidth = wordWrapWidth;
        }
        child.resolution = window.devicePixelRatio || 1;
        child.roundPixels = true;
        continue;
      }

      if (child instanceof Graphics || child instanceof Sprite) {
        child.scale.x = Math.round(child.scale.x * scale * 1000) / 1000;
        child.scale.y = Math.round(child.scale.y * scale * 1000) / 1000;
        continue;
      }

      if (child instanceof Container) {
        this.applyHudPixelScale(child, scale);
      }
    }
  }

  private scaleHudInteractionBounds(scale: number): void {
    if (scale === 1) {
      return;
    }

    this.scaleBounds(this.buildChoicesScrollArea, scale);
    this.scaleBounds(this.logScrollArea, scale);
    this.scaleBounds(this.resourceBreakdownScrollArea, scale);
    this.scaleBounds(this.decisionHistoryScrollArea, scale);
    this.hudInteractionAreas.forEach((area) => this.scaleBounds(area, scale));
  }

  private scaleBounds(bounds: Bounds | null, scale: number): void {
    if (!bounds) {
      return;
    }

    bounds.x = Math.round(bounds.x * scale);
    bounds.y = Math.round(bounds.y * scale);
    bounds.width = Math.round(bounds.width * scale);
    bounds.height = Math.round(bounds.height * scale);
  }

  private registerHudInteractionArea(
    x: number,
    y: number,
    width: number,
    height: number,
    padding = 0,
  ): void {
    if (width <= 0 || height <= 0) {
      return;
    }

    this.hudInteractionAreas.push({
      x: x - padding,
      y: y - padding,
      width: width + padding * 2,
      height: height + padding * 2,
    });
  }

  private registerHudInteractionForContainer(container: Container, padding = 0): void {
    const bounds = container.getBounds();

    this.registerHudInteractionArea(bounds.x, bounds.y, bounds.width, bounds.height, padding);
  }

  private scaleHitArea(target: Container, scale: number): void {
    if (target.hitArea instanceof Rectangle) {
      target.hitArea.x = Math.round(target.hitArea.x * scale);
      target.hitArea.y = Math.round(target.hitArea.y * scale);
      target.hitArea.width = Math.round(target.hitArea.width * scale);
      target.hitArea.height = Math.round(target.hitArea.height * scale);
    }
  }

  private scaleTextStyleValue(value: number | string | undefined, scale: number): number | undefined {
    if (typeof value !== "number") {
      return undefined;
    }

    return Math.max(1, Math.round(value * scale));
  }

  private shouldAnimateCamera(): boolean {
    return shouldAnimateCameraState(
      this.cameraTargetZoom,
      this.cameraZoom,
      this.cameraTargetOffsetX,
      this.cameraOffsetX,
      this.cameraTargetOffsetY,
      this.cameraOffsetY,
    );
  }

  private refreshCameraTransform(): void {
    const next = refreshCameraStateTransform(this.host, this.cameraLayer, this.layout, {
      zoom: this.cameraZoom,
      targetZoom: this.cameraTargetZoom,
      offsetX: this.cameraOffsetX,
      targetOffsetX: this.cameraTargetOffsetX,
      offsetY: this.cameraOffsetY,
      targetOffsetY: this.cameraTargetOffsetY,
    });
    this.cameraZoom = next.zoom;
    this.cameraOffsetX = next.offsetX;
    this.cameraOffsetY = next.offsetY;
  }

  private clampCurrentCamera(viewportWidth: number, viewportHeight: number): void {
    const clamped = clampCameraState(
      this.cameraZoom,
      this.cameraOffsetX,
      this.cameraOffsetY,
      this.layout,
      viewportWidth,
      viewportHeight,
    );
    this.cameraZoom = clamped.zoom;
    this.cameraOffsetX = clamped.offsetX;
    this.cameraOffsetY = clamped.offsetY;
  }

  private clampTargetCamera(viewportWidth: number, viewportHeight: number): void {
    const clamped = clampCameraState(
      this.cameraTargetZoom,
      this.cameraTargetOffsetX,
      this.cameraTargetOffsetY,
      this.layout,
      viewportWidth,
      viewportHeight,
    );
    this.cameraTargetZoom = clamped.zoom;
    this.cameraTargetOffsetX = clamped.offsetX;
    this.cameraTargetOffsetY = clamped.offsetY;
  }

  private applyCameraTransform(): void {
    this.cameraLayer.x = this.cameraOffsetX;
    this.cameraLayer.y = this.cameraOffsetY;
    this.cameraLayer.scale.set(this.cameraZoom);
  }

  private getLayout(width: number, height: number): SceneLayout {
    return getSceneLayout(width, height);
  }

  private getStaticWorldKey(state: GameState): string {
    return [
      state.environment.condition,
      this.layout.scale.toFixed(4),
      this.layout.originX.toFixed(2),
      this.layout.originY.toFixed(2),
    ].join("|");
  }

  private getPlotBounds(plot: Pick<VillagePlotDefinition, "x" | "y" | "width" | "height">): Bounds {
    const width = plot.width * this.layout.scale;
    const height = plot.height * this.layout.scale;
    const terrainWidth = defaultVillageLayout.width * this.layout.scale;
    const terrainHeight = defaultVillageLayout.height * this.layout.scale;
    const terrainOriginX = this.layout.originX + this.layout.width / 2 - terrainWidth / 2;
    const terrainOriginY = this.layout.originY + this.layout.height / 2 - terrainHeight / 2;

    return {
      x: terrainOriginX + plot.x * this.layout.scale,
      y: terrainOriginY + plot.y * this.layout.scale,
      width,
      height,
    };
  }

  private getDefenseScore(state: GameState): number {
    return state.survivors.troops * 4 +
      state.buildings.watchtower.level * 12 +
      state.buildings.palisade.level * 9;
  }

  private getTroopHousingCapacity(state: GameState): number {
    return state.buildings.barracks.level > 0 ? state.survivors.troops : 0;
  }

  private getFormattedLogEntries(
    state: GameState,
    translations: TranslationPack | undefined,
  ): FormattedLogEntry[] {
    if (
      this.lastFormattedLogSource === state.log &&
      this.lastFormattedLogTranslations === translations
    ) {
      return this.lastFormattedLogEntries;
    }

    const entries = state.log.map((entry, index) => {
      const text = translations ? formatLogEntry(entry, translations) : entry.key;
      return {
        text,
        fill: getLogEntryFillColor(entry, index === 0),
        iconId: getLogEntryIconId(entry),
      };
    });
    this.lastFormattedLogSource = state.log;
    this.lastFormattedLogTranslations = translations;
    this.lastFormattedLogEntries = entries;
    return entries;
  }

  private wrapLogText(
    text: string,
    fontWeight: TextStyleFontWeight,
    maxWidth: number,
  ): string[] {
    const style = new TextStyle({
      fill: 0xffffff,
      fontFamily: HUD_FONT_FAMILY,
      fontSize: 11,
      fontWeight: normalizeHudFontWeight(fontWeight),
      wordWrap: false,
    });
    const lines: string[] = [];
    const baseWords = text.split(/\s+/).filter((word) => word.length > 0);

    if (baseWords.length === 0) {
      return [text];
    }

    let currentLine = "";

    for (const word of baseWords) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const candidateWidth = CanvasTextMetrics.measureText(candidate, style).width;

      if (candidateWidth <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      if (CanvasTextMetrics.measureText(word, style).width <= maxWidth) {
        currentLine = word;
        continue;
      }

      let chunk = "";
      for (const char of word) {
        const charCandidate = chunk + char;
        if (CanvasTextMetrics.measureText(charCandidate, style).width <= maxWidth || chunk.length === 0) {
          chunk = charCandidate;
          continue;
        }

        lines.push(chunk);
        chunk = char;
      }

      currentLine = chunk;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
}
