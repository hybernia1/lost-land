import {
  Application,
  CullerPlugin,
  Container,
  extensions,
  Graphics,
  Rectangle,
  Text,
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
import type {
  BuildingCategory,
  BuildingId,
  DecisionHistoryEntry,
  EnvironmentConditionId,
  GameState,
  MarketResourceId,
  ResourceBag,
  ResourceId,
} from "../game/types";
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
import { canAfford } from "../systems/resources";
import { getDecisionProfileKind } from "../systems/quests";
import {
  CAMERA_MIN_ZOOM,
  HUD_CHROME_ALPHA,
  HUD_DESIGN_SCALE,
  HUD_FONT_FAMILY,
  HUD_LEFT_PANEL_WIDTH,
  HUD_SIDE_PANEL_MARGIN,
  HUD_TOP_STRIP_HEIGHT,
  UI_BADGE_RADIUS,
  UI_CONTROL_RADIUS,
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
  normalizeHudFontWeight,
  resourceColors,
  uiTextSize,
  uiTheme,
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
  HudSidebarTab,
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
  drawPlot as drawWorldPlot,
  drawResourceSites as drawWorldResourceSites,
  drawTerrain as drawWorldTerrain,
} from "./pixi/scene/worldRenderer";
import { getMapRenderBounds, mapRectToSceneBounds } from "./pixi/scene/mapGeometry";
import { MapBirdController } from "./pixi/scene/mapBirds";
import { MapNpcController } from "./pixi/scene/mapNpcs";
import { SettlementNpcController } from "./pixi/scene/settlementNpcs";
import { AmbientEffectsController } from "./pixi/ambient/ambientEffects";
import { drawInfoPanel } from "./pixi/modals/infoPanels";
import { drawVillageModal } from "./pixi/modals/villageModals";
import { createModalPanel, drawModalHeaderPlane, resolveModalFrame } from "./pixi/modals/modalLayout";
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
import { drawBluePanelBackground, loadBluePanelBackground } from "./pixi/ui/panelBackground";
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
import {
  measureHudWrappedTextHeight,
  wrapHudTextLines,
} from "./pixi/helpers/textMetrics";
import { drawPixiIcon } from "./pixiIcons";
import { VillageAssets } from "./villageAssets";

type TerrainTintBinding = {
  sprite: Sprite;
  tintByEnvironment?: Partial<Record<EnvironmentConditionId, number>>;
};

export type FrontScreenMode = "menu" | "new-game" | "load-game" | "settings";

export type FrontScreenLocaleOption = {
  id: string;
  label: string;
};

export type FrontScreenSaveEntry = {
  id: string;
  communityName: string;
  elapsedSeconds: number;
  loadable: boolean;
  version: number | null;
};

export type FrontScreenModel = {
  mode: FrontScreenMode;
  translations: TranslationPack;
  canContinue: boolean;
  communityNameDraft: string;
  locales: FrontScreenLocaleOption[];
  activeLocale: string;
  saves: FrontScreenSaveEntry[];
  pendingDeleteSaveId: string | null;
  keyboardSelectedAction?: PixiActionDetail | null;
};

export type GameMenuView = "main" | "settings";

export type GameMenuModel = {
  view: GameMenuView;
  locales: FrontScreenLocaleOption[];
  activeLocale: string;
  keyboardSelectedAction?: PixiActionDetail | null;
};

const STATIC_WORLD_CACHE_MAX_TEXTURE_SIZE = 4096;
let cullerPluginRegistered = false;
export type {
  ConquestResultPreview,
  GameOverPreview,
  PixiActionDetail,
  VillageInfoPanel,
};

export class PixiVillageRenderer {
  private app: Application | null = null;
  private readonly rootLayer = new Container();
  private readonly worldLayer = new Container();
  private readonly backgroundLayer = new Container();
  private readonly cameraLayer = new Container();
  private readonly cameraStaticLayer = new Container();
  private readonly cameraNpcLayer = new Container();
  private readonly cameraMapNpcLayer = new Container();
  private readonly cameraSettlementNpcLayer = new Container();
  private readonly cameraForegroundDecorLayer = new Container();
  private readonly cameraDynamicLayer = new Container();
  private readonly cameraSkyLayer = new Container();
  private readonly cameraBirdLayer = new Container();
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
      fill: uiTheme.text,
      fontFamily: HUD_FONT_FAMILY,
      fontSize: uiTextSize.body,
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
  private buildingBonusScrollArea: Bounds | null = null;
  private buildingBonusScrollMax = 0;
  private buildingBonusScrollY = 0;
  private buildingBonusScrollBuildingId: BuildingId | null = null;
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
  private activeSidebarTab: HudSidebarTab = "tasks";
  private selectedDecisionHistoryIndex: number | null = null;
  private activeModalPlotId: string | null = null;
  private activeBuildCategory: BuildingCategory = "resource";
  private activeBuildingDetailTab: "overview" | "bonuses" = "overview";
  private barracksTroopCount = 1;
  private readonly resourceSiteTroopCountById = new Map<string, number>();
  private marketFromResource: MarketResourceId = "material";
  private marketToResource: MarketResourceId = "food";
  private marketAmount = 10;
  private hudPixelScale = 1;
  private cameraOffsetX = 0;
  private cameraOffsetY = 0;
  private cameraZoom = CAMERA_MIN_ZOOM;
  private cameraTargetOffsetX = 0;
  private cameraTargetOffsetY = 0;
  private cameraTargetZoom = CAMERA_MIN_ZOOM;
  private cameraDragStart: CameraDragState | null = null;
  private cameraDragMoved = false;
  private cameraDragBlocked = false;
  private lastStaticWorldKey: string | null = null;
  private lastBackgroundKey: string | null = null;
  private staticWorldCachedAsTexture = false;
  private canCacheStaticWorldAsTexture = false;
  private readonly terrainTintBindings: TerrainTintBinding[] = [];
  private lastTerrainCondition: EnvironmentConditionId | null = null;
  private readonly ambientEffects: AmbientEffectsController;
  private readonly mapBirds = new MapBirdController();
  private readonly mapNpcs = new MapNpcController();
  private readonly settlementNpcs = new SettlementNpcController();
  private lastFormattedLogSource: ReadonlyArray<GameState["log"][number]> | null = null;
  private lastFormattedLogTranslations: TranslationPack | undefined;
  private lastFormattedLogEntries: FormattedLogEntry[] = [];
  private frontScreenModel: FrontScreenModel | null = null;
  private frontSaveScrollArea: Bounds | null = null;
  private frontSaveScrollMax = 0;
  private frontSaveScrollY = 0;
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
    this.cameraLayer.addChild(
      this.cameraStaticLayer,
      this.cameraNpcLayer,
      this.cameraForegroundDecorLayer,
      this.cameraDynamicLayer,
      this.cameraSkyLayer,
    );
    this.cameraStaticLayer.cullable = true;
    this.cameraStaticLayer.cullableChildren = true;
    this.cameraNpcLayer.cullable = true;
    this.cameraNpcLayer.cullableChildren = true;
    this.cameraNpcLayer.sortableChildren = true;
    this.cameraMapNpcLayer.cullable = true;
    this.cameraMapNpcLayer.cullableChildren = true;
    this.cameraMapNpcLayer.sortableChildren = true;
    this.cameraSettlementNpcLayer.cullable = true;
    this.cameraSettlementNpcLayer.cullableChildren = true;
    this.cameraSettlementNpcLayer.sortableChildren = true;
    this.cameraForegroundDecorLayer.cullable = true;
    this.cameraForegroundDecorLayer.cullableChildren = true;
    this.cameraSkyLayer.cullable = true;
    this.cameraSkyLayer.cullableChildren = true;
    this.cameraBirdLayer.cullable = true;
    this.cameraBirdLayer.cullableChildren = true;
    this.cameraNpcLayer.addChild(this.cameraMapNpcLayer, this.cameraSettlementNpcLayer);
    this.cameraSkyLayer.addChild(this.cameraBirdLayer);
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
      shouldAnimateMapBirds: () => this.mapBirds.shouldAnimate(),
      refreshMapBirds: (timestampMs: number) => this.mapBirds.update(timestampMs, this.getCameraVisibleWorldBounds()),
      shouldAnimateMapNpcs: () => this.mapNpcs.shouldAnimate() || this.settlementNpcs.shouldAnimate(),
      refreshMapNpcs: (timestampMs: number) => {
        const visibleBounds = this.getCameraVisibleWorldBounds();
        this.mapNpcs.update(timestampMs, visibleBounds);
        this.settlementNpcs.update(timestampMs, visibleBounds);
      },
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
    gameMenu?: GameMenuModel | null,
  ): void {
    this.frontScreenModel = null;
    this.lastState = state;
    this.lastTranslations = translations;
    const previousModalPlotId = this.activeModalPlotId;
    this.activeModalPlotId = modalPlotId ?? null;
    if (this.activeModalPlotId !== previousModalPlotId) {
      this.activeBuildingDetailTab = "overview";
      this.buildingBonusScrollY = 0;
      this.buildingBonusScrollBuildingId = null;
    }
    const hasBlockingOverlay = Boolean(
      modalPlotId ||
      infoPanel ||
      state.quests.activeDecision ||
      resolvedDecisionPreview ||
      conquestResultPreview ||
      gameOverPreview ||
      gameMenu,
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
    this.buildingBonusScrollArea = null;
    this.buildingBonusScrollMax = 0;
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
    const staticWorldKey = this.getStaticWorldKey();
    if (staticWorldKey !== this.lastStaticWorldKey) {
      this.disableStaticWorldCache();
      this.clearContainerChildren(this.cameraStaticLayer);
      this.clearContainerChildren(this.cameraForegroundDecorLayer);
      this.resetTerrainTintBindings();
      drawWorldTerrain(this.worldRendererHost());
      drawWorldDecorObjects(this.worldRendererHost(), "base");
      drawWorldDecorObjects(this.worldRendererHost(), "foreground");
      this.updateStaticWorldCullArea();
      this.lastStaticWorldKey = staticWorldKey;
      this.enableStaticWorldCacheIfEligible();
    }
    const terrainTintChanged = this.applyTerrainTintForCondition(state.environment.condition);
    if (terrainTintChanged && this.staticWorldCachedAsTexture) {
      this.cameraStaticLayer.updateCacheTexture();
    }
    this.mapNpcs.sync(
      this.cameraMapNpcLayer,
      defaultVillageLayout,
      this.layout,
      (kindId) => this.assets.getMapNpcTextures(kindId),
      state.paused,
      this.getCameraVisibleWorldBounds(),
    );
    this.settlementNpcs.sync(
      this.cameraSettlementNpcLayer,
      state,
      defaultVillageLayout,
      this.layout,
      (kindId) => this.assets.getMapNpcTextures(kindId),
      state.paused,
      this.getCameraVisibleWorldBounds(),
    );
    this.mapBirds.sync(
      this.cameraBirdLayer,
      defaultVillageLayout,
      this.layout,
      (kindId) => this.assets.getMapBirdTextures(kindId),
      state.paused,
      this.getCameraVisibleWorldBounds(),
    );
    const backgroundKey = `${Math.round(width)}x${Math.round(height)}`;
    if (backgroundKey !== this.lastBackgroundKey) {
      this.clearContainerChildren(this.backgroundLayer);
      drawWorldBackground(this.worldRendererHost(), width, height);
      this.lastBackgroundKey = backgroundKey;
    }
    drawWorldResourceSites(this.worldRendererHost(), state, translations);

    for (const plot of defaultVillageLayout.plots) {
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
    this.drawGameMenuModal(translations, hudWidth, hudHeight, gameMenu ?? null);
    this.ambientEffects.syncState(state);
    this.ambientEffects.refreshOverlays(performance.now(), true);
    this.ambientEffects.updateAnimationLoop();
    this.applyHudPixelScale(this.hudLayer, hudRenderScale);
    this.scaleHudInteractionBounds(hudRenderScale);
    this.app.render();
  }

  private drawGameMenuModal(
    translations: TranslationPack | undefined,
    width: number,
    height: number,
    model: GameMenuModel | null,
  ): void {
    if (!translations || !model) {
      return;
    }

    const overlay = new Container();
    this.hudLayer.addChild(overlay);
    this.drawModalBackdrop(overlay, width, height, { action: "game-menu-continue" });
    const frame = resolveModalFrame(width, height, {
      maxWidth: 430,
      minHeight: 292,
      preferredHeight: model.view === "settings" ? 342 : 300,
      marginY: 56,
      topMin: 46,
    });
    const panel = createModalPanel(
      overlay,
      (parent, x, y, panelWidth, panelHeight, fillAlpha, cornerRadius) =>
        this.drawPanel(parent, x, y, panelWidth, panelHeight, fillAlpha, cornerRadius),
      frame,
    );
    drawModalHeaderPlane(panel, frame.width, 92);
    const headerBottom = this.drawOverlayHeader(panel, frame.width, translations, {
      iconId: "pause",
      title: translations.ui.gameMenu ?? "Game menu",
      closeAction: { action: "game-menu-continue" },
    });

    if (model.view === "settings") {
      this.drawGameMenuSettings(panel, translations, model, frame.width, headerBottom);
      return;
    }

    const buttonWidth = frame.width - 56;
    const buttonX = 28;
    let buttonY = headerBottom + 22;
    this.createRectButton(panel, {
      label: translations.ui.continue ?? "Continue",
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: 42,
      detail: { action: "game-menu-continue" },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "game-menu-continue" }),
      tone: "toolbar",
    });

    buttonY += 52;
    this.createRectButton(panel, {
      label: translations.ui.settings ?? "Settings",
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: 42,
      detail: { action: "game-menu-settings" },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "game-menu-settings" }),
      tone: "toolbar",
    });

    buttonY += 52;
    this.createRectButton(panel, {
      label: translations.ui.quit ?? "Quit",
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: 42,
      detail: { action: "game-menu-quit" },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "game-menu-quit" }),
      tone: "secondary",
    });
  }

  private drawGameMenuSettings(
    panel: Container,
    translations: TranslationPack,
    model: GameMenuModel,
    panelWidth: number,
    headerBottom: number,
  ): void {
    const contentX = 28;
    const contentWidth = panelWidth - 56;
    this.drawText(panel, translations.ui.language ?? "Language", contentX, headerBottom + 22, {
      fill: uiTheme.accentStrong,
      fontSize: uiTextSize.bodyLarge,
      fontWeight: "900",
    });
    this.drawText(panel, translations.ui.languageText ?? "", contentX, headerBottom + 50, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.body,
      fontWeight: "700",
      wordWrap: true,
      wordWrapWidth: contentWidth,
      lineHeight: 18,
    });

    const buttonWidth = Math.min(contentWidth, 230);
    let buttonY = headerBottom + 90;
    for (const locale of model.locales) {
      const active = locale.id === model.activeLocale;
      this.createRectButton(panel, {
        label: locale.label,
        x: contentX,
        y: buttonY,
        width: buttonWidth,
        height: 38,
        detail: { action: "select-locale", value: locale.id },
        active,
        selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, {
          action: "select-locale",
          value: locale.id,
        }),
        tone: "toolbar",
      });
      buttonY += 46;
    }

    this.createRectButton(panel, {
      label: translations.ui.back ?? "Back",
      x: contentX,
      y: buttonY + 12,
      width: 132,
      height: 38,
      detail: { action: "game-menu-back" },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "game-menu-back" }),
      tone: "secondary",
    });
  }

  private isKeyboardSelectedAction(
    selected: PixiActionDetail | null | undefined,
    candidate: PixiActionDetail,
  ): boolean {
    return Boolean(
      selected &&
      selected.action === candidate.action &&
      (candidate.value === undefined || selected.value === candidate.value),
    );
  }

  renderFrontScreen(model: FrontScreenModel): void {
    this.frontScreenModel = model;
    this.cameraDragBlocked = true;
    this.hadBlockingOverlayOpen = true;

    if (!this.app) {
      return;
    }

    const width = this.host.clientWidth;
    const height = this.host.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    const hudPixelScale = 1;
    const hudRenderScale = HUD_DESIGN_SCALE * hudPixelScale;
    const hudWidth = width / hudRenderScale;
    const hudHeight = height / hudRenderScale;
    this.hudPixelScale = hudRenderScale;

    this.clearContainerChildren(this.cameraDynamicLayer);
    this.clearContainerChildren(this.cameraStaticLayer);
    this.clearContainerChildren(this.cameraForegroundDecorLayer);
    this.clearMapNpcs();
    this.clearMapBirds();
    this.clearContainerChildren(this.backgroundLayer);
    this.clearContainerChildren(this.hudLayer);
    this.resetTerrainTintBindings();
    this.disableStaticWorldCache();
    this.lastStaticWorldKey = null;
    this.lastBackgroundKey = null;
    this.hudInteractionAreas = [];
    this.frontSaveScrollArea = null;
    this.frontSaveScrollMax = 0;

    this.drawFrontBackground(width, height);
    this.drawFrontScreenContent(model, hudWidth, hudHeight);

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

    const siteHit = defaultVillageLayout.resourceSites.find((site) => {
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

    const plotHit = defaultVillageLayout.plots.find((plot) => {
      const bounds = this.getPlotBounds(plot);
      return (
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      );
    });

    if (plotHit) {
      return plotHit.id;
    }

    return null;
  }

  private handleHostWheel(event: WheelEvent): void {
    if (this.handleFrontSaveListWheel(event)) {
      return;
    }

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
        buildingBonusScrollArea: this.buildingBonusScrollArea,
        buildingBonusScrollMax: this.buildingBonusScrollMax,
        buildingBonusScrollY: this.buildingBonusScrollY,
        setBuildingBonusScrollY: (value: number) => {
          this.buildingBonusScrollY = value;
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

  private handleFrontSaveListWheel(event: WheelEvent): boolean {
    if (
      this.frontScreenModel?.mode !== "load-game" ||
      this.frontScreenModel.pendingDeleteSaveId !== null ||
      !this.frontSaveScrollArea ||
      this.frontSaveScrollMax <= 0
    ) {
      return false;
    }

    const rect = this.host.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.hudPixelScale;
    const y = (event.clientY - rect.top) / this.hudPixelScale;
    const area = this.frontSaveScrollArea;

    if (
      x < area.x ||
      x > area.x + area.width ||
      y < area.y ||
      y > area.y + area.height
    ) {
      return false;
    }

    const next = Math.max(
      0,
      Math.min(this.frontSaveScrollMax, this.frontSaveScrollY + event.deltaY * 0.45),
    );

    if (next !== this.frontSaveScrollY) {
      this.frontSaveScrollY = next;
      this.requestRender();
    }

    event.preventDefault();
    return true;
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
    this.disableStaticWorldCache();
    this.ambientEffects.stopAnimation();
    this.clearMapNpcs();
    this.clearMapBirds();
    this.app?.destroy(true);
    this.app = null;
  }

  panCameraByViewportDelta(deltaX: number, deltaY: number): void {
    if (this.cameraDragBlocked) {
      return;
    }

    this.cameraTargetOffsetX -= deltaX;
    this.cameraTargetOffsetY -= deltaY;
    this.clampTargetCamera(this.host.clientWidth, this.host.clientHeight);
    this.ambientEffects.updateAnimationLoop();
  }

  private async initialize(): Promise<void> {
    const app = new Application();
    if (!cullerPluginRegistered) {
      extensions.add(CullerPlugin);
      cullerPluginRegistered = true;
    }
    await app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: false,
      autoStart: false,
      autoDensity: true,
      culler: {
        updateTransform: true,
      },
      resolution: Math.min(window.devicePixelRatio || 1, MAX_RENDER_RESOLUTION),
    });

    app.canvas.classList.add("pixi-canvas");
    this.host.append(app.canvas);
    app.stage.addChild(this.rootLayer);
    this.app = app;

    await Promise.all([
      this.assets.load(),
      loadBluePanelBackground(),
    ]);
    this.canCacheStaticWorldAsTexture = this.computeStaticWorldCacheEligibility();
    this.requestRender();
  }

  private drawFrontBackground(width: number, height: number): void {
    const sky = new Graphics();
    sky.rect(0, 0, width, height).fill({ color: uiTheme.background, alpha: 1 });
    sky.rect(0, height * 0.48, width, height * 0.52).fill({ color: uiTheme.backgroundLower, alpha: 0.94 });
    this.backgroundLayer.addChild(sky);

    const haze = new Graphics();
    haze.rect(width * 0.06, height * 0.07, width * 0.88, height * 0.26)
      .fill({ color: uiTheme.accentStrong, alpha: 0.18 });
    this.backgroundLayer.addChild(haze);
  }

  private drawFrontScreenContent(model: FrontScreenModel, width: number, height: number): void {
    const panelWidth = Math.min(780, width - 36);
    const panelHeight = model.mode === "load-game"
      ? Math.min(560, height - 28)
      : Math.min(470, height - 28);
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;

    this.drawPanel(this.hudLayer, panelX, panelY, panelWidth, panelHeight, 0.9);

    let cursorY = panelY + 24;
    if (model.mode !== "menu") {
      this.createRectButton(this.hudLayer, {
        label: model.translations.ui.back ?? "Back",
        x: panelX + 22,
        y: cursorY,
        width: 100,
        height: 34,
        detail: { action: "back-menu" },
        selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "back-menu" }),
        tone: "secondary",
      });
    }

    this.drawText(this.hudLayer, model.translations.ui.menuTitle ?? "Lost Land", panelX + 22, cursorY + 56, {
      fill: uiTheme.text,
      fontSize: uiTextSize.frontTitle,
      fontWeight: "900",
    });

    cursorY += 118;

    if (model.mode === "menu") {
      this.drawFrontMainMenu(model, panelX, cursorY, panelWidth);
      return;
    }

    if (model.mode === "new-game") {
      this.drawFrontNewGame(model, panelX, cursorY, panelWidth);
      return;
    }

    if (model.mode === "settings") {
      this.drawFrontSettings(model, panelX, cursorY, panelWidth);
      return;
    }

    this.drawFrontLoadGame(model, panelX, panelY, panelWidth, panelHeight, cursorY);
  }

  private drawFrontMainMenu(model: FrontScreenModel, panelX: number, cursorY: number, panelWidth: number): void {
    const buttonWidth = Math.min(320, panelWidth - 44);
    const buttonX = panelX + 22;
    let buttonY = cursorY + 12;
    this.createRectButton(this.hudLayer, {
      label: model.translations.ui.newGame ?? "New Game",
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: 44,
      detail: { action: "new-game" },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "new-game" }),
      tone: "toolbar",
    });

    buttonY += 52;
    this.createRectButton(this.hudLayer, {
      label: model.translations.ui.continue ?? "Continue",
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: 44,
      detail: { action: "continue" },
      disabled: !model.canContinue,
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "continue" }),
      tone: model.canContinue ? "toolbar" : "secondary",
    });

    buttonY += 52;
    this.createRectButton(this.hudLayer, {
      label: model.translations.ui.settings ?? "Settings",
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: 44,
      detail: { action: "settings" },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "settings" }),
      tone: "toolbar",
    });
  }

  private drawFrontNewGame(
    model: FrontScreenModel,
    panelX: number,
    cursorY: number,
    panelWidth: number,
  ): void {
    const t = model.translations;
    this.drawText(this.hudLayer, t.ui.nameCommunity ?? "Name your community", panelX + 22, cursorY - 4, {
      fill: uiTheme.accentStrong,
      fontSize: uiTextSize.screenTitle,
      fontWeight: "900",
    });
    this.drawText(this.hudLayer, t.ui.nameCommunityText ?? "", panelX + 22, cursorY + 28, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.body,
      fontWeight: "700",
      wordWrap: true,
      wordWrapWidth: panelWidth - 44,
      lineHeight: 19,
    });

    const inputX = panelX + 22;
    const inputY = cursorY + 94;
    const inputWidth = panelWidth - 44;
    const inputBox = new Graphics();
    inputBox.rect(inputX, inputY, inputWidth, 44).fill({ color: uiTheme.surfaceSunken, alpha: 0.72 });
    this.hudLayer.addChild(inputBox);

    this.drawText(this.hudLayer, model.communityNameDraft.slice(0, 32), inputX + 12, inputY + 12, {
      fill: uiTheme.text,
      fontSize: uiTextSize.control,
      fontWeight: "800",
    });

    this.drawText(this.hudLayer, "Enter: start | Backspace: delete", inputX, inputY + 52, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.caption,
      fontWeight: "700",
    });

    const controlsY = inputY + 88;
    this.createRectButton(this.hudLayer, {
      label: "Backspace",
      x: inputX,
      y: controlsY,
      width: 126,
      height: 36,
      detail: { action: "community-name-backspace" },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "community-name-backspace" }),
      tone: "secondary",
    });
    this.createRectButton(this.hudLayer, {
      label: "Clear",
      x: inputX + 136,
      y: controlsY,
      width: 90,
      height: 36,
      detail: { action: "community-name-clear" },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "community-name-clear" }),
      tone: "secondary",
    });
    this.createRectButton(this.hudLayer, {
      label: t.ui.startCommunity ?? "Start community",
      x: panelX + panelWidth - 250,
      y: controlsY,
      width: 228,
      height: 36,
      detail: { action: "start-new-community" },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, { action: "start-new-community" }),
      tone: "primary",
    });
  }

  private drawFrontSettings(model: FrontScreenModel, panelX: number, cursorY: number, panelWidth: number): void {
    const t = model.translations;
    this.drawText(this.hudLayer, t.ui.settings ?? "Settings", panelX + 22, cursorY - 4, {
      fill: uiTheme.accentStrong,
      fontSize: uiTextSize.screenTitle,
      fontWeight: "900",
    });
    this.drawText(this.hudLayer, t.ui.languageText ?? "", panelX + 22, cursorY + 28, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.body,
      fontWeight: "700",
      wordWrap: true,
      wordWrapWidth: panelWidth - 44,
      lineHeight: 19,
    });

    const buttonX = panelX + 22;
    let buttonY = cursorY + 90;
    const buttonWidth = Math.min(260, panelWidth - 44);
    for (const locale of model.locales) {
      const active = locale.id === model.activeLocale;
      this.createRectButton(this.hudLayer, {
        label: locale.label,
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: 38,
        detail: { action: "select-locale", value: locale.id },
        active,
        selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, {
          action: "select-locale",
          value: locale.id,
        }),
        tone: "toolbar",
      });
      buttonY += 46;
    }
  }

  private drawFrontLoadGame(
    model: FrontScreenModel,
    panelX: number,
    panelY: number,
    panelWidth: number,
    panelHeight: number,
    cursorY: number,
  ): void {
    const t = model.translations;
    this.drawText(this.hudLayer, t.ui.savedCommunities ?? "Saved communities", panelX + 22, cursorY - 4, {
      fill: uiTheme.accentStrong,
      fontSize: uiTextSize.screenTitle,
      fontWeight: "900",
    });

    const listX = panelX + 22;
    const listY = cursorY + 36;
    const listWidth = panelWidth - 44;
    const listHeight = panelY + panelHeight - listY - 22;

    this.drawPanel(this.hudLayer, listX, listY, listWidth, listHeight, 0.56);
    this.frontSaveScrollArea = { x: listX, y: listY, width: listWidth, height: listHeight };

    if (model.saves.length === 0) {
      this.drawText(this.hudLayer, t.ui.noSavedCommunities ?? "No saved community yet.", listX + 14, listY + 14, {
        fill: uiTheme.textMuted,
        fontSize: uiTextSize.body,
        fontWeight: "700",
      });
      this.frontSaveScrollMax = 0;
      this.frontSaveScrollY = 0;
      return;
    }

    const rowHeight = 88;
    const rowGap = 8;
    const rowStride = rowHeight + rowGap;
    const contentHeight = model.saves.length * rowStride - rowGap;
    this.frontSaveScrollMax = Math.max(0, contentHeight - listHeight);
    this.frontSaveScrollY = Math.max(0, Math.min(this.frontSaveScrollMax, this.frontSaveScrollY));
    const needsScroll = this.frontSaveScrollMax > 0;
    const scrollbarGutter = needsScroll ? 22 : 0;
    const rowX = listX + 8;
    const rowWidth = listWidth - 16 - scrollbarGutter;
    this.frontSaveScrollArea = { x: listX, y: listY, width: listWidth, height: listHeight };

    const listContent = new Container();
    this.hudLayer.addChild(listContent);
    const listMask = new Graphics();
    listMask.rect(rowX, listY, rowWidth, listHeight).fill({ color: 0xffffff, alpha: 1 });
    this.hudLayer.addChild(listMask);
    listContent.mask = listMask;

    const rowStartY = listY - this.frontSaveScrollY;
    for (let index = 0; index < model.saves.length; index += 1) {
      const save = model.saves[index];
      const rowY = rowStartY + index * rowStride;
      if (rowY + rowHeight < listY || rowY > listY + listHeight) {
        continue;
      }

      const cardFill = save.loadable ? uiTheme.surface : uiTheme.surfaceSunken;
      const card = new Graphics();
      card.rect(rowX, rowY, rowWidth, rowHeight)
        .fill({ color: cardFill, alpha: 0.96 });
      listContent.addChild(card);

      this.drawText(listContent, save.communityName, listX + 20, rowY + 10, {
        fill: uiTheme.text,
        fontSize: uiTextSize.control,
        fontWeight: "900",
      });
      this.drawText(listContent, `${t.ui.day ?? "Day"} ${getGameDay(save.elapsedSeconds)} / ${formatGameClock(save.elapsedSeconds)}`, listX + 20, rowY + 34, {
        fill: uiTheme.accentStrong,
        fontSize: uiTextSize.small,
        fontWeight: "800",
      });

      if (!save.loadable) {
        const versionTag = typeof save.version === "number" ? ` (v${save.version})` : "";
        this.drawText(
          listContent,
          `${t.ui.legacySaveLocked ?? "Legacy save cannot be loaded."}${versionTag}`,
          listX + 20,
          rowY + 52,
          {
            fill: uiTheme.textMuted,
            fontSize: uiTextSize.caption,
            fontWeight: "700",
          },
        );
      }

      const deleteButtonX = rowX + rowWidth - 10 - 92;
      const loadButtonX = deleteButtonX - 8 - 92;
      this.createRectButton(listContent, {
        label: t.ui.loadSave ?? "Load",
        x: loadButtonX,
        y: rowY + 14,
        width: 92,
        height: 30,
        detail: { action: "load-save", value: save.id },
        disabled: !save.loadable,
        selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, {
          action: "load-save",
          value: save.id,
        }),
        tone: save.loadable ? "toolbar" : "secondary",
      });

      this.createRectButton(listContent, {
        label: t.ui.deleteSave ?? "Delete",
        x: deleteButtonX,
        y: rowY + 14,
        width: 92,
        height: 30,
        detail: { action: "delete-save", value: save.id },
        selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, {
          action: "delete-save",
          value: save.id,
        }),
        tone: "secondary",
      });
    }

    if (needsScroll) {
      const trackX = listX + listWidth - 12;
      const trackY = listY + 8;
      const trackHeight = listHeight - 16;
      const track = new Graphics();
      track.rect(trackX, trackY, 4, trackHeight).fill({ color: uiTheme.surfaceSunken, alpha: 0.96 });
      this.hudLayer.addChild(track);

      const thumbHeight = Math.max(36, (listHeight / contentHeight) * trackHeight);
      const thumbTravel = trackHeight - thumbHeight;
      const thumbY = trackY + (this.frontSaveScrollY / this.frontSaveScrollMax) * thumbTravel;
      const thumb = new Graphics();
      thumb.rect(trackX, thumbY, 4, thumbHeight).fill({ color: uiTheme.borderStrong, alpha: 0.98 });
      this.hudLayer.addChild(thumb);
    }

    this.drawDeleteConfirmModal(model, panelX, panelY, panelWidth, panelHeight);
  }

  private drawDeleteConfirmModal(
    model: FrontScreenModel,
    panelX: number,
    panelY: number,
    panelWidth: number,
    panelHeight: number,
  ): void {
    const saveId = model.pendingDeleteSaveId;
    if (!saveId) {
      return;
    }

    const save = model.saves.find((entry) => entry.id === saveId);
    if (!save) {
      return;
    }

    const backdrop = new Graphics();
    backdrop.rect(panelX, panelY, panelWidth, panelHeight).fill({ color: uiTheme.overlay, alpha: 0.26 });
    backdrop.eventMode = "static";
    backdrop.cursor = "default";
    backdrop.on("pointerdown", (event) => {
      event.stopPropagation();
      this.consumeHostClick();
    });
    this.hudLayer.addChild(backdrop);

    const modalWidth = Math.min(520, panelWidth - 48);
    const modalHeight = 178;
    const modalX = panelX + (panelWidth - modalWidth) / 2;
    const modalY = panelY + (panelHeight - modalHeight) / 2;
    this.drawPanel(this.hudLayer, modalX, modalY, modalWidth, modalHeight, 0.94);

    this.drawText(this.hudLayer, model.translations.ui.deleteSave ?? "Delete", modalX + 20, modalY + 16, {
      fill: uiTheme.accentStrong,
      fontSize: uiTextSize.sectionTitle,
      fontWeight: "900",
    });

    const question = (model.translations.ui.confirmDeleteSave ?? "Delete save \"{community}\" permanently?")
      .replace("{community}", save.communityName);
    this.drawText(this.hudLayer, question, modalX + 20, modalY + 52, {
      fill: uiTheme.text,
      fontSize: uiTextSize.bodyLarge,
      fontWeight: "700",
      wordWrap: true,
      wordWrapWidth: modalWidth - 40,
      lineHeight: 20,
    });

    this.createRectButton(this.hudLayer, {
      label: model.translations.ui.back ?? "Back",
      x: modalX + modalWidth - 226,
      y: modalY + modalHeight - 48,
      width: 96,
      height: 32,
      detail: { action: "cancel-delete-save", value: save.id },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, {
        action: "cancel-delete-save",
        value: save.id,
      }),
      tone: "secondary",
    });
    this.createRectButton(this.hudLayer, {
      label: model.translations.ui.deleteSave ?? "Delete",
      x: modalX + modalWidth - 118,
      y: modalY + modalHeight - 48,
      width: 96,
      height: 32,
      detail: { action: "confirm-delete-save", value: save.id },
      selected: this.isKeyboardSelectedAction(model.keyboardSelectedAction, {
        action: "confirm-delete-save",
        value: save.id,
      }),
      tone: "primary",
    });
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
      HUD_SIDE_PANEL_MARGIN,
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
      requestRender: () => this.requestRender(),
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
      getActiveSidebarTab: () => this.activeSidebarTab,
      setActiveSidebarTab: (value: HudSidebarTab) => {
        this.activeSidebarTab = value;
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
      drawTabs: <T extends string>(
        parent: Container,
        tabs: Array<TabItem<T>>,
        options: TabOptions<T>,
      ) => this.drawTabs(parent, tabs, options),
      bindAction: (target: Container, detail: PixiActionDetail) => this.bindAction(target, detail),
      bindTooltip: (target: Container, text: string) => this.bindTooltip(target, text),
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
        disabled = false,
      ) => this.createIconButton(parent, iconId, x, y, width, height, detail, tooltip, active, disabled),
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
      bindTooltip: (target: Container, text: string) => this.bindTooltip(target, text),
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
        plotId: string,
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
        plotId,
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
      getActiveBuildingDetailTab: () => this.activeBuildingDetailTab,
      setActiveBuildingDetailTab: (value: "overview" | "bonuses") => {
        this.activeBuildingDetailTab = value;
      },
      getBuildingBonusScrollBuildingId: () => this.buildingBonusScrollBuildingId,
      setBuildingBonusScrollBuildingId: (value: BuildingId | null) => {
        this.buildingBonusScrollBuildingId = value;
      },
      getBuildingBonusScrollY: () => this.buildingBonusScrollY,
      setBuildingBonusScrollY: (value: number) => {
        this.buildingBonusScrollY = value;
      },
      setBuildingBonusScrollMax: (value: number) => {
        this.buildingBonusScrollMax = value;
      },
      setBuildingBonusScrollArea: (value: Bounds | null) => {
        this.buildingBonusScrollArea = value;
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
      cameraForegroundDecorLayer: this.cameraForegroundDecorLayer,
      cameraDynamicLayer: this.cameraDynamicLayer,
      backgroundLayer: this.backgroundLayer,
      mapLayout: defaultVillageLayout,
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
      trackTerrainSprite: (
        sprite: Sprite,
        tintByEnvironment?: Partial<Record<EnvironmentConditionId, number>>,
      ) => this.trackTerrainSprite(sprite, tintByEnvironment),
      createBuildingSprite: (buildingId: BuildingId, level: number, built: boolean) =>
        this.createBuildingSprite(buildingId, level, built),
      fitSprite: (sprite: Sprite, maxWidth: number, maxHeight: number) => this.fitSprite(sprite, maxWidth, maxHeight),
      getPlotBounds: (plot: Pick<VillagePlotDefinition, "x" | "y" | "width" | "height">) =>
        this.getPlotBounds(plot),
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
    drawBluePanelBackground(this.hudLayer, 0, 0, width, HUD_TOP_STRIP_HEIGHT, HUD_CHROME_ALPHA);
    const strip = new Graphics();
    strip
      .rect(0, 0, width, HUD_TOP_STRIP_HEIGHT)
      .fill({ color: uiTheme.hudChrome, alpha: 0.12 });
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
      .roundRect(0, 0, 44, 44, UI_CONTROL_RADIUS)
      .fill({ color: uiTheme.surface, alpha: 0.72 })
      .stroke({ color: uiTheme.border, alpha: 0.62, width: 1 });
    layer.addChild(mark);
    this.drawIcon(layer, iconId, 22, 22, 28);
    if (tooltip) {
      mark.hitArea = new Rectangle(0, 0, 44, 44);
      this.bindTooltip(mark, tooltip);
    }
    const titleLabel = this.drawText(layer, title.toUpperCase(), 56, 2, {
      fill: uiTheme.text,
      fontSize: uiTextSize.brandTitle,
      fontWeight: "900",
    });
    const titleBottom = titleLabel.y + titleLabel.height;

    this.drawBrandAlerts(layer, alerts, 0, Math.max(46, titleBottom + 4));
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
    const textFill = this.getBrandAlertTextColor(alert.tone);
    const label = alert.label
      ? new Text({
        text: alert.label,
        style: {
          fill: textFill,
          fontFamily: HUD_FONT_FAMILY,
          fontSize: uiTextSize.caption,
          fontWeight: normalizeHudFontWeight("900"),
        },
      })
      : null;
    const width = label ? Math.max(62, label.width + 38) : 30;
    const height = 30;
    const background = new Graphics();
    background.roundRect(0, 0, width, height, UI_BADGE_RADIUS)
      .fill({ color: uiTheme.surface, alpha: 0.5 })
      .stroke({ color: uiTheme.border, alpha: 0.44, width: 1 });
    group.addChild(background);
    this.drawIcon(group, alert.iconId, label ? 15 : width / 2, height / 2, 15);

    if (label) {
      label.x = 28;
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

  private getBrandAlertTextColor(tone: BrandAlert["tone"]): number {
    if (tone === "cold") {
      return uiTheme.cold;
    }

    if (tone === "danger") {
      return uiTheme.negative;
    }

    if (tone === "warning") {
      return uiTheme.accentStrong;
    }

    return uiTheme.textMuted;
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
        tone: "warning",
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
        uiTheme.text,
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
        stockRatio < 0.2 ? uiTheme.negative : undefined,
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
    backdrop.rect(0, 0, width, height).fill({ color: uiTheme.overlay, alpha: MODAL_BACKDROP_ALPHA });

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
    const headerBackground = new Graphics();
    parent.addChild(headerBackground);

    const badge = new Container();
    badge.x = 22;
    badge.y = 18;
    parent.addChild(badge);
    this.drawIcon(badge, options.iconId, 21, 21, 22);

    if (options.kicker) {
      this.drawText(parent, options.kicker, 72, 18, {
        fill: uiTheme.accentStrong,
        fontSize: uiTextSize.small,
        fontWeight: "900",
      });
    }

    const titleY = options.kicker ? 36 : 26;
    const titleLabel = this.drawText(parent, options.title, 72, titleY, {
      fill: uiTheme.text,
      fontSize: uiTextSize.overlayTitle,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: panelWidth - 152,
    });
    let contentY = titleLabel.y + titleLabel.height + 8;

    if (options.subtitle) {
      const subtitleLabel = this.drawText(parent, options.subtitle, 72, contentY, {
        fill: uiTheme.textMuted,
        fontSize: uiTextSize.caption,
        fontWeight: "800",
        wordWrap: true,
        wordWrapWidth: panelWidth - 152,
      });
      contentY = subtitleLabel.y + subtitleLabel.height + 8;
    }

    if (options.rightText) {
      this.drawText(parent, options.rightText, panelWidth - 72, 23, {
        fill: uiTheme.accentStrong,
        fontSize: uiTextSize.actionValue,
        fontWeight: "900",
      }).anchor.set(1, 0);
    }

    const headerBottom = Math.max(86, Math.ceil(contentY + 8));
    drawModalHeaderPlane(headerBackground, panelWidth, headerBottom);

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

    return headerBottom;
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
    return this.createModalRectButton(parent, label, x, y, width, height, {
      detail,
      disabled,
      tooltip,
      tone: "primary",
      fontSize: uiTextSize.small,
    });
  }

  private createModalRectButton(
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      detail?: PixiActionDetail;
      onTap?: () => void;
      disabled?: boolean;
      tooltip?: string;
      tone: RectButtonOptions["tone"];
      fontSize: number;
    },
  ): Container {
    const symbolIconId = this.getSymbolButtonIconId(label);
    return this.createRectButton(parent, {
      label: symbolIconId ? undefined : label,
      iconId: symbolIconId,
      x,
      y,
      width,
      height,
      detail: options.detail,
      onTap: options.onTap,
      disabled: options.disabled,
      tooltip: options.tooltip,
      tone: symbolIconId ? "secondary" : options.tone,
      fontSize: options.fontSize,
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
        fill: uiTheme.accentStrong,
        fontSize: uiTextSize.small,
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
    return this.createModalRectButton(parent, label, x, y, width, height, {
      onTap,
      disabled,
      tone: "secondary",
      fontSize: uiTextSize.bodyLarge,
    });
  }

  private getSymbolButtonIconId(label: string): string | undefined {
    if (label === "+") {
      return "plus";
    }

    if (label === "-") {
      return "minus";
    }

    return undefined;
  }

  private createPill(
    label: string,
    iconId: string,
    tooltip?: string,
    sublabel?: string,
    sublabelFill = uiTheme.textMuted,
    action?: PixiActionDetail,
    labelFill = uiTheme.text,
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
      fontSize: uiTextSize.body,
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
    disabled = false,
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
      disabled,
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
        fill: impact.negative ? uiTheme.negative : uiTheme.positive,
        fontSize: uiTextSize.caption,
        fontWeight: "900",
      });
      const chipWidth = Math.max(42, 32 + value.width);
      const background = new Graphics();
      const chipFill = impact.negative ? uiTheme.negativeSurface : uiTheme.positiveSurface;
      background.rect(0, 0, chipWidth, 22)
        .fill({ color: chipFill, alpha: 0.5 });
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
      box.roundRect(0, 0, tabWidth, options.height, UI_CONTROL_RADIUS)
        .fill({ color: active ? uiTheme.accentSurface : uiTheme.surfaceMuted, alpha: active ? 0.72 : 0.42 })
        .stroke({ color: uiTheme.border, alpha: active ? 0.78 : 0.42, width: 1 });
      tabLayer.addChild(box);
      this.drawCenteredText(tabLayer, tab.label, tabWidth / 2, options.height / 2, {
        fill: active ? uiTheme.text : uiTheme.textMuted,
        fontSize: uiTextSize.small,
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
        .fill({ color: uiTheme.tooltip, alpha: 0.96 });
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

  private drawPowerWarning(parent: Container, bounds: Bounds): void {
    this.drawBuildingStatusBadge(parent, bounds, {
      iconId: "power-warning",
      slot: "right",
      tone: "danger",
      iconSize: 19,
    });
  }

  private drawBuildingStatusBadge(
    parent: Container,
    bounds: Bounds,
    options: {
      iconId: string;
      slot: "left" | "center" | "right";
      tone: "danger" | "neutral" | "active";
      iconSize: number;
      label?: string;
      tooltip?: string;
    },
  ): Container {
    const slotX = options.slot === "left"
      ? -bounds.width * 0.28
      : options.slot === "right"
        ? bounds.width * 0.28
        : 0;
    return this.drawStatusBadgeAt(parent, slotX, -bounds.height * 0.44, options);
  }

  private drawStatusBadgeAt(
    parent: Container,
    x: number,
    y: number,
    options: {
      iconId: string;
      tone: "danger" | "neutral" | "active";
      iconSize: number;
      label?: string;
      tooltip?: string;
    },
  ): Container {
    const hasLabel = Boolean(options.label);
    const width = hasLabel ? Math.max(58, 38 + (options.label?.length ?? 0) * 8) : 32;
    const height = hasLabel ? 28 : 32;
    const badge = new Container();
    badge.x = x;
    badge.y = y;
    badge.hitArea = new Rectangle(-width / 2, -height / 2, width, height);
    parent.addChild(badge);

    const fill = uiTheme.surfaceSunken;
    const alpha = 0.86;

    const shadow = new Graphics();
    if (hasLabel) {
      shadow.roundRect(-width / 2 + 2, -height / 2 + 3, width, height, 3)
        .fill({ color: uiTheme.shadow, alpha: 0.18 });
    } else {
      shadow.circle(2, 3, 16).fill({ color: uiTheme.shadow, alpha: 0.18 });
    }
    badge.addChild(shadow);

    const background = new Graphics();
    if (hasLabel) {
      background.roundRect(-width / 2, -height / 2, width, height, 3)
        .fill({ color: fill, alpha });
    } else {
      background.circle(0, 0, 16).fill({ color: fill, alpha });
    }
    badge.addChild(background);

    const iconX = hasLabel ? -width / 2 + 15 : 0;
    const iconY = options.iconId === "power-warning" ? 1 : 0;
    this.drawIcon(badge, options.iconId, iconX, iconY, options.iconSize);

    if (options.label) {
      this.drawText(badge, options.label, -width / 2 + 29, -7, {
        fill: uiTheme.accentStrong,
        fontSize: uiTextSize.caption,
        fontWeight: "900",
      });
    }

    if (options.tooltip) {
      this.bindTooltip(badge, options.tooltip);
    }

    return badge;
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
    const buildingName = translations?.buildings[buildingId].name ?? buildingById[buildingId].name;
    const workerLabel = translations?.ui.workers ?? "Workers";
    const sleepLabel = translations?.ui.sleeping ?? "Idle";
    const tooltip = asleep
      ? `${buildingName}: ${sleepLabel} (${workerLabel} 0/${workerLimit})`
      : `${buildingName}: ${workerLabel} ${workers}/${workerLimit}`;

    if (asleep) {
      this.drawBuildingStatusBadge(parent, bounds, {
        iconId: "sleep",
        slot: "left",
        tone: "neutral",
        iconSize: 20,
        tooltip,
      });
      return;
    }

    this.drawBuildingStatusBadge(parent, bounds, {
      iconId: "people",
      slot: "left",
      tone: "active",
      iconSize: 13,
      label: `${workers}/${workerLimit}`,
      tooltip,
    });
  }

  private drawConstructionCountdown(
    parent: Container,
    remainingSeconds: number,
    x: number,
    y: number,
    _width: number,
    translations?: TranslationPack,
  ): void {
    const label = `${Math.ceil(remainingSeconds)}s`;
    this.drawStatusBadgeAt(parent, x, y, {
      iconId: "clock",
      tone: "active",
      iconSize: 13,
      label,
      tooltip: `${translations?.ui.buildingQueue ?? "Building queue"}: ${label}`,
    });
  }

  private createBuildingSprite(buildingId: BuildingId, level: number, built: boolean): Sprite {
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
    return measureHudWrappedTextHeight(text, fontSize, fontWeight, maxWidth);
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
    this.scaleBounds(this.buildingBonusScrollArea, scale);
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
    const next = refreshCameraStateTransform(this.host, this.cameraLayer, defaultVillageLayout, this.layout, {
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
      defaultVillageLayout,
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
      defaultVillageLayout,
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

  private getCameraVisibleWorldBounds(): Bounds | null {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;

    if (width <= 0 || height <= 0 || this.cameraZoom <= 0) {
      return null;
    }

    return {
      x: -this.cameraOffsetX / this.cameraZoom,
      y: -this.cameraOffsetY / this.cameraZoom,
      width: width / this.cameraZoom,
      height: height / this.cameraZoom,
    };
  }

  private getLayout(width: number, height: number): SceneLayout {
    return getSceneLayout(width, height);
  }

  private getStaticWorldKey(): string {
    return [
      this.layout.scale.toFixed(4),
      this.layout.originX.toFixed(2),
      this.layout.originY.toFixed(2),
    ].join("|");
  }

  private resetTerrainTintBindings(): void {
    this.terrainTintBindings.length = 0;
    this.lastTerrainCondition = null;
  }

  private disableStaticWorldCache(): void {
    if (!this.staticWorldCachedAsTexture) {
      return;
    }

    this.cameraStaticLayer.cacheAsTexture(false);
    this.staticWorldCachedAsTexture = false;
  }

  private enableStaticWorldCacheIfEligible(): void {
    if (
      !this.canCacheStaticWorldAsTexture ||
      this.staticWorldCachedAsTexture ||
      !this.isStaticWorldCacheSizeSafe()
    ) {
      return;
    }

    this.cameraStaticLayer.cacheAsTexture({
      antialias: false,
      resolution: 1,
      scaleMode: "nearest",
    });
    this.staticWorldCachedAsTexture = true;
  }

  private isStaticWorldCacheSizeSafe(): boolean {
    const mapBounds = getMapRenderBounds(defaultVillageLayout, this.layout);

    return mapBounds.width <= STATIC_WORLD_CACHE_MAX_TEXTURE_SIZE &&
      mapBounds.height <= STATIC_WORLD_CACHE_MAX_TEXTURE_SIZE;
  }

  private computeStaticWorldCacheEligibility(): boolean {
    return false;
  }

  private updateStaticWorldCullArea(): void {
    const mapBounds = getMapRenderBounds(defaultVillageLayout, this.layout);

    this.cameraStaticLayer.cullArea = new Rectangle(
      mapBounds.x,
      mapBounds.y,
      mapBounds.width,
      mapBounds.height,
    );
    this.cameraNpcLayer.cullArea = new Rectangle(
      mapBounds.x,
      mapBounds.y,
      mapBounds.width,
      mapBounds.height,
    );
    this.cameraForegroundDecorLayer.cullArea = new Rectangle(
      mapBounds.x,
      mapBounds.y,
      mapBounds.width,
      mapBounds.height,
    );
    this.cameraSkyLayer.cullArea = new Rectangle(
      mapBounds.x - mapBounds.width * 0.2,
      mapBounds.y - mapBounds.height * 0.3,
      mapBounds.width * 1.4,
      mapBounds.height * 1.5,
    );
    this.cameraBirdLayer.cullArea = this.cameraSkyLayer.cullArea;
  }

  private clearMapNpcs(): void {
    this.mapNpcs.clear();
    this.settlementNpcs.clear();
    this.cameraMapNpcLayer.removeChildren();
    this.cameraSettlementNpcLayer.removeChildren();
  }

  private clearMapBirds(): void {
    this.mapBirds.clear();
    this.cameraBirdLayer.removeChildren();
  }

  private trackTerrainSprite(
    sprite: Sprite,
    tintByEnvironment?: Partial<Record<EnvironmentConditionId, number>>,
  ): void {
    if (!tintByEnvironment || Object.keys(tintByEnvironment).length === 0) {
      return;
    }

    this.terrainTintBindings.push({ sprite, tintByEnvironment });
  }

  private applyTerrainTintForCondition(condition: EnvironmentConditionId): boolean {
    if (condition === this.lastTerrainCondition) {
      return false;
    }

    for (const binding of this.terrainTintBindings) {
      binding.sprite.tint = binding.tintByEnvironment?.[condition] ?? 0xffffff;
    }

    this.lastTerrainCondition = condition;
    return true;
  }

  private getPlotBounds(plot: Pick<VillagePlotDefinition, "x" | "y" | "width" | "height">): Bounds {
    return mapRectToSceneBounds(defaultVillageLayout, this.layout, plot);
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
    return wrapHudTextLines(text, {
      fontSize: uiTextSize.caption,
      fontWeight,
      maxWidth,
    });
  }
}
