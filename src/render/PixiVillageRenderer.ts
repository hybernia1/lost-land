import {
  Application,
  Container,
  Graphics,
  Rectangle,
  Text,
  Sprite,
  type FrameObject,
  type TextStyleFontWeight,
} from "pixi.js";
import { resourceDefinitions } from "../data/resources";
import { buildingById, buildingDefinitions } from "../data/buildings";
import { getEnvironmentDefinition } from "../data/environment";
import { decisionQuestById, type DecisionQuestOptionDefinition } from "../data/decisions";
import { objectiveQuestById } from "../data/quests";
import { defaultVillageLayout } from "../data/villageLayouts";
import type { VillagePlotDefinition } from "../data/villagePlots";
import { DAY_START_HOUR, formatGameClock, GAME_HOUR_REAL_SECONDS, getDaylightState, getGameDay, NIGHT_START_HOUR } from "../game/time";
import type { BuildingCategory, BuildingId, DecisionHistoryEntry, DecisionOptionId, EnvironmentConditionId, GameSpeed, GameState, MarketResourceId, ResourceBag, ResourceId, ScoutingMode } from "../game/types";
import type { TranslationPack } from "../i18n/types";
import {
  getAvailableBuildingsForPlot,
  getActiveBuildingQueue,
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
  MAX_ACTIVE_BUILDINGS,
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
import {
  canAffordDecisionOption,
  decisionProfileAxes,
  getActiveObjectiveQuests,
  getDecisionProfileAxisValue,
  getDecisionProfileKind,
  getObjectiveQuestProgress,
  type DecisionProfileKind,
} from "../systems/quests";
import { SCOUTING_CARRY_PER_TROOP, SCOUTING_DURATION_SECONDS, getScoutingTroopCount } from "../systems/scouting";
import { drawPixiIcon } from "./pixiIcons";
import { VillageAssets } from "./villageAssets";

type SceneLayout = {
  originX: number;
  originY: number;
  width: number;
  height: number;
  scale: number;
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TextureAnimationFrame = {
  texture: FrameObject["texture"];
  durationMs: number;
};

type TextureAnimationBinding = {
  sprite: Sprite;
  frames: TextureAnimationFrame[];
  totalDurationMs: number;
  currentFrameIndex: number;
};

export type PixiActionDetail = {
  action?: string;
  building?: BuildingId;
  plot?: string;
  delta?: number;
  troopCount?: number;
  scoutMode?: ScoutingMode;
  scoutTroops?: number;
  questOption?: DecisionOptionId;
  resourceId?: ResourceId;
  marketFromResource?: ResourceId;
  marketToResource?: ResourceId;
  marketAmount?: number;
  speed?: GameSpeed;
  continuousShifts?: boolean;
};

export type VillageInfoPanel = ResourceId | "survivors" | "decisionArchive";

type EffectLine = {
  iconId: string;
  value: string;
  tooltip: string;
  negative?: boolean;
};

type BrandAlert = {
  iconId: string;
  label?: string;
  tooltip?: string;
  tone: "cold" | "danger" | "warning" | "neutral";
};

type ActiveEnvironmentConditionId = Exclude<EnvironmentConditionId, "stable">;

const decisionProfileIconByKind: Record<DecisionProfileKind, string> = {
  noData: "profile-no-data",
  balanced: "profile-balanced",
  philanthropist: "profile-philanthropist",
  principled: "profile-principled",
  merciful: "profile-merciful",
  security: "profile-security",
  open: "profile-open",
  cautious: "profile-cautious",
};

const decisionProfileLabelKeyByKind: Record<DecisionProfileKind, string> = {
  noData: "profileNoData",
  balanced: "profileBalanced",
  philanthropist: "profilePhilanthropist",
  principled: "profilePrincipled",
  merciful: "profileMerciful",
  security: "profileSecurity",
  open: "profileOpen",
  cautious: "profileCautious",
};

const environmentAlertIconByCondition: Record<ActiveEnvironmentConditionId, string> = {
  rain: "crisis-rain",
  snowFront: "crisis-snow",
  radiation: "crisis-radiation",
};

const environmentAlertToneByCondition: Record<ActiveEnvironmentConditionId, BrandAlert["tone"]> = {
  rain: "neutral",
  snowFront: "cold",
  radiation: "danger",
};

type DecisionHistoryRow = {
  entry: DecisionHistoryEntry;
  originalIndex: number;
};

type CostLinePart = {
  text: string;
  iconId: string;
  missing: boolean;
  tooltip: string;
};

type BuildingMetric = {
  iconId: string;
  label: string;
  value: string;
  fill?: number;
  tooltip?: string;
};

type ResourceBreakdownTab = "production" | "consumption";
type BarracksTab = "training" | "scouting";

type RectButtonTone = "primary" | "secondary" | "toolbar";

type RectButtonOptions = {
  label?: string;
  iconId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  detail?: PixiActionDetail;
  onTap?: () => void;
  tooltip?: string;
  disabled?: boolean;
  active?: boolean;
  tone?: RectButtonTone;
  fontSize?: number;
  fontWeight?: TextStyleFontWeight;
};

type CircleButtonOptions = {
  iconId: string;
  x: number;
  y: number;
  radius: number;
  detail: PixiActionDetail;
  tooltip: string;
  active?: boolean;
};

type TabItem<T extends string> = {
  id: T;
  label: string;
};

type TabOptions<T extends string> = {
  activeId: T;
  x: number;
  y: number;
  height: number;
  gap?: number;
  minWidth: number;
  maxWidth?: number;
  maxTabWidth?: number;
  onSelect: (id: T) => void;
};

const resourceColors: Record<ResourceId, number> = {
  food: 0xd8b66a,
  water: 0x66bde8,
  material: 0xc7c9bd,
  coal: 0x8f9589,
  morale: 0xe9a0a0,
};

const VILLAGE_BUILDING_RENDER_SCALE = 2;
const BUILDING_PREVIEW_BASE_RENDER_SCALE = 1.3;
const BUILDING_PREVIEW_RENDER_SCALE = Math.max(
  1,
  VILLAGE_BUILDING_RENDER_SCALE / BUILDING_PREVIEW_BASE_RENDER_SCALE,
);
const villagePlotDefinitions = defaultVillageLayout.plots;
const nonPerimeterVillagePlots = villagePlotDefinitions.filter((candidate) => candidate.kind !== "perimeter");
const buildCategoryOrder: BuildingCategory[] = ["resource", "housing", "defense", "support"];
const HUD_MAX_PIXEL_SCALE = 1.2;
const HUD_TOP_STRIP_HEIGHT = 68;
const HUD_SIDE_PANEL_MARGIN = 0;
const HUD_LEFT_PANEL_WIDTH = 366;
const CAMERA_MIN_ZOOM = 0.75;
const CAMERA_MAX_ZOOM = 1.75;
const CAMERA_ZOOM_STEP = 0.0018;
const CAMERA_SMOOTH_FACTOR = 0.2;
const CAMERA_OFFSET_SNAP_EPSILON = 0.2;
const CAMERA_ZOOM_SNAP_EPSILON = 0.001;
const MAX_RENDER_RESOLUTION = 1.5;
const MAX_VISUAL_FPS = 30;
const VISUAL_FRAME_MIN_MS = 1000 / MAX_VISUAL_FPS;
const MAX_TEXTURE_ANIMATION_FPS = 10;
const TEXTURE_ANIMATION_FRAME_MIN_MS = 1000 / MAX_TEXTURE_ANIMATION_FPS;
const MAX_WEATHER_OVERLAY_FPS = 12;
const WEATHER_OVERLAY_FRAME_MIN_MS = 1000 / MAX_WEATHER_OVERLAY_FPS;
const MAX_DAYLIGHT_TRANSITION_FPS = 4;
const DAYLIGHT_TRANSITION_FRAME_MIN_MS = 1000 / MAX_DAYLIGHT_TRANSITION_FPS;
const DAYLIGHT_DARKNESS_BUCKET_STEP = 0.015;

function upgradingTooltip(
  name: string,
  level: number,
  upgradingRemaining: number,
  levelLabel: string,
): string {
  const status = upgradingRemaining > 0
    ? `${Math.ceil(upgradingRemaining)}s`
    : `${levelLabel} ${level}`;
  return `${name} / ${status}`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

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
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 13,
      fontWeight: "700",
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
  private activeBuildCategory: BuildingCategory = "resource";
  private activeBarracksTab: BarracksTab = "training";
  private barracksTroopCount = 1;
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
  private cameraDragStart: { x: number; y: number; offsetX: number; offsetY: number } | null = null;
  private cameraDragMoved = false;
  private cameraDragBlocked = false;
  private lastStaticWorldKey: string | null = null;
  private lastBackgroundKey: string | null = null;
  private ambientAnimationFrameId: number | null = null;
  private ambientCondition: EnvironmentConditionId = "stable";
  private ambientIntensity = 1;
  private ambientElapsedSeconds = 0;
  private ambientSpeed: GameSpeed = 1;
  private ambientPaused = false;
  private ambientSyncAtMs = 0;
  private lastVisualFrameAtMs = 0;
  private lastEnvironmentOverlayFrameAtMs = 0;
  private lastDaylightOverlayFrameAtMs = 0;
  private lastEnvironmentOverlayKey = "";
  private lastDaylightOverlayKey = "";
  private lastTextureAnimationFrameAtMs = 0;
  private lastFormattedLogSource: ReadonlyArray<GameState["log"][number]> | null = null;
  private lastFormattedLogTranslations: TranslationPack | undefined;
  private lastFormattedLogEntries: string[] = [];
  private readonly textureAnimationBindings = new Set<TextureAnimationBinding>();
  private canvasTooltipText = "";
  private canvasTooltipWidth = 0;
  private canvasTooltipHeight = 0;
  private readonly handleWheel = (event: WheelEvent) => this.handleHostWheel(event);
  private readonly handleMouseLeave = () => this.hideCanvasTooltip();
  private readonly handlePointerDown = (event: PointerEvent) => this.handleHostPointerDown(event);
  private readonly handlePointerMove = (event: PointerEvent) => this.handleHostPointerMove(event);
  private readonly handlePointerUp = (event: PointerEvent) => this.handleHostPointerUp(event);
  private readonly handleAmbientAnimationFrame = (timestamp: number) => this.animateAmbientOverlays(timestamp);

  constructor(
    private readonly host: HTMLElement,
    private readonly requestRender: () => void = () => {},
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
    void this.initialize();
  }

  render(
    state: GameState,
    translations?: TranslationPack,
    modalPlotId?: string | null,
    infoPanel?: VillageInfoPanel | null,
    resolvedDecisionPreview?: DecisionHistoryEntry | null,
  ): void {
    this.lastState = state;
    this.lastTranslations = translations;
    this.cameraDragBlocked = Boolean(
      modalPlotId ||
      infoPanel ||
      state.quests.activeDecision ||
      resolvedDecisionPreview,
    );

    if (!this.app) {
      return;
    }

    const width = this.host.clientWidth;
    const height = this.host.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    this.layout = this.getLayout(width, height);
    const hudPixelScale = this.getHudPixelScale(width, height);
    const hudWidth = width / hudPixelScale;
    const hudHeight = height / hudPixelScale;
    const visualTime = performance.now() / 1000;
    this.hudPixelScale = hudPixelScale;
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
      this.drawTerrain(state);
      this.drawDecorObjects();
      this.lastStaticWorldKey = staticWorldKey;
    }
    const backgroundKey = `${Math.round(width)}x${Math.round(height)}`;
    if (backgroundKey !== this.lastBackgroundKey) {
      this.clearContainerChildren(this.backgroundLayer);
      this.drawBackground(state, width, height);
      this.lastBackgroundKey = backgroundKey;
    }
    this.drawPalisade(state, translations);

    for (const plot of nonPerimeterVillagePlots) {
      this.drawPlot(plot, state, translations, visualTime);
    }

    this.drawHud(state, translations, hudWidth, hudHeight);
    this.drawVillageModal(state, translations, hudWidth, hudHeight, modalPlotId ?? null);
    this.drawInfoPanel(state, translations, hudWidth, hudHeight, infoPanel ?? null);
    this.drawQuestDecisionModal(
      state,
      translations,
      hudWidth,
      hudHeight,
      resolvedDecisionPreview ?? null,
    );
    this.syncAmbientOverlayState(state);
    this.refreshAmbientOverlays(performance.now(), true);
    this.updateAmbientAnimationLoop();
    this.applyHudPixelScale(this.hudLayer, hudPixelScale);
    this.scaleHudInteractionBounds(hudPixelScale);
    this.app.render();
  }

  private clearContainerChildren(container: Container): void {
    const children = container.removeChildren();

    for (const child of children) {
      this.unregisterTextureAnimationsForNode(child as Container);

      child.destroy({ children: true });
    }
  }

  hitTest(clientX: number, clientY: number): string | null {
    const rect = this.host.getBoundingClientRect();
    const x = (clientX - rect.left - this.cameraOffsetX) / this.cameraZoom;
    const y = (clientY - rect.top - this.cameraOffsetY) / this.cameraZoom;

    return (
      villagePlotDefinitions.find((plot) => {
        const bounds = this.getPlotBounds(plot);
        return (
          x >= bounds.x &&
          x <= bounds.x + bounds.width &&
          y >= bounds.y &&
          y <= bounds.y + bounds.height
        );
      })?.id ?? null
    );
  }

  private handleHostWheel(event: WheelEvent): void {
    if (this.handleScrollableWheel(
      event,
      this.resourceBreakdownScrollArea,
      this.resourceBreakdownScrollMax,
      this.resourceBreakdownScrollY,
      (value) => {
        this.resourceBreakdownScrollY = value;
      },
    )) {
      return;
    }

    if (this.handleScrollableWheel(event, this.logScrollArea, this.logScrollMax, this.logScrollY, (value) => {
      this.logScrollY = value;
    })) {
      return;
    }

    if (this.handleScrollableWheel(
      event,
      this.decisionHistoryScrollArea,
      this.decisionHistoryScrollMax,
      this.decisionHistoryScrollY,
      (value) => {
        this.decisionHistoryScrollY = value;
      },
    )) {
      return;
    }

    if (this.handleBuildChoicesWheel(event)) {
      return;
    }

    if (this.isHudPointer(event.clientX, event.clientY)) {
      event.preventDefault();
      return;
    }

    this.handleCameraZoom(event);
  }

  private handleBuildChoicesWheel(event: WheelEvent): boolean {
    if (!this.buildChoicesScrollArea || this.buildChoicesScrollMax <= 0) {
      return false;
    }

    const rect = this.host.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const area = this.buildChoicesScrollArea;

    if (
      x < area.x ||
      x > area.x + area.width ||
      y < area.y ||
      y > area.y + area.height
    ) {
      return false;
    }

    event.preventDefault();
    const nextScroll = Math.max(
      0,
      Math.min(this.buildChoicesScrollMax, this.buildChoicesScrollY + this.getLogicalWheelDelta(event)),
    );

    if (nextScroll === this.buildChoicesScrollY) {
      return true;
    }

    this.buildChoicesScrollY = nextScroll;
    this.requestRender();
    return true;
  }

  private handleScrollableWheel(
    event: WheelEvent,
    area: Bounds | null,
    scrollMax: number,
    scrollY: number,
    setScrollY: (value: number) => void,
  ): boolean {
    if (!area || scrollMax <= 0) {
      return false;
    }

    const rect = this.host.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (
      x < area.x ||
      x > area.x + area.width ||
      y < area.y ||
      y > area.y + area.height
    ) {
      return false;
    }

    event.preventDefault();
    const nextScroll = Math.max(0, Math.min(scrollMax, scrollY + this.getLogicalWheelDelta(event)));

    if (nextScroll === scrollY) {
      return true;
    }

    setScrollY(nextScroll);
    this.requestRender();
    return true;
  }

  private handleCameraZoom(event: WheelEvent): void {
    if (this.cameraDragBlocked || this.isHudPointer(event.clientX, event.clientY)) {
      event.preventDefault();
      return;
    }

    const rect = this.host.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const previousZoom = this.cameraTargetZoom;
    const nextZoom = Math.max(
      CAMERA_MIN_ZOOM,
      Math.min(CAMERA_MAX_ZOOM, previousZoom * Math.exp(-event.deltaY * CAMERA_ZOOM_STEP)),
    );

    if (nextZoom === previousZoom) {
      event.preventDefault();
      return;
    }

    const worldX = (x - this.cameraTargetOffsetX) / previousZoom;
    const worldY = (y - this.cameraTargetOffsetY) / previousZoom;
    this.cameraTargetZoom = nextZoom;
    this.cameraTargetOffsetX = x - worldX * nextZoom;
    this.cameraTargetOffsetY = y - worldY * nextZoom;
    this.clampTargetCamera(this.host.clientWidth, this.host.clientHeight);
    this.updateAmbientAnimationLoop();
    event.preventDefault();
  }

  private handleHostPointerDown(event: PointerEvent): void {
    if (this.cameraDragBlocked || event.button !== 0 || this.isHudPointer(event.clientX, event.clientY)) {
      return;
    }

    this.cameraDragStart = {
      x: event.clientX,
      y: event.clientY,
      offsetX: this.cameraTargetOffsetX,
      offsetY: this.cameraTargetOffsetY,
    };
    this.cameraDragMoved = false;
    this.host.setPointerCapture(event.pointerId);
  }

  private handleHostPointerMove(event: PointerEvent): void {
    if (!this.cameraDragStart) {
      return;
    }

    const deltaX = event.clientX - this.cameraDragStart.x;
    const deltaY = event.clientY - this.cameraDragStart.y;

    if (!this.cameraDragMoved && Math.hypot(deltaX, deltaY) < 5) {
      return;
    }

    this.cameraDragMoved = true;
    this.cameraTargetOffsetX = this.cameraDragStart.offsetX + deltaX;
    this.cameraTargetOffsetY = this.cameraDragStart.offsetY + deltaY;
    this.clampTargetCamera(this.host.clientWidth, this.host.clientHeight);
    this.updateAmbientAnimationLoop();
    event.preventDefault();
  }

  private handleHostPointerUp(event: PointerEvent): void {
    if (!this.cameraDragStart) {
      return;
    }

    this.cameraDragStart = null;

    if (this.host.hasPointerCapture(event.pointerId)) {
      this.host.releasePointerCapture(event.pointerId);
    }

    if (this.cameraDragMoved) {
      this.cameraDragMoved = false;
      this.consumeHostClick();
    }
  }

  private isHudPointer(clientX: number, clientY: number): boolean {
    const rect = this.host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return this.hudInteractionAreas.some((area) =>
      x >= area.x &&
      x <= area.x + area.width &&
      y >= area.y &&
      y <= area.y + area.height
    );
  }

  destroy(): void {
    this.host.removeEventListener("wheel", this.handleWheel);
    this.host.removeEventListener("mouseleave", this.handleMouseLeave);
    this.host.removeEventListener("pointerdown", this.handlePointerDown);
    this.host.removeEventListener("pointermove", this.handlePointerMove);
    this.host.removeEventListener("pointerup", this.handlePointerUp);
    this.host.removeEventListener("pointercancel", this.handlePointerUp);
    this.stopAmbientAnimation();
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

  private drawBackground(_state: GameState, width: number, height: number): void {
    const base = new Graphics();
    base.rect(0, 0, width, height).fill({ color: 0x151812, alpha: 1 });
    this.backgroundLayer.addChild(base);

    const overlay = new Graphics();
    overlay.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.08 });
    this.backgroundLayer.addChild(overlay);
  }

  private drawTerrain(state: GameState): void {
    const layout = defaultVillageLayout;

    const scale = this.layout.scale;
    const tileSize = layout.tileSize * scale;
    const terrainWidth = layout.width * scale;
    const terrainHeight = layout.height * scale;
    const originX = this.layout.originX + this.layout.width / 2 - terrainWidth / 2;
    const originY = this.layout.originY + this.layout.height / 2 - terrainHeight / 2;

    for (const layer of layout.tileLayers) {
      for (const tile of layer.tiles) {
        const tileX = originX + tile.x * tileSize;
        const tileY = originY + tile.y * tileSize;

        const sprite = this.createTerrainSprite(tile.textureKey);

        if (!sprite) {
          continue;
        }
        const tileDefinition = layout.tileTextures[tile.textureKey];
        const tint = tileDefinition.tintByEnvironment?.[state.environment.condition];

        if (tint) {
          sprite.tint = tint;
        }

        sprite.alpha = layer.opacity;

        if (tile.rotation || tile.flipX || tile.flipY) {
          sprite.anchor.set(0.5);
          sprite.rotation = ((tile.rotation ?? 0) * Math.PI) / 180;
          sprite.x = tileX + tileSize / 2;
          sprite.y = tileY + tileSize / 2;
          sprite.scale.set(
            (tile.flipX ? -1 : 1) * ((tileSize + 0.5) / sprite.texture.width),
            (tile.flipY ? -1 : 1) * ((tileSize + 0.5) / sprite.texture.height),
          );
        } else {
          sprite.x = tileX;
          sprite.y = tileY;
          sprite.width = tileSize + 0.5;
          sprite.height = tileSize + 0.5;
        }

        this.cameraStaticLayer.addChild(sprite);
      }
    }
  }

  private drawDecorObjects(): void {
    const layout = defaultVillageLayout;
    const scale = this.layout.scale;
    const terrainWidth = layout.width * scale;
    const terrainHeight = layout.height * scale;
    const originX = this.layout.originX + this.layout.width / 2 - terrainWidth / 2;
    const originY = this.layout.originY + this.layout.height / 2 - terrainHeight / 2;

    for (const layer of layout.objectLayers.filter((candidate) => candidate.name === "decor")) {
      const objects = [...layer.objects].sort((left, right) => left.y - right.y);

      for (const object of objects) {
        if (!object.textureKey) {
          continue;
        }

        const objectX = originX + object.x * scale;
        const objectY = originY + object.y * scale;
        const objectWidth = object.width * scale;
        const objectHeight = object.height * scale;

        const sprite = this.createTerrainSprite(object.textureKey);

        if (!sprite) {
          continue;
        }
        sprite.anchor.set(0, 1);
        sprite.x = objectX;
        sprite.y = objectY;
        sprite.width = objectWidth;
        sprite.height = objectHeight;
        sprite.rotation = (object.rotation * Math.PI) / 180;
        sprite.alpha = object.opacity * layer.opacity;
        this.cameraStaticLayer.addChild(sprite);
      }
    }
  }

  private drawPalisade(
    state: GameState,
    translations?: TranslationPack,
  ): void {
    const plot = state.village.plots.find((candidate) => candidate.id === "plot-palisade");
    const plotDefinition = villagePlotDefinitions.find((candidate) => candidate.id === "plot-palisade");
    const building = plot?.buildingId ? state.buildings[plot.buildingId] : null;
    const selected = state.village.selectedPlotId === "plot-palisade";

    if (!plotDefinition) {
      return;
    }

    const bounds = this.getPlotBounds(plotDefinition);
    const badgeX = bounds.x + bounds.width / 2;
    const badgeY = bounds.y - 18 * this.layout.scale;

    this.addPalisadeTooltip(
      selected,
      building?.level ?? 0,
      building?.upgradingRemaining ?? 0,
      translations?.buildings.palisade.name ?? "Palisade",
    );

    if (building) {
      this.drawBuildingLevelBadge(
        this.cameraDynamicLayer,
        Math.max(1, building.level),
        badgeX,
        badgeY,
        translations,
        translations?.buildings.palisade.name ?? "Palisade",
      );
    }

    if (building && building.upgradingRemaining > 0) {
      this.drawConstructionCountdown(
        this.cameraDynamicLayer,
        building.upgradingRemaining,
        bounds.x + bounds.width / 2,
        bounds.y - 52 * this.layout.scale,
        Math.max(70, 86 * this.layout.scale),
        undefined,
      );
    }
  }

  private drawPlot(
    plot: VillagePlotDefinition,
    state: GameState,
    translations?: TranslationPack,
    visualTime = 0,
  ): void {
    const plotState = state.village.plots.find((candidate) => candidate.id === plot.id);
    const buildingId = plotState?.buildingId ?? null;
    const building = buildingId ? state.buildings[buildingId] : null;
    const definition = buildingId ? buildingById[buildingId] : null;
    const name = buildingId && definition
      ? translations?.buildings[buildingId].name ?? definition.name
      : "";
    const bounds = this.getPlotBounds(plot);
    const selected = state.village.selectedPlotId === plot.id;
    const isMainPlot = plot.allowedBuildingIds?.includes("mainBuilding") ?? false;

    const plotLayer = new Container();
    plotLayer.x = bounds.x + bounds.width / 2;
    plotLayer.y = bounds.y + bounds.height / 2;
    plotLayer.hitArea = {
      contains: (x: number, y: number) =>
        x >= -bounds.width / 2 &&
        x <= bounds.width / 2 &&
        y >= -bounds.height / 2 &&
        y <= bounds.height / 2,
    };
    this.cameraDynamicLayer.addChild(plotLayer);

    if (buildingId && building) {
      const tooltip = upgradingTooltip(
        name,
        building.level,
        building.upgradingRemaining,
        translations?.ui.level ?? "Lvl",
      );
      this.bindTooltip(plotLayer, tooltip);

      const asset = this.createBuildingSprite(buildingId, Math.max(1, building.level), building.level > 0);
      asset.anchor.set(0.5);
      this.fitSprite(
        asset,
        bounds.width * VILLAGE_BUILDING_RENDER_SCALE,
        bounds.height * VILLAGE_BUILDING_RENDER_SCALE,
      );
      asset.alpha = building.level > 0 || isMainPlot ? 1 : 0.62;
      plotLayer.addChild(asset);
      if (isBuildingInactiveDueToCoal(state, buildingId)) {
        this.drawPowerWarning(plotLayer, bounds);
      }
      this.drawBuildingLevelBadge(
        plotLayer,
        Math.max(1, building.level),
        -bounds.width * 0.43,
        -bounds.height * 0.5,
        translations,
        name,
      );
      this.drawBuildingWorkerBadge(plotLayer, buildingId, building.workers, getBuildingWorkerLimit(state, buildingId), bounds, translations);
      if (building.upgradingRemaining > 0) {
        this.drawConstructionCountdown(
          plotLayer,
          building.upgradingRemaining,
          0,
          -bounds.height * 0.72,
          Math.max(64, Math.min(92, bounds.width * 0.82)),
          translations,
        );
      }
      return;
    }

    this.bindTooltip(plotLayer, translations?.ui.emptyPlot ?? "Empty plot");
    const empty = new Graphics();
    const markerSize = Math.min(bounds.width, bounds.height) * 0.42;
    const alpha = selected ? 0.95 : 0.44;
    empty
      .circle(0, 0, markerSize * 0.52)
      .fill({ color: 0x10120e, alpha: selected ? 0.24 : 0.12 })
      .stroke({
        color: selected ? 0xf3c85f : 0xe0c46f,
        alpha,
        width: selected ? 3 : 2,
      });
    empty
      .moveTo(-markerSize * 0.22, 0)
      .lineTo(markerSize * 0.22, 0)
      .moveTo(0, -markerSize * 0.22)
      .lineTo(0, markerSize * 0.22)
      .stroke({
        color: selected ? 0xf3c85f : 0xeadca0,
        alpha: selected ? 0.95 : 0.58,
        width: Math.max(3, 5 * this.layout.scale),
      });
    plotLayer.addChild(empty);
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
    const population = getPopulation(state) + getScoutingTroopCount(state);
    const housing = getHousingStatus(state);
    const rates = getResourceProductionRates(state);
    const moraleRate = this.getHourlyRateLabel(rates.morale);
    const moraleRateColor = this.getRateColor(rates.morale);

    const profileKind = getDecisionProfileKind(state);
    const profileLabel = t ? this.getDecisionProfileOverallLabel(state, t) : undefined;
    const profileTooltip = t && profileLabel
      ? `${t.ui.leadershipProfile ?? "Leadership profile"}\n${profileLabel}`
      : undefined;

    const topStripBottom = this.drawTopStrip(width);
    const topRowY = 8;
    const topPanelsY = topStripBottom + 10;
    this.drawLeftHudArea(height);

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
    const scoutingPanelHeight = this.drawActiveScouting(state, translations, width, topPanelsY);
    this.drawQuestPanel(state, translations, width, topPanelsY + scoutingPanelHeight + 10);
    this.drawEventLog(state, translations, height);
    this.drawActionPanel(state, translations, width, height);
    this.drawToolbar(state, translations, width, height);
  }

  private drawLeftHudArea(height: number): void {
    const areaHeight = Math.max(0, height - HUD_TOP_STRIP_HEIGHT);

    if (areaHeight <= 0) {
      return;
    }

    const area = new Graphics();
    area
      .rect(0, HUD_TOP_STRIP_HEIGHT, HUD_LEFT_PANEL_WIDTH, areaHeight)
      .fill({ color: 0x151812, alpha: 1 })
      .stroke({ color: 0xb6c38f, alpha: 0.2, width: 1 });
    this.hudLayer.addChild(area);
  }

  private drawTopStrip(width: number): number {
    const strip = new Graphics();
    strip
      .rect(0, 0, width, HUD_TOP_STRIP_HEIGHT)
      .fill({ color: 0x151812, alpha: 1 })
      .stroke({ color: 0xb6c38f, alpha: 0.24, width: 1 });
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
      .roundRect(0, 0, 44, 44, 7)
      .fill({ color: 0x141611, alpha: 0.62 })
      .stroke({ color: 0xd9c88b, alpha: 0.36, width: 1.2 });
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
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: 11,
          fontWeight: "900",
        },
      })
      : null;
    const width = label ? Math.max(48, label.width + 32) : 28;
    const height = 22;
    const colors = this.getBrandAlertColors(alert.tone);
    const background = new Graphics();
    background.roundRect(0, 0, width, height, 8)
      .fill({ color: colors.fill, alpha: 0.82 })
      .stroke({ color: colors.stroke, alpha: 0.64, width: 1 });
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

    return group;
  }

  private getBrandAlertColors(tone: BrandAlert["tone"]): { fill: number; stroke: number } {
    if (tone === "cold") {
      return { fill: 0x12232d, stroke: 0x86c4df };
    }

    if (tone === "danger") {
      return { fill: 0x2c1715, stroke: 0xd26858 };
    }

    if (tone === "warning") {
      return { fill: 0x2a2412, stroke: 0xe0c46f };
    }

    return { fill: 0x141611, stroke: 0x9fc0ba };
  }

  private getBrandAlerts(state: GameState, translations?: TranslationPack): BrandAlert[] {
    const alerts: BrandAlert[] = [];
    const condition = state.environment.condition;
    const crisis = state.environment.activeCrisis;

    if (crisis?.kind === "shelter") {
      const remaining = this.formatScoutingRemaining(Math.max(0, crisis.deadlineAt - state.elapsedSeconds));
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
      const remaining = this.formatScoutingRemaining(Math.max(0, state.environment.endsAt - state.elapsedSeconds));
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
        tone: environmentAlertToneByCondition[condition],
      });
      alerts.push({
        iconId: "crisis-countdown",
        label: remaining,
        tooltip,
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
      const rateLabel = this.getHourlyRateLabel(rate);
      const tooltip = translations
        ? `${translations.resources[resource.id]}: ${translations.resourceDescriptions[resource.id]}`
        : resource.id;
      const pill = this.createPill(
        label,
        resource.id,
        tooltip,
        rateLabel,
        this.getRateColor(rate),
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

  private drawSurvivorOverviewPanel(
    state: GameState,
    translations: TranslationPack,
    width: number,
    height: number,
  ): void {
    const overlay = new Container();
    this.hudLayer.addChild(overlay);

    const backdrop = new Graphics();
    backdrop.rect(0, 0, width, height).fill({ color: 0x030405, alpha: 0 });
    overlay.addChild(backdrop);
    this.bindAction(backdrop, { action: "close-village-modal" });

    const panelWidth = 308;
    const panelHeight = 278;
    const panel = new Container();
    panel.x = (width - panelWidth) / 2;
    panel.y = Math.max(36, (height - panelHeight) / 2);
    panel.eventMode = "static";
    overlay.addChild(panel);

    const housing = getHousingStatus(state);
    const buildingWorkers = getAssignedBuildingWorkerCount(state);
    const constructionWorkers = getConstructionWorkerCount(state);
    const scoutingTroops = getScoutingTroopCount(state);
    const totalPopulation = getPopulation(state) + scoutingTroops;

    this.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);
    this.createIconButton(panel, "close", panelWidth - 54, 18, 34, 34, { action: "close-village-modal" }, translations.ui.close);
    this.drawIcon(panel, "people", 24, 34, 20);
    this.drawText(panel, translations.ui.survivors, 52, 20, {
      fill: 0xf3edda,
      fontSize: 22,
      fontWeight: "900",
    });
    const total = this.drawText(panel, `${totalPopulation}`, panelWidth - 72, 23, {
      fill: 0xf1df9a,
      fontSize: 18,
      fontWeight: "900",
    });
    total.anchor.set(1, 0);

    const rows: Array<{ iconId: string; value: string; label: string; tooltip: string; missing?: boolean }> = [
      { iconId: "people", value: `${state.survivors.workers}`, label: translations.ui.availableWorkers, tooltip: translations.ui.availableWorkers },
      { iconId: "build", value: `${buildingWorkers}`, label: translations.ui.buildingWorkers, tooltip: translations.ui.buildingWorkers },
      { iconId: "material", value: `${constructionWorkers}`, label: translations.ui.constructionCrew, tooltip: translations.ui.constructionCrew },
      { iconId: "scout", value: `${state.survivors.troops}`, label: translations.ui.availableTroops, tooltip: translations.ui.availableTroops },
      { iconId: "scout", value: `${scoutingTroops}`, label: translations.ui.scoutingTroops, tooltip: translations.ui.scoutingTroops },
      { iconId: "crisis-injured", value: `${state.health.injured}`, label: translations.roles.injured, tooltip: translations.roles.injured, missing: state.health.injured > 0 },
      {
        iconId: "crisis-shelter",
        value: `${housing.housed}/${housing.civilianCapacity + this.getTroopHousingCapacity(state)}`,
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
      this.drawWorkforceRow(panel, {
        ...row,
        x: 18,
        y: 70 + index * 23,
        width: panelWidth - 28,
      });
    });

  }

  private drawDecisionArchivePanel(
    state: GameState,
    translations: TranslationPack,
    width: number,
    height: number,
  ): void {
    const overlay = new Container();
    this.hudLayer.addChild(overlay);

    const backdrop = new Graphics();
    backdrop.rect(0, 0, width, height).fill({ color: 0x030405, alpha: 0 });
    overlay.addChild(backdrop);
    this.bindAction(backdrop, { action: "close-village-modal" });

    const panelWidth = Math.min(720, width - 48);
    const panelHeight = Math.max(420, Math.min(620, height - 72));
    const panel = new Container();
    panel.x = (width - panelWidth) / 2;
    panel.y = Math.max(36, (height - panelHeight) / 2);
    panel.eventMode = "static";
    overlay.addChild(panel);

    this.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);
    this.createIconButton(panel, "close", panelWidth - 54, 18, 34, 34, { action: "close-village-modal" }, translations.ui.close);
    this.drawIcon(panel, "archive", 28, 34, 22);
    this.drawText(panel, translations.ui.decisionArchive ?? "Decision archive", 58, 19, {
      fill: 0xf3edda,
      fontSize: 22,
      fontWeight: "900",
    });

    this.drawText(panel, translations.ui.leadershipProfile ?? "Leadership profile", 28, 72, {
      fill: 0xd8c890,
      fontSize: 13,
      fontWeight: "900",
    });
    this.drawIcon(panel, decisionProfileIconByKind[getDecisionProfileKind(state)], 40, 106, 24);
    this.drawText(panel, this.getDecisionProfileOverallLabel(state, translations), 62, 94, {
      fill: 0xf1df9a,
      fontSize: 20,
      fontWeight: "900",
    });

    decisionProfileAxes.forEach((axis, index) => {
      this.drawDecisionProfileAxis(
        panel,
        translations.ui[axis.leftLabelKey] ?? axis.leftLabelKey,
        translations.ui[axis.rightLabelKey] ?? axis.rightLabelKey,
        getDecisionProfileAxisValue(state, axis.id),
        28,
        138 + index * 48,
        panelWidth - 56,
      );
    });

    const historyY = 306;
    this.drawText(panel, translations.ui.decisionHistory ?? "Decision history", 28, historyY, {
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
    this.decisionHistoryScrollArea = {
      x: panel.x + 28,
      y: panel.y + viewportY,
      width: panelWidth - 56,
      height: viewportHeight,
    };

    if (
      this.selectedDecisionHistoryIndex !== null &&
      !state.quests.decisionHistory[this.selectedDecisionHistoryIndex]
    ) {
      this.selectedDecisionHistoryIndex = null;
    }

    const history = state.quests.decisionHistory
      .map((entry, originalIndex) => ({ entry, originalIndex }))
      .reverse();

    if (history.length === 0) {
      this.drawText(panel, translations.ui.noDecisionHistory ?? "No decisions recorded yet.", 28, historyY + 30, {
        fill: 0xbfc7be,
        fontSize: 14,
      });
      return;
    }

    const rowHeights = history.map((row) =>
      row.originalIndex === this.selectedDecisionHistoryIndex ? 156 : 42,
    );
    const contentHeight = rowHeights.reduce(
      (total, rowHeight) => total + rowHeight + 8,
      0,
    );
    this.decisionHistoryScrollMax = Math.max(0, contentHeight - viewportHeight);
    this.decisionHistoryScrollY = Math.max(
      0,
      Math.min(this.decisionHistoryScrollY, this.decisionHistoryScrollMax),
    );
    content.y = viewportY - this.decisionHistoryScrollY;

    let rowY = 0;

    history.forEach((row, index) => {
      const expanded = row.originalIndex === this.selectedDecisionHistoryIndex;
      const rowHeight = rowHeights[index];
      this.drawDecisionHistoryRow(
        content,
        row,
        translations,
        28,
        rowY,
        panelWidth - 56,
        rowHeight,
        expanded,
      );
      rowY += rowHeight + 8;
    });

    if (this.decisionHistoryScrollMax > 0) {
      const trackHeight = viewportHeight;
      const thumbHeight = Math.max(32, trackHeight * (viewportHeight / contentHeight));
      const thumbY = viewportY +
        (trackHeight - thumbHeight) *
          (this.decisionHistoryScrollY / this.decisionHistoryScrollMax);
      const track = new Graphics();
      track.roundRect(panelWidth - 18, viewportY, 5, trackHeight, 3)
        .fill({ color: 0x0b0d0a, alpha: 0.72 });
      track.roundRect(panelWidth - 18, thumbY, 5, thumbHeight, 3)
        .fill({ color: 0xe0c46f, alpha: 0.6 });
      panel.addChild(track);
    }
  }

  private drawDecisionHistoryRow(
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
    const option = this.getDecisionHistoryOption(entry);
    const optionLabel = definitionCopy?.options[entry.optionId] ?? entry.optionId;
    const result = definitionCopy?.results[entry.optionId] ?? "";
    const day = `${translations.ui.day ?? "Day"} ${getGameDay(entry.resolvedAt)}`;
    const time = formatGameClock(entry.resolvedAt);
    const rowLayer = new Container();
    rowLayer.x = x;
    rowLayer.y = y;
    parent.addChild(rowLayer);

    const background = new Graphics();
    background.roundRect(0, 0, width, height, 6)
      .fill({ color: expanded ? 0x1b1f18 : 0x171a14, alpha: 0.76 })
      .stroke({ color: 0xe0c46f, alpha: expanded ? 0.34 : 0.12, width: 1 });
    rowLayer.addChild(background);

    this.bindLocalAction(rowLayer, () => {
      this.selectedDecisionHistoryIndex = expanded ? null : row.originalIndex;
      this.requestRender();
    });
    rowLayer.hitArea = new Rectangle(0, 0, width, height);

    this.drawText(rowLayer, `${day} ${time}`, 14, 11, {
      fill: 0xaeb6ad,
      fontSize: 11,
      fontWeight: "900",
    });
    this.drawText(rowLayer, definitionCopy?.title ?? entry.definitionId, 104, 7, {
      fill: 0xf5efdf,
      fontSize: 13,
      fontWeight: "900",
    });
    this.drawText(rowLayer, optionLabel, 104, 23, {
      fill: 0xd7ddd8,
      fontSize: 12,
      fontWeight: "700",
    });

    if (option) {
      this.drawDecisionImpactChips(
        rowLayer,
        this.getDecisionImpactLines(option, translations).slice(0, expanded ? 8 : 4),
        width - 14,
        10,
      );
    }

    if (!expanded) {
      return;
    }

    this.drawText(rowLayer, definitionCopy?.body ?? "", 14, 52, {
      fill: 0xc9d0ca,
      fontSize: 12,
      fontWeight: "700",
      wordWrap: true,
      wordWrapWidth: width - 28,
    });
    this.drawText(rowLayer, result, 14, 106, {
      fill: 0xf1df9a,
      fontSize: 12,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: width - 28,
    });
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
      background.roundRect(0, 0, chipWidth, 22, 6)
        .fill({ color: impact.negative ? 0x291513 : 0x122117, alpha: 0.84 })
        .stroke({ color: impact.negative ? 0xd26858 : 0x9ed99b, alpha: 0.24, width: 1 });
      chip.addChildAt(background, 0);
      this.drawIcon(chip, impact.iconId, 13, 11, 13);
      chip.x = cursorX - chipWidth;
      chip.y = y;
      parent.addChild(chip);
      this.bindTooltip(chip, impact.tooltip);
      cursorX -= chipWidth + 5;
    }
  }

  private getDecisionImpactLines(
    option: DecisionQuestOptionDefinition,
    translations: TranslationPack,
  ): EffectLine[] {
    const impacts: EffectLine[] = [];

    for (const [resourceId, amount] of Object.entries(option.resources ?? {})) {
      const typedResourceId = resourceId as ResourceId;
      const value = amount ?? 0;

      if (value === 0) {
        continue;
      }

      impacts.push({
        iconId: typedResourceId,
        value: this.formatSignedInteger(value),
        tooltip: `${translations.resources[typedResourceId]} ${this.formatSignedInteger(value)}`,
        negative: value < 0,
      });
    }

    if (option.workers) {
      impacts.push({
        iconId: "people",
        value: this.formatSignedInteger(option.workers),
        tooltip: `${translations.ui.workers} ${this.formatSignedInteger(option.workers)}`,
        negative: option.workers < 0,
      });
    }

    if (option.injured) {
      impacts.push({
        iconId: "crisis-injured",
        value: this.formatSignedInteger(option.injured),
        tooltip: `${translations.roles.injured} ${this.formatSignedInteger(option.injured)}`,
        negative: option.injured > 0,
      });
    }

    if (option.morale) {
      impacts.push({
        iconId: "morale",
        value: this.formatSignedInteger(option.morale),
        tooltip: `${translations.resources.morale} ${this.formatSignedInteger(option.morale)}`,
        negative: option.morale < 0,
      });
    }

    return impacts;
  }

  private getDecisionHistoryOption(entry: DecisionHistoryEntry): DecisionQuestOptionDefinition | null {
    return decisionQuestById[entry.definitionId]?.options.find(
      (option) => option.id === entry.optionId,
    ) ?? null;
  }

  private formatSignedInteger(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
  }

  private drawDecisionProfileAxis(
    parent: Container,
    leftLabel: string,
    rightLabel: string,
    value: number,
    x: number,
    y: number,
    width: number,
  ): void {
    this.drawText(parent, leftLabel, x, y, {
      fill: value < -15 ? 0xf1df9a : 0xbfc7be,
      fontSize: 12,
      fontWeight: "900",
    });
    const right = this.drawText(parent, rightLabel, x + width, y, {
      fill: value > 15 ? 0xf1df9a : 0xbfc7be,
      fontSize: 12,
      fontWeight: "900",
      align: "right",
    });
    right.anchor.x = 1;

    const trackY = y + 22;
    const track = new Graphics();
    track.roundRect(x, trackY, width, 8, 4)
      .fill({ color: 0x0b0d0a, alpha: 0.78 })
      .stroke({ color: 0xe0c46f, alpha: 0.2, width: 1 });
    const centerX = x + width / 2;
    track.rect(centerX - 1, trackY - 4, 2, 16)
      .fill({ color: 0xd8c890, alpha: 0.42 });
    parent.addChild(track);

    const knobX = x + ((value + 100) / 200) * width;
    const knob = new Graphics();
    knob.circle(knobX, trackY + 4, 7)
      .fill({ color: 0xe0c46f, alpha: 0.95 })
      .stroke({ color: 0x3b331d, alpha: 0.8, width: 2 });
    parent.addChild(knob);
  }

  private getDecisionProfileOverallLabel(state: GameState, translations: TranslationPack): string {
    const key = decisionProfileLabelKeyByKind[getDecisionProfileKind(state)];
    return translations.ui[key] ?? key;
  }

  private drawActiveScouting(
    state: GameState,
    translations: TranslationPack | undefined,
    width: number,
    y: number,
  ): number {
    const panelWidth = HUD_LEFT_PANEL_WIDTH;
    const layer = new Container();
    layer.x = HUD_SIDE_PANEL_MARGIN;
    layer.y = y;
    this.hudLayer.addChild(layer);

    const missions = state.scouting.missions.slice(0, 4);
    const panelHeight = missions.length > 0 ? 52 + missions.length * 24 : 82;

    this.drawIcon(layer, "scout", 18, 22, 15);
    this.drawText(layer, translations?.ui.activeScouting ?? "Active scouting", 34, 14, {
      fill: 0xf3edda,
      fontSize: 12,
      fontWeight: "800",
    });
    this.drawText(layer, `${state.scouting.missions.length}`, panelWidth - 28, 14, {
      fill: 0xf1df9a,
      fontSize: 13,
      fontWeight: "900",
    }).anchor.set(1, 0);

    if (missions.length === 0) {
      this.drawText(layer, translations?.ui.noActiveScouting ?? "No active scouting missions.", 14, 48, {
        fill: 0xaeb4b8,
        fontSize: 11,
        fontWeight: "800",
      });
      this.registerHudInteractionArea(layer.x, layer.y, panelWidth, panelHeight, 6);
      return panelHeight;
    }

    missions.forEach((mission, index) => {
      const modeLabel = translations?.ui[mission.mode === "safe" ? "safeScouting" : "riskyScouting"] ?? mission.mode;
      const remaining = this.formatScoutingRemaining(mission.remainingSeconds);
      const rowY = 44 + index * 24;
      this.drawIcon(layer, "people", 18, rowY + 10, 13);
      this.drawText(layer, `${modeLabel}: ${mission.troops}`, 34, rowY + 2, {
        fill: 0xf5efdf,
        fontSize: 11,
        fontWeight: "900",
      });
      const timer = this.drawText(layer, `${translations?.ui.returnsIn ?? "returns in"} ${remaining}`, panelWidth - 14, rowY + 2, {
        fill: 0xd8c890,
        fontSize: 11,
        fontWeight: "800",
      });
      timer.anchor.set(1, 0);
    });

    this.registerHudInteractionArea(layer.x, layer.y, panelWidth, panelHeight, 6);
    return panelHeight;
  }

  private drawQuestPanel(
    state: GameState,
    translations: TranslationPack | undefined,
    width: number,
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
    this.hudLayer.addChild(layer);

    this.drawIcon(layer, "build", 18, 22, 15);
    this.drawText(layer, translations.quests.ui.activeObjectives, 34, 14, {
      fill: 0xf3edda,
      fontSize: 12,
      fontWeight: "800",
    });
    this.drawText(layer, `${activeObjectives.length}`, panelWidth - 28, 14, {
      fill: 0xf1df9a,
      fontSize: 13,
      fontWeight: "900",
    }).anchor.set(1, 0);

    if (activeObjectives.length === 0) {
      this.drawText(layer, translations.quests.ui.objectivesEmpty, 14, 48, {
        fill: 0xaeb4b8,
        fontSize: 11,
        fontWeight: "800",
      });
      this.registerHudInteractionArea(layer.x, layer.y, panelWidth, panelHeight, 6);
      return;
    }

    activeObjectives.forEach((quest, index) => {
      const definition = objectiveQuestById[quest.definitionId];
      const copy = translations.quests.objectives[quest.definitionId];
      const progress = getObjectiveQuestProgress(state, definition);
      const rowY = 42 + index * rowHeight;
      this.drawText(layer, copy?.title ?? quest.definitionId, 14, rowY, {
        fill: 0xf5efdf,
        fontSize: 12,
        fontWeight: "900",
      });
      const progressLabel = this.drawText(layer, `${progress.current}/${progress.required}`, panelWidth - 14, rowY, {
        fill: 0xf1df9a,
        fontSize: 12,
        fontWeight: "900",
      });
      progressLabel.anchor.set(1, 0);
      this.drawText(layer, copy?.description ?? "", 14, rowY + 18, {
        fill: 0xaeb4b8,
        fontSize: 10,
        fontWeight: "700",
        wordWrap: true,
        wordWrapWidth: panelWidth - 42,
      });
      this.drawRewardLine(layer, definition.reward, translations, 14, rowY + 48);
    });

    this.registerHudInteractionArea(layer.x, layer.y, panelWidth, panelHeight, 6);
  }

  private drawWorkforceRow(
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

    this.drawIcon(row, options.iconId, 8, 9, 14);
    this.drawText(row, options.label, 28, 1, {
      fill: 0xaeb4b8,
      fontSize: 11,
      fontWeight: "800",
    });
    const value = this.drawText(row, options.value, options.width, 1, {
      fill: options.missing ? 0xff6f7d : 0xf1df9a,
      fontSize: 13,
      fontWeight: "900",
    });
    value.anchor.set(1, 0);

    row.hitArea = new Rectangle(0, -2, options.width, 23);
    this.bindTooltip(row, options.tooltip);
  }

  private drawQueue(state: GameState, translations: TranslationPack | undefined, height: number): void {
    const queue = getActiveBuildingQueue(state);
    const layer = new Container();
    layer.x = HUD_SIDE_PANEL_MARGIN;
    layer.y = height - 104;
    this.hudLayer.addChild(layer);
    this.drawPanel(layer, 0, 0, 308, 78, 0.76, 0);
    this.drawIcon(layer, "build", 18, 22, 14);
    this.drawText(layer, translations?.ui.buildingQueue ?? "Building queue", 34, 14, { fill: 0xf5efdf, fontSize: 12, fontWeight: "800" });
    this.drawText(layer, `${queue.length}/${MAX_ACTIVE_BUILDINGS}`, 280, 14, { fill: 0xf1df9a, fontSize: 13, fontWeight: "800" }).anchor.set(1, 0);

    if (queue.length === 0) {
      this.drawText(layer, translations?.ui.queueEmpty ?? "No active construction.", 14, 44, { fill: 0xaeb4b8, fontSize: 12, fontWeight: "700" });
      this.registerHudInteractionArea(layer.x, layer.y, 308, 78, 6);
      return;
    }

    queue.slice(0, 2).forEach((buildingId, index) => {
      const building = state.buildings[buildingId];
      const label = translations?.buildings[buildingId].name ?? buildingById[buildingId].name;
      this.drawText(layer, `${label} / ${Math.ceil(building.upgradingRemaining)}s`, 14, 42 + index * 17, {
        fill: 0xd7ddd8,
        fontSize: 11,
        fontWeight: "700",
      });
    });

    this.registerHudInteractionArea(layer.x, layer.y, 308, 78, 6);
  }

  private drawEventLog(state: GameState, translations: TranslationPack | undefined, height: number): void {
    const layer = new Container();
    layer.x = HUD_SIDE_PANEL_MARGIN;
    layer.y = Math.max(258, height - 374);
    this.hudLayer.addChild(layer);

    const width = HUD_LEFT_PANEL_WIDTH;
    const panelHeight = Math.max(168, Math.min(326, height - layer.y - 48));
    const viewportY = 42;
    const viewportHeight = panelHeight - 54;
    this.drawIcon(layer, "clock", 18, 22, 14);
    this.drawText(layer, translations?.ui.log ?? "Log", 34, 14, {
      fill: 0xf5efdf,
      fontSize: 12,
      fontWeight: "800",
    });

    const entries = this.getFormattedLogEntries(state, translations);

    if (entries.length === 0) {
      this.drawText(layer, "-", 14, viewportY, {
        fill: 0xaeb4b8,
        fontSize: 11,
        fontWeight: "700",
      });
      this.registerHudInteractionArea(layer.x, layer.y, width, panelHeight, 6);
      return;
    }

    const contentHeight = entries.length * 38;
    this.logScrollMax = Math.max(0, contentHeight - viewportHeight);
    this.logScrollY = Math.max(0, Math.min(this.logScrollY, this.logScrollMax));
    this.logScrollArea = {
      x: layer.x + 10,
      y: layer.y + viewportY - 4,
      width: width - 20,
      height: viewportHeight + 8,
    };

    entries.forEach((entry, index) => {
      const rowY = viewportY + index * 38 - this.logScrollY;

      if (rowY < viewportY - 38 || rowY > viewportY + viewportHeight) {
        return;
      }

      this.drawText(layer, entry, 14, rowY, {
        fill: index === 0 ? 0xf1df9a : 0xc8cabb,
        fontSize: 11,
        fontWeight: index === 0 ? "800" : "700",
        wordWrap: true,
        wordWrapWidth: width - 42,
      });
    });

    if (this.logScrollMax > 0) {
      const trackHeight = viewportHeight;
      const thumbHeight = Math.max(28, trackHeight * viewportHeight / contentHeight);
      const thumbY = viewportY + (trackHeight - thumbHeight) * (this.logScrollY / this.logScrollMax);
      const track = new Graphics();
      track.roundRect(width - 18, viewportY, 5, trackHeight, 3)
        .fill({ color: 0x0b0d0a, alpha: 0.72 });
      track.roundRect(width - 18, thumbY, 5, thumbHeight, 3)
        .fill({ color: 0xe0c46f, alpha: 0.6 });
      layer.addChild(track);
    }

    this.registerHudInteractionArea(layer.x, layer.y, width, panelHeight, 6);
  }

  private drawToolbar(state: GameState, translations: TranslationPack | undefined, width: number, height: number): void {
    const group = new Container();
    group.x = width - 244;
    group.y = height - 72;
    this.hudLayer.addChild(group);
    this.drawPanel(group, 0, 0, 216, 48);

    this.createIconButton(group, state.paused ? "play" : "pause", 8, 8, 40, 32, { action: "pause" }, state.paused ? translations?.ui.resume : translations?.ui.pause);
    this.createHudButton(group, translations?.ui.speedNormal ?? "1x", 56, 8, 44, 32, { speed: 1 }, state.speed === 1);
    this.createHudButton(group, translations?.ui.speedFast ?? "24x", 108, 8, 52, 32, { speed: 24 }, state.speed === 24);
    this.createIconButton(group, "home", 168, 8, 40, 32, { action: "home" }, translations?.ui.home);
    this.registerHudInteractionArea(group.x, group.y, 216, 48, 6);
  }

  private drawActionPanel(
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
    this.hudLayer.addChild(group);

    this.drawPanel(group, 0, 0, panelWidth, panelHeight);

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

    this.createCircularActionButton(
      group,
      "continuous-shifts",
      panelWidth / 2 - 36,
      40,
      27,
      { action: "set-continuous-shifts", continuousShifts: !continuousShifts },
      tooltip,
      continuousShifts,
    );

    const archiveTooltip = `${translations?.ui.decisionArchive ?? "Decision archive"}\n${translations?.ui.decisionArchiveTooltip ?? "Review past decisions and leadership profile."}`;
    this.createCircularActionButton(
      group,
      "archive",
      panelWidth / 2 + 36,
      40,
      27,
      { action: "open-decision-archive" },
      archiveTooltip,
      false,
    );
    this.registerHudInteractionArea(group.x, group.y, panelWidth, panelHeight, 6);
  }

  private drawInfoPanel(
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
      this.drawSurvivorOverviewPanel(state, translations, width, height);
      return;
    }

    if (infoPanel === "decisionArchive") {
      this.drawDecisionArchivePanel(state, translations, width, height);
      return;
    }

    this.drawResourceBreakdownPanel(state, translations, width, height, infoPanel);
  }

  private drawResourceBreakdownPanel(
    state: GameState,
    translations: TranslationPack,
    width: number,
    height: number,
    resourceId: ResourceId,
  ): void {
    const overlay = new Container();
    this.hudLayer.addChild(overlay);

    const backdrop = new Graphics();
    backdrop.rect(0, 0, width, height).fill({ color: 0x030405, alpha: 0 });
    overlay.addChild(backdrop);
    this.bindAction(backdrop, { action: "close-village-modal" });

    const panelWidth = Math.min(620, width - 48);
    const panelHeight = Math.max(320, Math.min(520, height - 72));
    const panel = new Container();
    panel.x = (width - panelWidth) / 2;
    panel.y = Math.max(36, (height - panelHeight) / 2);
    panel.eventMode = "static";
    overlay.addChild(panel);
    this.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);
    this.createIconButton(panel, "close", panelWidth - 54, 18, 34, 34, { action: "close-village-modal" }, translations.ui.close);

    const breakdown = getResourceBreakdown(state, resourceId);
    const totalRate = breakdown.reduce((total, line) => total + line.ratePerSecond, 0);
    const stockLabel = resourceId === "morale"
      ? `${Math.floor(state.resources.morale)}%`
      : `${Math.floor(state.resources[resourceId])}/${Math.floor(state.capacities[resourceId])}`;

    this.drawIcon(panel, resourceId, 28, 31, 20);
    this.drawText(panel, translations.resources[resourceId], 52, 19, {
      fill: 0xf5efdf,
      fontSize: 22,
      fontWeight: "900",
    });
    this.drawText(panel, stockLabel, panelWidth - 92, 21, {
      fill: 0xf1df9a,
      fontSize: 18,
      fontWeight: "900",
    }).anchor.set(1, 0);
    this.drawText(panel, translations.ui.resourceBreakdown, 24, 68, {
      fill: 0xaeb4b8,
      fontSize: 12,
      fontWeight: "800",
    });

    this.drawBreakdownRow(
      panel,
      translations.ui.resourceNetChange,
      this.getHourlyRateLabel(totalRate),
      totalRate,
      panelWidth,
      100,
      true,
    );

    const activeTab = this.activeResourceBreakdownTab;
    const visibleBreakdown = breakdown.filter((line) =>
      activeTab === "production"
        ? line.ratePerSecond > 0
        : line.ratePerSecond < 0,
    );
    this.drawTabs(
      panel,
      [
        { id: "production", label: translations.ui.production },
        { id: "consumption", label: translations.ui.consumption },
      ],
      {
        activeId: activeTab,
        x: 24,
        y: 140,
        height: 34,
        minWidth: 116,
        maxWidth: panelWidth - 48,
        onSelect: (tab) => {
          this.activeResourceBreakdownTab = tab;
          this.resourceBreakdownScrollY = 0;
          this.requestRender();
        },
      },
    );

    const rowHeight = 34;
    const viewportY = 190;
    const viewportHeight = Math.max(88, panelHeight - viewportY - 24);

    if (
      this.resourceBreakdownScrollResourceId !== resourceId ||
      this.resourceBreakdownScrollTab !== activeTab
    ) {
      this.resourceBreakdownScrollResourceId = resourceId;
      this.resourceBreakdownScrollTab = activeTab;
      this.resourceBreakdownScrollY = 0;
    }

    if (visibleBreakdown.length === 0) {
      this.resourceBreakdownScrollY = 0;
      this.resourceBreakdownScrollMax = 0;
      this.drawText(panel, translations.ui.resourceNoActiveEffects, 24, viewportY, {
        fill: 0xc8cabb,
        fontSize: 13,
        fontWeight: "700",
      });
      return;
    }

    const contentHeight = visibleBreakdown.length * rowHeight;
    this.resourceBreakdownScrollMax = Math.max(0, contentHeight - viewportHeight);
    this.resourceBreakdownScrollY = Math.max(
      0,
      Math.min(this.resourceBreakdownScrollY, this.resourceBreakdownScrollMax),
    );
    this.resourceBreakdownScrollArea = {
      x: panel.x + 18,
      y: panel.y + viewportY - 8,
      width: panelWidth - 36,
      height: viewportHeight + 16,
    };

    const content = new Container();
    content.y = viewportY - this.resourceBreakdownScrollY;
    panel.addChild(content);

    const mask = new Graphics();
    mask.eventMode = "none";
    mask.rect(18, viewportY - 8, panelWidth - 36, viewportHeight + 16)
      .fill({ color: 0xffffff, alpha: 1 });
    panel.addChild(mask);
    content.mask = mask;

    visibleBreakdown.forEach((line, index) => {
      this.drawBreakdownRow(
        content,
        this.getResourceBreakdownLabel(line, translations),
        this.getHourlyRateLabel(line.ratePerSecond),
        line.ratePerSecond,
        panelWidth,
        7 + index * rowHeight,
      );
    });

    if (this.resourceBreakdownScrollMax > 0) {
      const trackHeight = viewportHeight;
      const thumbHeight = Math.max(30, trackHeight * viewportHeight / contentHeight);
      const thumbY = viewportY +
        (trackHeight - thumbHeight) *
          (this.resourceBreakdownScrollY / this.resourceBreakdownScrollMax);
      const scrollbar = new Graphics();
      scrollbar.roundRect(panelWidth - 20, viewportY, 5, trackHeight, 3)
        .fill({ color: 0x0b0d0a, alpha: 0.76 });
      scrollbar.roundRect(panelWidth - 20, thumbY, 5, thumbHeight, 3)
        .fill({ color: 0xe0c46f, alpha: 0.66 });
      panel.addChild(scrollbar);
    }
  }

  private drawBreakdownRow(
    parent: Container,
    label: string,
    value: string,
    ratePerSecond: number,
    width: number,
    y: number,
    highlighted = false,
  ): void {
    const row = new Graphics();
    row.roundRect(18, y - 7, width - 36, 28, 6)
      .fill({ color: highlighted ? 0x262719 : 0x0f120e, alpha: highlighted ? 0.72 : 0.38 })
      .stroke({ color: 0xe0c46f, alpha: highlighted ? 0.22 : 0.1, width: 1 });
    parent.addChild(row);

    this.drawText(parent, label, 32, y, {
      fill: highlighted ? 0xf5efdf : 0xd8d2bd,
      fontSize: 12,
      fontWeight: highlighted ? "900" : "800",
    });
    const valueText = this.drawText(parent, value, width - 32, y, {
      fill: this.getRateColor(ratePerSecond),
      fontSize: 12,
      fontWeight: "900",
    });
    valueText.anchor.set(1, 0);
  }

  private getResourceBreakdownLabel(
    line: ResourceBreakdownLine,
    translations: TranslationPack,
  ): string {
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

    return translations.ui.moraleWaterShortage;
  }

  private redrawEnvironmentOverlay(
    graphic: Graphics,
    condition: EnvironmentConditionId,
    intensityRaw: number,
    width: number,
    height: number,
    visualTime: number,
  ): void {
    graphic.clear();

    if (condition === "stable") {
      return;
    }

    const intensity = Math.max(1, Math.min(3, intensityRaw));
    const hazeColor = condition === "radiation"
      ? 0x98cf6a
      : condition === "snowFront"
        ? 0xd9e6f2
        : 0x4d7694;
    const hazeAlpha = condition === "radiation"
      ? 0.07 + intensity * 0.03
      : condition === "snowFront"
        ? 0.06 + intensity * 0.022
        : 0.055 + intensity * 0.018;

    graphic.rect(0, 0, width, height).fill({ color: hazeColor, alpha: hazeAlpha });

    if (condition === "rain") {
      const laneSpacingA = Math.max(17, 30 - intensity * 2);
      const laneSpacingB = Math.max(23, 40 - intensity * 2);
      const laneHeightA = laneSpacingA * 1.52;
      const laneHeightB = laneSpacingB * 1.66;
      const cycleA = height + laneHeightA * 2;
      const cycleB = height + laneHeightB * 2;
      const fallA = visualTime * (240 + intensity * 34);
      const fallB = visualTime * (186 + intensity * 28);
      const dropLenA = 8 + intensity * 2.2;
      const dropLenB = 6 + intensity * 1.8;

      for (let x = -laneSpacingA; x < width + laneSpacingA; x += laneSpacingA) {
        const columnShift = ((Math.sin(x * 0.051) + 1) * 0.5) * laneSpacingA * 0.8;
        for (let y = -laneHeightA * 2; y < height + laneHeightA; y += laneHeightA) {
          const phase = ((x * 0.37 + y * 0.23) % laneHeightA + laneHeightA) % laneHeightA;
          const dropY = ((y + fallA + phase) % cycleA) - laneHeightA;
          const wind = Math.sin(x * 0.019 + dropY * 0.013 + visualTime * 1.05) * (1 + intensity * 0.24);
          const dropX = x + columnShift + wind;
          graphic.moveTo(dropX, dropY - dropLenA * 0.45);
          graphic.lineTo(dropX + wind * 0.12, dropY + dropLenA);
        }
      }
      graphic.stroke({ color: 0xbdddef, alpha: 0.2 + intensity * 0.04, width: 1.08 });

      for (let x = -laneSpacingB; x < width + laneSpacingB; x += laneSpacingB) {
        const columnShift = ((Math.cos(x * 0.043) + 1) * 0.5) * laneSpacingB * 0.72;
        for (let y = -laneHeightB * 2; y < height + laneHeightB; y += laneHeightB) {
          const phase = ((x * 0.29 + y * 0.19) % laneHeightB + laneHeightB) % laneHeightB;
          const dropY = ((y + fallB + phase) % cycleB) - laneHeightB;
          const wind = Math.sin(x * 0.017 + dropY * 0.011 + visualTime * 0.92) * (0.7 + intensity * 0.16);
          const dropX = x + columnShift + wind;
          graphic.moveTo(dropX, dropY - dropLenB * 0.35);
          graphic.lineTo(dropX + wind * 0.1, dropY + dropLenB);

          if (dropY > height * 0.82 && Math.sin(dropX * 0.14 + visualTime * 7.2) > 0.7) {
            graphic.circle(dropX + wind * 0.2, dropY + dropLenB + 1.5, 0.8 + intensity * 0.12)
              .fill({ color: 0xd8ecf7, alpha: 0.08 + intensity * 0.02 });
          }
        }
      }
      graphic.stroke({ color: 0xd8eef8, alpha: 0.12 + intensity * 0.03, width: 0.76 });
    }

    if (condition === "snowFront") {
      const area = width * height;
      const layerACount = Math.max(120, Math.round((area / 9000) * (0.9 + intensity * 0.18)));
      const layerBCount = Math.max(90, Math.round((area / 14000) * (0.9 + intensity * 0.15)));
      const travel = height + 88;
      const windDrift = visualTime * (7 + intensity * 1.2);
      const fallA = visualTime * (30 + intensity * 5.5);
      const fallB = visualTime * (22 + intensity * 4.2);

      for (let index = 0; index < layerACount; index += 1) {
        const seedX = this.seededUnit(index + 11);
        const seedY = this.seededUnit(index + 137);
        const seedPhase = this.seededUnit(index + 307);
        const x = ((seedX * width) + windDrift * (0.7 + seedY * 0.8)) % (width + 32) - 16;
        const y = ((seedY * travel) + fallA * (0.9 + seedX * 0.6)) % travel - 44;
        const flutter = Math.sin(visualTime * (1.3 + seedPhase * 0.8) + seedX * 8) * (1 + intensity * 0.18);
        const radius = 1.25 + seedPhase * 0.9 + intensity * 0.16;
        graphic.circle(x + flutter, y, radius).fill({
          color: 0xffffff,
          alpha: 0.16 + intensity * 0.04,
        });
      }

      for (let index = 0; index < layerBCount; index += 1) {
        const seedX = this.seededUnit(index + 503);
        const seedY = this.seededUnit(index + 911);
        const seedPhase = this.seededUnit(index + 1237);
        const x = ((seedX * width) + windDrift * 1.25 * (0.7 + seedY * 0.6)) % (width + 24) - 12;
        const y = ((seedY * travel) + fallB * (0.85 + seedX * 0.55)) % travel - 40;
        const flutter = Math.sin(visualTime * (1.9 + seedPhase * 0.7) + seedY * 10) * (0.8 + intensity * 0.12);
        const radius = 0.9 + seedPhase * 0.55 + intensity * 0.1;
        graphic.circle(x + flutter, y, radius).fill({
          color: 0xeef6ff,
          alpha: 0.1 + intensity * 0.028,
        });
      }
    }

    if (condition === "radiation") {
      const bandSpacing = Math.max(20, 34 - intensity * 3);
      const scanOffset = (visualTime * (24 + intensity * 5)) % bandSpacing;
      for (let y = scanOffset; y < height + bandSpacing; y += bandSpacing) {
        const bend = Math.sin(y * 0.013 + visualTime * 0.6) * (3.6 + intensity);
        graphic.moveTo(-6, y);
        graphic.lineTo(width + 6, y + bend);
      }
      graphic.stroke({ color: 0xc9f187, alpha: 0.09 + intensity * 0.035, width: 1 });

      const moteSpacing = Math.max(32, 56 - intensity * 6);
      for (let x = -moteSpacing; x < width + moteSpacing; x += moteSpacing) {
        for (let y = -moteSpacing; y < height + moteSpacing; y += moteSpacing) {
          const jitterX = Math.sin((x + y) * 0.01 + visualTime * 1.7) * 6;
          const jitterY = Math.cos((x - y) * 0.012 + visualTime * 1.25) * 5;
          graphic.circle(x + jitterX, y + jitterY, 1 + intensity * 0.2).fill({
            color: 0xd8f8a6,
            alpha: 0.06 + intensity * 0.025,
          });
        }
      }
    }
  }

  private redrawDaylightOverlay(
    graphic: Graphics,
    elapsedSeconds: number,
    width: number,
    height: number,
  ): void {
    graphic.clear();

    const daylight = getDaylightState(elapsedSeconds);

    if (daylight.darkness <= 0) {
      return;
    }

    const tint = daylight.phase === "dusk"
      ? 0x231621
      : daylight.phase === "dawn"
        ? 0x152233
        : 0x071322;
    const skyAlpha = Math.min(0.72, daylight.darkness * 1.05);
    const screenX = -1;
    const screenY = -1;
    const screenWidth = Math.ceil(width) + 2;
    const screenHeight = Math.ceil(height) + 2;

    graphic.rect(screenX, screenY, screenWidth, screenHeight)
      .fill({ color: tint, alpha: skyAlpha });

    const horizonAlpha = Math.min(0.14, daylight.darkness * 0.32);
    const horizonColor = daylight.phase === "dusk" ? 0x7b452d : 0x37576f;
    const horizonStart = Math.floor(height * 0.48);
    const horizonEnd = Math.ceil(height + 1);
    const horizonBands = 18;
    const horizonBandHeight = Math.max(2, Math.ceil((horizonEnd - horizonStart) / horizonBands));

    for (let bandIndex = 0; bandIndex < horizonBands; bandIndex += 1) {
      const progress = (bandIndex + 1) / horizonBands;
      const eased = progress * progress;
      const y = horizonStart + bandIndex * horizonBandHeight;
      const bandAlpha = horizonAlpha * eased;
      graphic.rect(screenX, y, screenWidth, horizonBandHeight + 1)
        .fill({ color: horizonColor, alpha: bandAlpha });
    }

    if (daylight.phase === "night") {
      graphic.rect(screenX, screenY, screenWidth, Math.max(2, Math.ceil(height * 0.36) + 1))
        .fill({ color: 0x040b14, alpha: Math.min(0.18, daylight.darkness * 0.24) });
    }
  }

  private syncAmbientOverlayState(state: GameState): void {
    this.ambientCondition = state.environment.condition;
    this.ambientIntensity = state.environment.intensity;
    this.ambientElapsedSeconds = state.elapsedSeconds;
    this.ambientSpeed = state.speed;
    this.ambientPaused = state.paused;
    this.ambientSyncAtMs = performance.now();
  }

  private refreshAmbientOverlays(nowMs: number, force = false): void {
    const width = this.app?.screen.width ?? this.host.clientWidth;
    const height = this.app?.screen.height ?? this.host.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    const visualTime = nowMs / 1000;
    const elapsedSeconds = this.getAmbientElapsedSeconds(nowMs);
    this.refreshEnvironmentOverlay(width, height, visualTime, nowMs, force);
    this.refreshDaylightOverlay(width, height, elapsedSeconds, nowMs, force);
  }

  private refreshEnvironmentOverlay(
    width: number,
    height: number,
    visualTime: number,
    nowMs: number,
    force: boolean,
  ): void {
    const overlayKey = `${this.ambientCondition}|${this.ambientIntensity}|${Math.round(width)}|${Math.round(height)}`;
    const needsKeyRefresh = overlayKey !== this.lastEnvironmentOverlayKey;
    const isAnimatedWeather = this.ambientCondition !== "stable";

    if (
      !force &&
      !needsKeyRefresh &&
      isAnimatedWeather &&
      this.lastEnvironmentOverlayFrameAtMs > 0 &&
      nowMs - this.lastEnvironmentOverlayFrameAtMs < WEATHER_OVERLAY_FRAME_MIN_MS
    ) {
      return;
    }

    this.redrawEnvironmentOverlay(
      this.environmentOverlayGraphic,
      this.ambientCondition,
      this.ambientIntensity,
      width,
      height,
      visualTime,
    );
    this.lastEnvironmentOverlayKey = overlayKey;
    this.lastEnvironmentOverlayFrameAtMs = nowMs;
  }

  private refreshDaylightOverlay(
    width: number,
    height: number,
    elapsedSeconds: number,
    nowMs: number,
    force: boolean,
  ): void {
    const daylight = getDaylightState(elapsedSeconds);
    const isDaylightTransition = daylight.phase === "dusk" || daylight.phase === "dawn";
    const darknessBucket = Math.round(daylight.darkness / DAYLIGHT_DARKNESS_BUCKET_STEP);
    const key = `${daylight.phase}|${darknessBucket}|${Math.round(width)}|${Math.round(height)}`;
    const needsKeyRefresh = key !== this.lastDaylightOverlayKey;

    if (!force && !needsKeyRefresh) {
      if (!isDaylightTransition) {
        return;
      }

      if (
        this.lastDaylightOverlayFrameAtMs > 0 &&
        nowMs - this.lastDaylightOverlayFrameAtMs < DAYLIGHT_TRANSITION_FRAME_MIN_MS
      ) {
        return;
      }
    }

    this.redrawDaylightOverlay(this.daylightOverlayGraphic, elapsedSeconds, width, height);
    this.lastDaylightOverlayKey = key;
    this.lastDaylightOverlayFrameAtMs = nowMs;
  }

  private getAmbientElapsedSeconds(nowMs: number): number {
    if (this.ambientPaused) {
      return this.ambientElapsedSeconds;
    }

    return this.ambientElapsedSeconds + ((nowMs - this.ambientSyncAtMs) / 1000) * this.ambientSpeed;
  }

  private shouldAnimateAmbientOverlays(): boolean {
    const isEnvironmentAnimated = this.ambientCondition !== "stable";
    const daylightPhase = getDaylightState(this.ambientElapsedSeconds).phase;
    const isDaylightAnimated = daylightPhase === "dusk" || daylightPhase === "dawn";
    return isEnvironmentAnimated || isDaylightAnimated;
  }

  private shouldAnimateVisuals(): boolean {
    return this.shouldAnimateAmbientOverlays() || this.textureAnimationBindings.size > 0 || this.shouldAnimateCamera();
  }

  private updateAmbientAnimationLoop(): void {
    if (this.shouldAnimateVisuals()) {
      this.startAmbientAnimation();
      return;
    }

    this.stopAmbientAnimation();
  }

  private startAmbientAnimation(): void {
    if (this.ambientAnimationFrameId !== null) {
      return;
    }

    this.ambientAnimationFrameId = window.requestAnimationFrame(this.handleAmbientAnimationFrame);
  }

  private stopAmbientAnimation(): void {
    if (this.ambientAnimationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.ambientAnimationFrameId);
    this.ambientAnimationFrameId = null;
  }

  private animateAmbientOverlays(timestamp: number): void {
    this.ambientAnimationFrameId = null;

    if (!this.app) {
      return;
    }

    if (
      this.lastVisualFrameAtMs > 0 &&
      timestamp - this.lastVisualFrameAtMs < VISUAL_FRAME_MIN_MS
    ) {
      if (this.shouldAnimateVisuals()) {
        this.ambientAnimationFrameId = window.requestAnimationFrame(this.handleAmbientAnimationFrame);
      }
      return;
    }
    this.lastVisualFrameAtMs = timestamp;

    if (this.shouldAnimateAmbientOverlays()) {
      this.refreshAmbientOverlays(timestamp);
    }

    this.refreshTextureAnimations(timestamp);
    this.refreshCameraTransform();
    this.app.render();

    if (this.shouldAnimateVisuals()) {
      this.ambientAnimationFrameId = window.requestAnimationFrame(this.handleAmbientAnimationFrame);
    }
  }

  private drawQuestDecisionModal(
    state: GameState,
    translations: TranslationPack | undefined,
    width: number,
    height: number,
    resolvedDecisionPreview: DecisionHistoryEntry | null,
  ): void {
    const activeDecision = state.quests.activeDecision;

    if (!translations || (!activeDecision && !resolvedDecisionPreview)) {
      return;
    }

    const overlay = new Container();
    this.hudLayer.addChild(overlay);

    const backdrop = new Graphics();
    backdrop.rect(0, 0, width, height).fill({ color: 0x030405, alpha: 0 });
    if (activeDecision) {
      backdrop.eventMode = "static";
      backdrop.on("pointerdown", (event) => {
        event.stopPropagation();
      });
    } else {
      this.bindAction(backdrop, { action: "close-decision-result" });
    }
    overlay.addChild(backdrop);

    const panelWidth = Math.min(560, width - 48);
    const panelHeight = 348;
    const panel = new Container();
    panel.x = (width - panelWidth) / 2;
    panel.y = Math.max(34, (height - panelHeight) / 2);
    panel.eventMode = "static";
    overlay.addChild(panel);
    this.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1, 0);

    if (activeDecision) {
      const definition = decisionQuestById[activeDecision.definitionId];
      const copy = translations.quests.decisions[definition.id];
      this.drawIcon(panel, "people", 30, 38, 24);
      this.drawText(panel, translations.quests.ui.decisionRequired, 62, 18, {
        fill: 0xd8c890,
        fontSize: 12,
        fontWeight: "900",
      });
      this.drawText(panel, copy?.title ?? definition.id, 62, 38, {
        fill: 0xf5efdf,
        fontSize: 24,
        fontWeight: "900",
      });
      this.drawText(panel, copy?.body ?? "", 28, 86, {
        fill: 0xd7ddd8,
        fontSize: 14,
        fontWeight: "700",
        wordWrap: true,
        wordWrapWidth: panelWidth - 56,
      });
      this.drawText(panel, translations.quests.ui.hiddenConsequences, 28, 170, {
        fill: 0xffc66d,
        fontSize: 12,
        fontWeight: "900",
        wordWrap: true,
        wordWrapWidth: panelWidth - 56,
      });

      const buttonWidth = panelWidth - 56;
      definition.options.forEach((option, index) => {
        const affordable = canAffordDecisionOption(state, option);
        this.createModalButton(
          panel,
          copy?.options[option.id] ?? option.id,
          28,
          212 + index * 42,
          buttonWidth,
          34,
          {
            action: "resolve-quest-decision",
            questOption: option.id,
          },
          !affordable,
          affordable ? undefined : translations.quests.ui.notEnoughSupplies,
        );
      });
      return;
    }

    const resultEntry = resolvedDecisionPreview;

    if (!resultEntry) {
      return;
    }

    const resultDefinition = decisionQuestById[resultEntry.definitionId];
    const resultCopy = translations.quests.decisions[resultDefinition.id];
    const resultOption = this.getDecisionHistoryOption(resultEntry);
    const selectedOptionLabel = resultCopy?.options[resultEntry.optionId] ?? resultEntry.optionId;
    const resolvedDay = `${translations.ui.day ?? "Day"} ${getGameDay(resultEntry.resolvedAt)} ${formatGameClock(resultEntry.resolvedAt)}`;
    this.createIconButton(
      panel,
      "close",
      panelWidth - 58,
      18,
      38,
      38,
      { action: "close-decision-result" },
      translations.ui.close,
    );
    this.drawIcon(panel, "archive", 30, 38, 24);
    this.drawText(panel, translations.ui.decisionArchive ?? "Decision archive", 62, 18, {
      fill: 0xd8c890,
      fontSize: 12,
      fontWeight: "900",
    });
    this.drawText(panel, resultCopy?.title ?? resultDefinition.id, 62, 38, {
      fill: 0xf5efdf,
      fontSize: 24,
      fontWeight: "900",
    });
    this.drawText(panel, resolvedDay, 28, 76, {
      fill: 0xaeb6ad,
      fontSize: 11,
      fontWeight: "900",
    });
    this.drawText(panel, `${translations.quests.ui.decision ?? "Decision"}: ${selectedOptionLabel}`, 28, 94, {
      fill: 0xd7ddd8,
      fontSize: 13,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: panelWidth - 56,
    });
    this.drawText(panel, resultCopy?.results[resultEntry.optionId] ?? "", 28, 124, {
      fill: 0xf1df9a,
      fontSize: 13,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: panelWidth - 56,
    });

    if (resultOption) {
      this.drawDecisionImpactChips(
        panel,
        this.getDecisionImpactLines(resultOption, translations).slice(0, 8),
        panelWidth - 28,
        286,
      );
    }
  }

  private drawVillageModal(
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

    if (!selectedPlot) {
      return;
    }

    const overlay = new Container();
    this.hudLayer.addChild(overlay);

    const backdrop = new Graphics();
    backdrop.rect(0, 0, width, height).fill({ color: 0x030405, alpha: 0 });
    overlay.addChild(backdrop);
    this.bindAction(backdrop, { action: "close-village-modal" });

    const isBuildChoice = selectedPlot.buildingId === null;
    const detailBuildingId = selectedPlot.buildingId;
    const modalWidth = isBuildChoice ? Math.min(900, width - 56) : Math.min(860, width - 40);
    const modalHeight = isBuildChoice
      ? Math.min(690, height - 56)
      : Math.min(detailBuildingId === "barracks" ? 590 : 510, height - 40);
    const panel = new Container();
    panel.x = (width - modalWidth) / 2;
    panel.y = (height - modalHeight) / 2;
    panel.eventMode = "static";
    overlay.addChild(panel);
    this.drawPanel(panel, 0, 0, modalWidth, modalHeight, 1, 0);

    if (selectedPlot.buildingId === null) {
      const title = translations.ui.availableBuilds;
      const subtitle = `${selectedPlot.id} / ${translations.ui.emptyPlot}`;
      this.drawModalHeader(panel, title, subtitle, modalWidth, translations);
      this.drawBuildChoices(
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

    this.drawModalClose(panel, modalWidth, translations);
    const buildingId = selectedPlot.buildingId;
    const building = state.buildings[buildingId];
    const definition = buildingById[buildingId];
    this.drawBuildingDetail(panel, buildingId, building.level, building.upgradingRemaining, definition.maxLevel, state, translations, modalWidth, modalHeight);
  }

  private drawModalHeader(
    parent: Container,
    title: string,
    subtitle: string,
    modalWidth: number,
    translations: TranslationPack,
  ): void {
    const badge = new Container();
    badge.x = 22;
    badge.y = 18;
    parent.addChild(badge);

    const badgeBox = new Graphics();
    badgeBox.rect(0, 0, 42, 42)
      .fill({ color: 0x11140f, alpha: 0.9 })
      .stroke({ color: 0xe0c46f, alpha: 0.2, width: 1 });
    badge.addChild(badgeBox);
    this.drawIcon(badge, "build", 21, 21, 22);

    this.drawText(parent, title, 72, 20, { fill: 0xf5efdf, fontSize: 21, fontWeight: "900" });
    this.drawText(parent, subtitle, 72, 48, { fill: 0xaeb4b8, fontSize: 12, fontWeight: "800" });
    this.drawModalClose(parent, modalWidth, translations);
  }

  private drawModalClose(parent: Container, modalWidth: number, translations: TranslationPack): void {
    this.createIconButton(parent, "close", modalWidth - 58, 18, 38, 38, { action: "close-village-modal" }, translations.ui.close);
  }

  private drawBuildChoices(
    parent: Container,
    plotId: string,
    buildableBuildings: BuildingId[],
    state: GameState,
    translations: TranslationPack,
    modalWidth: number,
    modalHeight: number,
  ): void {
    if (buildableBuildings.length === 0) {
      this.drawText(parent, translations.ui.alreadyBuilt, 24, 96, { fill: 0xaeb4b8, fontSize: 13 });
      return;
    }

    if (this.buildChoicesScrollPlotId !== plotId) {
      this.buildChoicesScrollPlotId = plotId;
      this.buildChoicesScrollY = 0;
    }

    const availableCategories = buildCategoryOrder.filter((category) =>
      buildableBuildings.some((buildingId) => buildingById[buildingId].category === category),
    );
    const activeCategory = (availableCategories.includes(this.activeBuildCategory)
      ? this.activeBuildCategory
      : availableCategories[0]) ?? "resource";
    this.activeBuildCategory = activeCategory;

    const filteredBuildings = buildableBuildings.filter(
      (buildingId) => buildingById[buildingId].category === activeCategory,
    );
    const gap = 8;
    const listX = 24;
    const tabY = 88;
    const listY = tabY + 48;
    const availableHeight = modalHeight - listY - 24;
    const rowHeight = modalHeight < 620 ? 96 : 104;
    const contentHeight = filteredBuildings.length * rowHeight + gap * Math.max(0, filteredBuildings.length - 1);
    const maxScroll = Math.max(0, contentHeight - availableHeight);
    const needsScroll = maxScroll > 1;
    const scrollbarGutter = needsScroll ? 22 : 0;
    const rowWidth = modalWidth - 48 - scrollbarGutter;
    const scrollY = Math.max(0, Math.min(maxScroll, this.buildChoicesScrollY));

    this.drawBuildCategoryTabs(
      parent,
      availableCategories,
      activeCategory,
      translations,
      listX,
      tabY,
      modalWidth - 48,
    );

    this.buildChoicesScrollY = scrollY;
    this.buildChoicesScrollMax = maxScroll;
    this.buildChoicesScrollArea = {
      x: parent.x + listX,
      y: parent.y + listY,
      width: rowWidth + scrollbarGutter,
      height: availableHeight,
    };

    const listContent = new Container();
    listContent.x = listX;
    listContent.y = listY - scrollY;
    parent.addChild(listContent);

    const listMask = new Graphics();
    listMask.eventMode = "none";
    listMask.rect(listX, listY, rowWidth, availableHeight).fill({ color: 0xffffff, alpha: 1 });
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
        ? this.getBuildActionDisabledTooltip(
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

      this.drawBuildRow(listContent, {
        x: 0,
        y: index * (rowHeight + gap),
        width: rowWidth,
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
        effects: this.getNextLevelEffects(buildingId, 0, translations),
      });
    });

    if (needsScroll) {
      this.drawBuildChoicesScrollbar(
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

  private drawBuildCategoryTabs(
    parent: Container,
    categories: BuildingCategory[],
    activeCategory: BuildingCategory,
    translations: TranslationPack,
    x: number,
    y: number,
    maxWidth: number,
  ): void {
    this.drawTabs(
      parent,
      categories.map((category) => ({
        id: category,
        label: this.getBuildCategoryLabel(category, translations),
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
          this.activeBuildCategory = category;
          this.buildChoicesScrollY = 0;
          this.requestRender();
        },
      },
    );
  }

  private getBuildCategoryLabel(
    category: BuildingCategory,
    translations: TranslationPack,
  ): string {
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

  private drawBuildChoicesScrollbar(
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
    track.roundRect(x, y, width, height, width / 2)
      .fill({ color: 0x070807, alpha: 0.52 })
      .stroke({ color: 0xe0c46f, alpha: 0.2, width: 1 });
    parent.addChild(track);

    const thumbHeight = Math.max(46, (height / contentHeight) * height);
    const thumbTravel = Math.max(0, height - thumbHeight - 4);
    const thumbY = y + 2 + (maxScroll > 0 ? (scrollY / maxScroll) * thumbTravel : 0);
    const thumb = new Graphics();
    thumb.roundRect(x + 2, thumbY, width - 4, thumbHeight, (width - 4) / 2)
      .fill({ color: 0xe0c46f, alpha: 0.86 });
    parent.addChild(thumb);
  }

  private drawBuildRow(
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
    this.drawPanel(row, 0, 0, options.width, options.height);

    const asset = this.createBuildingSprite(options.buildingId, options.level, options.built);
    asset.anchor.set(0.5);
    asset.x = 72;
    asset.y = options.height / 2;
    this.fitSprite(
      asset,
      Math.min(104 * BUILDING_PREVIEW_RENDER_SCALE, options.height * 1.42),
      Math.min(78 * BUILDING_PREVIEW_RENDER_SCALE, options.height * 0.96),
    );
    row.addChild(asset);

    const textX = 150;
    const buttonWidth = 124;
    const buttonHeight = 34;
    const buttonX = options.width - buttonWidth - 28;
    const textWidth = Math.max(220, buttonX - textX - 24);
    const compact = options.height < 66;
    const sectionLabelY = options.height - 46;
    const tokenY = options.height - 26;
    const costSectionWidth = Math.max(150, Math.min(220, Math.floor(textWidth * 0.46)));
    const effectsX = textX + costSectionWidth + 22;
    const effectsWidth = Math.max(110, buttonX - effectsX - 18);

    this.drawText(row, options.title, textX, compact ? 8 : 11, {
      fill: 0xf5efdf,
      fontSize: compact ? 14 : 16,
      fontWeight: "900",
    });
    this.drawText(row, options.description, textX, compact ? 30 : 36, {
      fill: 0xc8cabb,
      fontSize: compact ? 10 : 12,
      fontWeight: "600",
      wordWrap: true,
      wordWrapWidth: textWidth,
    });

    this.drawText(row, options.translations.ui.buildCosts ?? "Costs", textX, sectionLabelY, {
      fill: 0xaeb4b8,
      fontSize: 10,
      fontWeight: "800",
    });
    this.drawText(row, options.translations.ui.buildBenefits ?? "Benefits", effectsX, sectionLabelY, {
      fill: 0xaeb4b8,
      fontSize: 10,
      fontWeight: "800",
    });

    const costWidth = this.drawCostLine(row, options.cost, options.state.resources, options.translations, textX, tokenY);
    this.drawEffects(row, options.effects, effectsX, tokenY, effectsWidth);

    if (options.requiredWorkers > 0) {
      this.drawWorkerRequirement(
        row,
        options.requiredWorkers,
        options.state.survivors.workers,
        options.translations,
        Math.max(textX, Math.min(textX + costWidth + 8, textX + costSectionWidth - 54)),
        tokenY,
      );
    }
    this.createModalButton(
      row,
      options.buttonLabel,
      buttonX,
      (options.height - buttonHeight) / 2,
      buttonWidth,
      buttonHeight,
      options.action,
      options.disabled,
      options.disabledTooltip,
    );
  }

  private drawBuildingDetail(
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
    const mainBuildingUnlocked = locked ||
      isMainBuildingRequirementMet(state, buildingId, level + 1);
    const disabled = locked || upgrading || !mainBuildingUnlocked || !affordable || !queueAvailable || !workersAvailable;

    const content = new Container();
    parent.addChild(content);

    const sideMargin = 28;
    const contentTop = 34;
    const previewWidth = 136;
    const titleX = sideMargin + previewWidth + 22;
    const titleWidth = modalWidth - titleX - sideMargin;
    const bodyWidth = modalWidth - sideMargin * 2;

    const asset = this.createBuildingSprite(buildingId, Math.max(1, level), level > 0);
    asset.anchor.set(0.5);
    asset.x = sideMargin + 54;
    asset.y = contentTop + 50;
    this.fitSprite(
      asset,
      96 * BUILDING_PREVIEW_RENDER_SCALE,
      72 * BUILDING_PREVIEW_RENDER_SCALE,
    );
    content.addChild(asset);

    this.drawText(content, translated.name, titleX, contentTop + 6, { fill: 0xf5efdf, fontSize: 30, fontWeight: "900" });
    this.drawText(content, translated.description, titleX, contentTop + 48, {
      fill: 0xc8cabb,
      fontSize: 13,
      fontWeight: "700",
      wordWrap: true,
      wordWrapWidth: titleWidth,
    });

    const metricGap = 10;
    const metricWidth = (titleWidth - metricGap * 3) / 4;
    const metricY = contentTop + 86;
    this.getBuildingDetailMetrics(buildingId, building, level, maxLevel, requiredWorkers, state, translations)
      .forEach((metric, index) => {
        this.drawMetricCard(
          content,
          metric,
          titleX + index * (metricWidth + metricGap),
          metricY,
          metricWidth,
          58,
        );
      });

    const operationsY = contentTop + 166;
    if (buildingId === "generator" || buildingId === "workshop") {
      this.drawStaffedProductionControls(content, buildingId, state, translations, sideMargin, operationsY, bodyWidth);
    } else if (buildingId === "market") {
      this.drawMarketControls(content, state, translations, sideMargin, operationsY, bodyWidth);
    } else if (buildingId === "barracks") {
      this.drawBarracksControls(content, state, translations, sideMargin, operationsY, bodyWidth);
    } else {
      this.drawBuildingOperations(content, buildingId, level, translations, sideMargin, operationsY, bodyWidth);
    }

    const footerY = modalHeight - 134;
    this.drawPanel(content, sideMargin, footerY, modalWidth - sideMargin * 2, 110);
    this.drawText(content, locked ? translations.ui.maxLevelReached : translations.ui.nextLevel, sideMargin + 28, footerY + 26, {
      fill: 0xf1df9a,
      fontSize: 13,
      fontWeight: "900",
    });

    this.drawCostLine(content, cost, state.resources, translations, sideMargin + 28, footerY + 62);
    this.drawWorkerRequirement(content, requiredWorkers, state.survivors.workers, translations, sideMargin + 208, footerY + 62);
    this.drawEffects(content, this.getNextLevelEffects(buildingId, level, translations), sideMargin + 290, footerY + 62, Math.max(120, modalWidth - 580));

    const warnings: string[] = [];
    if (!queueAvailable && !upgrading) {
      warnings.push(translations.ui.queueFull);
    }
    if (!workersAvailable && !upgrading) {
      warnings.push(translations.ui.notEnoughWorkers);
    }
    if (!mainBuildingUnlocked && !upgrading) {
      warnings.push(this.getMainBuildingRequirementTooltip(translations, requiredMainBuildingLevel));
    }

    warnings.forEach((warning, index) => {
      this.drawText(content, warning, sideMargin + 28, footerY + 86 + index * 16, { fill: 0xff9aa2, fontSize: 11, fontWeight: "800" });
    });

    const buttonLabel = upgrading
      ? `${Math.ceil(upgradingRemaining)}s`
      : locked
        ? `${level}/${maxLevel}`
        : !mainBuildingUnlocked
          ? this.getMainBuildingRequirementLabel(translations, requiredMainBuildingLevel)
          : queueAvailable
          ? translations.ui.upgrade
          : translations.ui.queueFull;
    this.createModalButton(
      content,
      buttonLabel,
      modalWidth - 258,
      footerY + 24,
      210,
      44,
      { action: "upgrade", building: buildingId },
      disabled,
      !mainBuildingUnlocked
        ? this.getMainBuildingRequirementTooltip(translations, requiredMainBuildingLevel)
        : undefined,
    );
    this.drawIcon(content, "clock", modalWidth - 172, footerY + 88, 14);
    this.drawText(content, `${Math.ceil(getBuildingBuildSeconds(buildingId, level))}s`, modalWidth - 154, footerY + 80, {
      fill: 0xaeb4b8,
      fontSize: 11,
      fontWeight: "700",
    });
  }

  private getBuildingDetailMetrics(
    buildingId: BuildingId,
    building: GameState["buildings"][BuildingId],
    level: number,
    maxLevel: number,
    requiredWorkers: number,
    state: GameState,
    translations: TranslationPack,
  ): BuildingMetric[] {
    const definition = buildingById[buildingId];
    const defense = (definition.defense ?? 0) * level;

    return [
      {
        iconId: "build",
        label: translations.ui.level,
        value: `${level}/${maxLevel}`,
        fill: 0xf1df9a,
        tooltip: `${translations.ui.level} ${level}/${maxLevel}`,
      },
      {
        iconId: "shield",
        label: translations.ui.defense,
        value: `${Math.round(defense)}`,
        fill: defense > 0 ? 0xf5efdf : 0xd7ddd8,
        tooltip: `${translations.ui.defense}: ${Math.round(defense)}`,
      },
      this.getBuildingProductionMetric(buildingId, building, level, state, translations),
      this.getBuildingCoalMetric(buildingId, building, level, state, translations),
    ];
  }

  private getBuildingProductionMetric(
    buildingId: BuildingId,
    building: GameState["buildings"][BuildingId],
    level: number,
    state: GameState,
    translations: TranslationPack,
  ): BuildingMetric {
    const definition = buildingById[buildingId];
    const productionMultiplier = getGlobalProductionMultiplier(state);

    if (buildingId === "mainBuilding") {
      const bonus = getMainBuildingProductionBonus(level);
      return {
        iconId: "build",
        label: translations.ui.production,
        value: this.formatPercentBonus(bonus),
        fill: bonus > 0 ? 0xf1df9a : 0xd7ddd8,
        tooltip: `${translations.ui.production}: ${this.formatPercentBonus(bonus)}`,
      };
    }

    if (buildingId === "generator") {
      const rate = getCoalMineCoalRate(level, building.workers) * productionMultiplier;
      return {
        iconId: "coal",
        label: translations.ui.production,
        value: this.getHourlyRateLabel(rate),
        fill: this.getRateColor(rate),
        tooltip: `${translations.resources.coal}: ${this.getHourlyRateLabel(rate)}`,
      };
    }

    if (buildingId === "workshop") {
      const rate = getWorkshopMaterialRate(level, building.workers) * productionMultiplier;
      return {
        iconId: "material",
        label: translations.ui.production,
        value: this.getHourlyRateLabel(rate),
        fill: this.getRateColor(rate),
        tooltip: `${translations.resources.material}: ${this.getHourlyRateLabel(rate)}`,
      };
    }

    if (buildingId === "market") {
      const tradeLimit = getMarketTradeLimit(level);
      return {
        iconId: "material",
        label: translations.ui.marketTradeLimit ?? translations.ui.stock,
        value: `${tradeLimit}`,
        fill: tradeLimit > 0 ? 0xf1df9a : 0xd7ddd8,
        tooltip: `${translations.ui.marketTradeLimit ?? "Trade limit"}: ${tradeLimit}`,
      };
    }

    const produced = Object.entries(definition.produces ?? {})
      .find(([, amount]) => (amount ?? 0) > 0);

    if (produced) {
      const [resourceId, amount] = produced;
      const typedResourceId = resourceId as ResourceId;
      const rate = (amount ?? 0) *
        level *
        (typedResourceId === "morale" ? 1 : productionMultiplier);
      return {
        iconId: typedResourceId,
        label: translations.ui.production,
        value: this.getHourlyRateLabel(rate),
        fill: this.getRateColor(rate),
        tooltip: `${translations.resources[typedResourceId]}: ${this.getHourlyRateLabel(rate)}`,
      };
    }

    if (definition.housing) {
      const capacity = definition.housing * level;
      return {
        iconId: "home",
        label: translations.ui.housingCapacity,
        value: `+${capacity}`,
        fill: capacity > 0 ? 0xf1df9a : 0xd7ddd8,
        tooltip: `${translations.ui.housingCapacity}: ${capacity}`,
      };
    }

    const storage = Object.entries(definition.storageBonus ?? {})
      .find(([, amount]) => (amount ?? 0) > 0);

    if (storage) {
      const [resourceId, amount] = storage;
      const typedResourceId = resourceId as ResourceId;
      const capacity = Math.round((amount ?? 0) * level);
      return {
        iconId: typedResourceId,
        label: translations.ui.stock,
        value: `+${capacity}`,
        fill: capacity > 0 ? 0xf1df9a : 0xd7ddd8,
        tooltip: `${translations.resources[typedResourceId]} ${translations.ui.stock}: +${capacity}`,
      };
    }

    return {
      iconId: "build",
      label: translations.ui.production,
      value: "0",
      fill: 0xd7ddd8,
      tooltip: translations.ui.production,
    };
  }

  private getBuildingCoalMetric(
    buildingId: BuildingId,
    building: GameState["buildings"][BuildingId],
    level: number,
    state: GameState,
    translations: TranslationPack,
  ): BuildingMetric {
    const definition = buildingById[buildingId];
    const consumption =
      ((definition.consumes?.coal ?? 0) + (definition.alwaysConsumes?.coal ?? 0)) * level;
    const production = buildingId === "generator"
      ? getCoalMineCoalRate(level, building.workers) *
        getGlobalProductionMultiplier(state)
      : 0;
    const staffedConsumption = buildingId === "workshop"
      ? getWorkshopCoalRate(level, building.workers)
      : consumption;
    const netRate = production - staffedConsumption;

    return {
      iconId: "coal",
      label: translations.resources.coal,
      value: this.getHourlyRateLabel(netRate),
      fill: this.getRateColor(netRate),
      tooltip: `${translations.resources.coal}: ${this.getHourlyRateLabel(netRate)}`,
    };
  }

  private getBuildingWorkerMetricValue(
    buildingId: BuildingId,
    building: GameState["buildings"][BuildingId],
    requiredWorkers: number,
    state: GameState,
  ): string {
    const workerLimit = getBuildingWorkerLimit(state, buildingId);

    if (workerLimit > 0) {
      return `${building.workers}/${workerLimit}`;
    }

    if (building.constructionWorkers > 0) {
      return `${building.constructionWorkers}`;
    }

    return `${requiredWorkers}`;
  }

  private drawMetricCard(
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

    const box = new Graphics();
    box.roundRect(0, 0, width, height, 7)
      .fill({ color: 0x10120e, alpha: 0.78 })
      .stroke({ color: 0xe0c46f, alpha: 0.18, width: 1 });
    card.addChild(box);

    this.drawIcon(card, metric.iconId, 22, height / 2, 22);
    this.drawText(card, metric.label, 48, 12, {
      fill: 0xaeb4b8,
      fontSize: 11,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: width - 58,
    });
    this.drawText(card, metric.value, 48, 32, {
      fill: metric.fill ?? 0xf5efdf,
      fontSize: 17,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: width - 58,
    });

    if (metric.tooltip) {
      this.bindTooltip(card, metric.tooltip);
    }
  }

  private drawSectionTitle(parent: Container, label: string, x: number, y: number): void {
    this.drawText(parent, label, x, y, {
      fill: 0xf1df9a,
      fontSize: 13,
      fontWeight: "900",
    });
  }

  private drawBuildingOperations(
    parent: Container,
    buildingId: BuildingId,
    level: number,
    translations: TranslationPack,
    x: number,
    y: number,
    width: number,
  ): number {
    const effects = this.getCurrentBuildingEffects(buildingId, level, translations);
    const height = 112;

    this.drawPanel(parent, x, y, width, height);
    this.drawSectionTitle(parent, translations.ui.operations ?? "Operations", x + 20, y + 18);

    if (effects.length === 0) {
      this.drawText(parent, translations.ui.resourceNoActiveEffects ?? "-", x + 20, y + 54, {
        fill: 0xaeb4b8,
        fontSize: 12,
        fontWeight: "800",
      });
      return y + height + 14;
    }

    this.drawEffects(parent, effects, x + 20, y + 56, width - 40);
    return y + height + 14;
  }

  private drawStaffedProductionControls(
    parent: Container,
    buildingId: BuildingId,
    state: GameState,
    translations: TranslationPack,
    x: number,
    y: number,
    width: number,
  ): number {
    const building = state.buildings[buildingId];
    const workerLimit = getBuildingWorkerLimit(state, buildingId);

    if (workerLimit <= 0) {
      return y;
    }

    const productionResourceId: ResourceId = buildingId === "workshop" ? "material" : "coal";
    const productionPerHour = (
      buildingId === "workshop"
        ? getWorkshopMaterialRate(building.level, building.workers)
        : getCoalMineCoalRate(building.level, building.workers)
    ) * GAME_HOUR_REAL_SECONDS;
    const coalUsePerHour = buildingId === "workshop"
      ? getWorkshopCoalRate(building.level, building.workers) * GAME_HOUR_REAL_SECONDS
      : 0;
    this.drawPanel(parent, x, y, width, 104);
    this.drawSectionTitle(parent, translations.ui.operations ?? "Operations", x + 20, y + 18);
    this.drawText(parent, `${translations.ui.workers}: ${building.workers}/${workerLimit}`, x + 20, y + 50, { fill: 0xf5efdf, fontSize: 13, fontWeight: "800" });
    this.drawInfoToken(parent, {
      iconId: productionResourceId,
      text: `+${this.formatRate(productionPerHour)}/h`,
      tooltip: `${translations.resources[productionResourceId]}: +${this.formatRate(productionPerHour)}/h`,
      x: x + 20,
      y: y + 74,
    });
    if (coalUsePerHour > 0) {
      this.drawInfoToken(parent, {
        iconId: "coal",
        text: `-${this.formatRate(coalUsePerHour)}/h`,
        tooltip: `${translations.resources.coal}: -${this.formatRate(coalUsePerHour)}/h`,
        missing: true,
        x: x + 118,
        y: y + 74,
      });
    }
    this.createModalButton(parent, "-", x + width - 96, y + 42, 36, 32, { action: "building-workers", building: buildingId, delta: -1 }, building.workers <= 0);
    this.createModalButton(parent, "+", x + width - 48, y + 42, 36, 32, { action: "building-workers", building: buildingId, delta: 1 }, building.workers >= workerLimit || state.survivors.workers <= 0);
    return y + 118;
  }

  private drawMarketControls(
    parent: Container,
    state: GameState,
    translations: TranslationPack,
    x: number,
    y: number,
    width: number,
  ): number {
    const marketLevel = state.buildings.market.level;

    if (marketLevel <= 0) {
      return y;
    }

    this.normalizeMarketSelection();
    const tradeLimit = getMarketTradeLimit(marketLevel);
    const tradeSlots = getMarketTradeSlots(marketLevel);
    const availableTrades = getAvailableMarketTrades(state);
    const tradeCapacity = getMarketTradeCapacity(
      state,
      this.marketFromResource,
      this.marketToResource,
    );
    const maxAmount = Math.max(1, tradeCapacity);
    this.marketAmount = Math.max(1, Math.min(this.marketAmount, maxAmount));

    const cooldownRemaining = state.market.cooldownRemainingSeconds;
    const statusText = cooldownRemaining > 0
      ? `${translations.ui.marketCooldown ?? "Cooldown"}: ${this.formatScoutingRemaining(cooldownRemaining)}`
      : `${translations.ui.marketTrades ?? "Trades"}: ${availableTrades}/${tradeSlots}`;
    const disabled = !canTradeAtMarket(
      state,
      this.marketFromResource,
      this.marketToResource,
      this.marketAmount,
    );
    const disabledTooltip = this.getMarketTradeDisabledTooltip(
      state,
      translations,
      tradeCapacity,
    );

    this.drawPanel(parent, x, y, width, 170);
    this.drawSectionTitle(parent, translations.ui.marketExchange ?? "Exchange", x + 20, y + 18);
    this.drawText(
      parent,
      `${translations.ui.marketTradeLimit ?? "Limit"}: ${tradeLimit} / ${statusText}`,
      x + 20,
      y + 42,
      { fill: 0xaeb4b8, fontSize: 12, fontWeight: "800" },
    );

    this.drawMarketResourceButtons(
      parent,
      translations.ui.marketGive ?? "Give",
      this.marketFromResource,
      x + 20,
      y + 72,
      (resourceId) => {
        this.marketFromResource = resourceId;
        if (this.marketToResource === resourceId) {
          this.marketToResource = this.getNextMarketResource(resourceId);
        }
        this.requestRender();
      },
      translations,
    );
    this.drawMarketResourceButtons(
      parent,
      translations.ui.marketReceive ?? "Receive",
      this.marketToResource,
      x + 20,
      y + 116,
      (resourceId) => {
        this.marketToResource = resourceId;
        if (this.marketFromResource === resourceId) {
          this.marketFromResource = this.getNextMarketResource(resourceId);
        }
        this.requestRender();
      },
      translations,
    );

    this.drawMarketAmountStepper(
      parent,
      translations,
      x + width - 238,
      y + 72,
      196,
      tradeCapacity,
    );
    this.createModalButton(
      parent,
      translations.ui.marketTrade ?? "Trade",
      x + width - 238,
      y + 126,
      196,
      34,
      {
        action: "market-trade",
        marketFromResource: this.marketFromResource,
        marketToResource: this.marketToResource,
        marketAmount: this.marketAmount,
      },
      disabled,
      disabledTooltip,
    );

    return y + 184;
  }

  private drawMarketResourceButtons(
    parent: Container,
    label: string,
    activeResourceId: MarketResourceId,
    x: number,
    y: number,
    onSelect: (resourceId: MarketResourceId) => void,
    translations: TranslationPack,
  ): void {
    this.drawText(parent, label, x, y, {
      fill: 0xaeb4b8,
      fontSize: 11,
      fontWeight: "900",
    });

    let offsetX = 74;
    for (const resourceId of marketResourceIds) {
      this.createRectButton(parent, {
        label: translations.resources[resourceId],
        x: x + offsetX,
        y: y - 8,
        width: 66,
        height: 30,
        onTap: () => onSelect(resourceId),
        active: resourceId === activeResourceId,
        tone: "secondary",
        fontSize: 11,
        fontWeight: "900",
      });
      offsetX += 72;
    }
  }

  private drawMarketAmountStepper(
    parent: Container,
    translations: TranslationPack,
    x: number,
    y: number,
    width: number,
    tradeCapacity: number,
  ): void {
    const stepper = new Container();
    stepper.x = x;
    stepper.y = y;
    parent.addChild(stepper);

    const box = new Graphics();
    box.roundRect(0, 0, width, 44, 7)
      .fill({ color: 0x0c0f0d, alpha: 0.58 })
      .stroke({ color: 0xe0c46f, alpha: 0.14, width: 1 });
    stepper.addChild(box);

    this.drawText(stepper, translations.ui.marketAmount ?? "Amount", 12, 7, {
      fill: 0xaeb4b8,
      fontSize: 11,
      fontWeight: "800",
    });
    this.createLocalModalButton(stepper, "-10", width - 126, 8, 38, 28, () => {
      this.marketAmount = Math.max(1, this.marketAmount - 10);
      this.requestRender();
    }, this.marketAmount <= 1);
    this.drawCenteredText(stepper, `${this.marketAmount}`, width - 64, 22, {
      fill: tradeCapacity > 0 ? 0xf1df9a : 0xff9aa2,
      fontSize: 17,
      fontWeight: "900",
    });
    this.createLocalModalButton(stepper, "+10", width - 42, 8, 38, 28, () => {
      this.marketAmount = Math.min(Math.max(1, tradeCapacity), this.marketAmount + 10);
      this.requestRender();
    }, tradeCapacity <= 0 || this.marketAmount >= tradeCapacity);
  }

  private normalizeMarketSelection(): void {
    if (!isMarketResourceId(this.marketFromResource)) {
      this.marketFromResource = "material";
    }

    if (!isMarketResourceId(this.marketToResource)) {
      this.marketToResource = "food";
    }

    if (this.marketFromResource === this.marketToResource) {
      this.marketToResource = this.getNextMarketResource(this.marketFromResource);
    }
  }

  private getNextMarketResource(resourceId: MarketResourceId): MarketResourceId {
    return marketResourceIds.find((candidate) => candidate !== resourceId) ?? "food";
  }

  private getMarketTradeDisabledTooltip(
    state: GameState,
    translations: TranslationPack,
    tradeCapacity: number,
  ): string | undefined {
    if (state.market.cooldownRemainingSeconds > 0) {
      return `${translations.ui.marketCooldown ?? "Cooldown"}: ${this.formatScoutingRemaining(state.market.cooldownRemainingSeconds)}`;
    }

    if (getAvailableMarketTrades(state) <= 0) {
      return translations.ui.marketNoTrades ?? "No trade slot available.";
    }

    if (this.marketFromResource === this.marketToResource) {
      return translations.ui.marketSameResource ?? "Choose two different resources.";
    }

    if (tradeCapacity <= 0) {
      return translations.ui.marketNoCapacity ?? "Not enough stock or storage capacity.";
    }

    return undefined;
  }

  private drawBarracksControls(parent: Container, state: GameState, translations: TranslationPack, x: number, y: number, width: number): number {
    if (state.buildings.barracks.level <= 0) {
      return y;
    }

    const panelHeight = 174;
    const contentY = y + 62;
    const selectedTroops = Math.max(1, Math.floor(this.barracksTroopCount));
    const maxSelectableTroops = Math.max(1, Math.max(state.survivors.workers, state.survivors.troops));
    this.barracksTroopCount = Math.min(selectedTroops, maxSelectableTroops);

    this.drawPanel(parent, x, y, width, panelHeight);
    this.drawBarracksTabs(parent, translations, x + 20, y + 18);

    if (this.activeBarracksTab === "scouting") {
      this.drawBarracksScouting(parent, state, translations, x, contentY, width);
      return y + panelHeight + 14;
    }

    this.drawBarracksTraining(parent, state, translations, x, contentY, width, maxSelectableTroops);
    return y + panelHeight + 14;
  }

  private drawBarracksTraining(
    parent: Container,
    state: GameState,
    translations: TranslationPack,
    x: number,
    y: number,
    width: number,
    maxSelectableTroops: number,
  ): void {
    this.drawBarracksAvailabilityCard(parent, "people", translations.ui.availableWorkers, state.survivors.workers, x + 20, y, 156, 42);
    this.drawBarracksAvailabilityCard(parent, "scout", translations.ui.availableTroops, state.survivors.troops, x + 188, y, 156, 42);
    this.drawTroopCountStepper(
      parent,
      translations.ui.squadSize ?? translations.roles.troops,
      this.barracksTroopCount,
      maxSelectableTroops,
      x + width - 208,
      y,
      188,
    );

    this.createModalButton(
      parent,
      translations.ui.workerToTroop,
      x + 20,
      y + 58,
      156,
      32,
      { action: "barracks-worker-to-troop", troopCount: this.barracksTroopCount },
      state.survivors.workers < this.barracksTroopCount,
    );
    this.createModalButton(
      parent,
      translations.ui.troopToWorker,
      x + 188,
      y + 58,
      156,
      32,
      { action: "barracks-troop-to-worker", troopCount: this.barracksTroopCount },
      state.survivors.troops < this.barracksTroopCount,
    );
  }

  private drawBarracksScouting(
    parent: Container,
    state: GameState,
    translations: TranslationPack,
    x: number,
    y: number,
    width: number,
  ): void {
    const maxScoutingTroops = Math.max(1, state.survivors.troops);
    this.barracksTroopCount = Math.min(this.barracksTroopCount, maxScoutingTroops);

    this.drawText(
      parent,
      `${translations.ui.scoutingDuration}: ${this.formatScoutingRemaining(SCOUTING_DURATION_SECONDS)} / ${translations.ui.scoutingCapacity}: ${SCOUTING_CARRY_PER_TROOP}`,
      x + 20,
      y,
      { fill: 0xaeb4b8, fontSize: 12, fontWeight: "800" },
    );

    this.drawTroopCountStepper(
      parent,
      translations.ui.squadSize ?? translations.roles.troops,
      this.barracksTroopCount,
      maxScoutingTroops,
      x + width - 208,
      y - 14,
      188,
    );
    this.drawScoutingLaunchRow(parent, translations, "safe", y + 46, state.survivors.troops, this.barracksTroopCount, x, width);
    this.drawScoutingLaunchRow(parent, translations, "risky", y + 78, state.survivors.troops, this.barracksTroopCount, x, width);
  }

  private drawBarracksTabs(parent: Container, translations: TranslationPack, x: number, y: number): void {
    const tabs: Array<{ id: BarracksTab; label: string }> = [
      { id: "training", label: translations.ui.training ?? "Training" },
      { id: "scouting", label: translations.ui.scouting },
    ];
    this.drawTabs(parent, tabs, {
      activeId: this.activeBarracksTab,
      x,
      y,
      height: 32,
      minWidth: 112,
      onSelect: (tab) => {
        this.activeBarracksTab = tab;
        this.requestRender();
      },
    });
  }

  private drawBarracksAvailabilityCard(
    parent: Container,
    iconId: string,
    label: string,
    value: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const card = new Container();
    card.x = x;
    card.y = y;
    parent.addChild(card);

    const box = new Graphics();
    box.roundRect(0, 0, width, height, 7)
      .fill({ color: 0x0c0f0d, alpha: 0.58 })
      .stroke({ color: 0xe0c46f, alpha: 0.14, width: 1 });
    card.addChild(box);
    this.drawIcon(card, iconId, 22, height / 2, 20);
    this.drawText(card, label, 48, 8, { fill: 0xaeb4b8, fontSize: 11, fontWeight: "800" });
    this.drawText(card, `${value}`, 48, 26, { fill: 0xf5efdf, fontSize: 17, fontWeight: "900" });
  }

  private drawTroopCountStepper(
    parent: Container,
    label: string,
    value: number,
    maxValue: number,
    x: number,
    y: number,
    width: number,
  ): void {
    const stepper = new Container();
    stepper.x = x;
    stepper.y = y;
    parent.addChild(stepper);

    const box = new Graphics();
    box.roundRect(0, 0, width, 50, 7)
      .fill({ color: 0x0c0f0d, alpha: 0.58 })
      .stroke({ color: 0xe0c46f, alpha: 0.14, width: 1 });
    stepper.addChild(box);

    this.drawText(stepper, label, 12, 8, { fill: 0xaeb4b8, fontSize: 11, fontWeight: "800" });
    this.createLocalModalButton(stepper, "-", width - 108, 12, 30, 28, () => {
      this.barracksTroopCount = Math.max(1, this.barracksTroopCount - 1);
      this.requestRender();
    }, value <= 1);
    this.drawCenteredText(stepper, `${value}`, width - 58, 26, {
      fill: 0xf1df9a,
      fontSize: 17,
      fontWeight: "900",
    });
    this.createLocalModalButton(stepper, "+", width - 38, 12, 30, 28, () => {
      this.barracksTroopCount = Math.min(maxValue, this.barracksTroopCount + 1);
      this.requestRender();
    }, value >= maxValue);
  }

  private drawScoutingLaunchRow(
    parent: Container,
    translations: TranslationPack,
    mode: ScoutingMode,
    y: number,
    availableTroops: number,
    selectedTroops: number,
    x: number,
    width: number,
  ): void {
    const modeLabel = translations.ui[mode === "safe" ? "safeScouting" : "riskyScouting"];
    const riskLabel = mode === "safe" ? translations.ui.safeScoutingRisk : translations.ui.riskyScoutingRisk;

    const rowContainer = new Container();
    parent.addChild(rowContainer);

    const row = new Graphics();
    row.roundRect(x + 18, y - 2, width - 36, 28, 7)
      .fill({ color: 0x080a09, alpha: 0.44 })
      .stroke({ color: 0xe0c46f, alpha: 0.12, width: 1 });
    rowContainer.addChild(row);
    this.drawIcon(rowContainer, mode === "safe" ? "scout" : "shield", x + 34, y + 12, 17);
    this.drawText(rowContainer, modeLabel, x + 50, y + 3, { fill: 0xf5efdf, fontSize: 12, fontWeight: "900" });
    rowContainer.hitArea = new Rectangle(x + 18, y - 2, width - 52, 28);
    this.bindTooltip(rowContainer, riskLabel);
    this.createModalButton(
      parent,
      `${translations.ui.sendScouting ?? "Send"} ${selectedTroops}`,
      x + width - 118,
      y - 1,
      84,
      26,
      { action: "start-scouting", scoutMode: mode, scoutTroops: selectedTroops },
      availableTroops < selectedTroops,
    );
  }

  private drawEffects(parent: Container, effects: EffectLine[], x: number, y: number, maxWidth: number): number {
    let offsetX = 0;
    let offsetY = 0;
    let maxOffsetX = 0;
    for (const effect of effects.slice(0, 4)) {
      const token = this.drawInfoToken(parent, {
        iconId: effect.iconId,
        text: effect.value,
        tooltip: effect.tooltip,
        missing: effect.negative,
        x: x + offsetX,
        y: y + offsetY,
      });

      if (offsetX > 0 && offsetX + token.width > maxWidth) {
        offsetX = 0;
        offsetY += 18;
        token.x = x;
        token.y = y + offsetY;
      }

      offsetX += token.width + 8;
      maxOffsetX = Math.max(maxOffsetX, offsetX);
    }

    return maxOffsetX;
  }

  private drawCostLine(parent: Container, bag: ResourceBag, availableResources: GameState["resources"], translations: TranslationPack, x: number, y: number): number {
    let offset = 0;
    for (const part of this.getCostLineParts(bag, availableResources, translations)) {
      const item = this.drawInfoToken(parent, {
        iconId: part.iconId,
        text: part.text,
        tooltip: part.tooltip,
        missing: part.missing,
        x: x + offset,
        y,
      });
      offset += item.width + 8;
    }

    return offset;
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
      const item = this.drawInfoToken(parent, {
        iconId: typedResourceId,
        text: `+${roundedAmount}`,
        tooltip: `${translations.resources[typedResourceId]}: ${translations.resourceDescriptions[typedResourceId]}`,
        x: x + offset,
        y,
      });
      offset += item.width + 8;
    }

    return offset;
  }

  private drawWorkerRequirement(parent: Container, required: number, available: number, translations: TranslationPack, x: number, y: number): number {
    const missing = available < required;
    const token = this.drawInfoToken(parent, {
      iconId: "people",
      text: `${required}`,
      tooltip: `${translations.ui.constructionWorkers}: ${Math.floor(available)}/${required}`,
      missing,
      x,
      y,
    });

    return token.width;
  }

  private getMainBuildingRequirementLabel(
    translations: TranslationPack,
    requiredLevel: number,
  ): string {
    return this.formatTemplate(
      translations.ui.requiresMainBuildingLevelShort ?? "Main lvl {level}",
      { level: requiredLevel },
    );
  }

  private getMainBuildingRequirementTooltip(
    translations: TranslationPack,
    requiredLevel: number,
  ): string {
    return this.formatTemplate(
      translations.ui.requiresMainBuildingLevel ?? "Requires main building level {level}.",
      { level: requiredLevel },
    );
  }

  private getBuildActionDisabledTooltip(
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
      reasons.push(this.getMainBuildingRequirementTooltip(translations, requiredMainBuildingLevel));
    }
    if (!queueAvailable) {
      reasons.push(translations.ui.queueFull);
    }
    if (availableWorkers < requiredWorkers) {
      reasons.push(translations.ui.notEnoughWorkers);
    }

    const missingResourceLabels = this.getMissingResourceLabels(cost, resources, translations);
    if (missingResourceLabels.length > 0) {
      reasons.push(`${translations.ui.notEnoughResources ?? "Not enough resources"}: ${missingResourceLabels.join(", ")}`);
    }

    return reasons.join("\n");
  }

  private getMissingResourceLabels(
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

  private drawInfoToken(
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

    this.drawIcon(token, options.iconId, 8, 8, 14);
    const label = this.drawText(token, options.text, 20, 0, {
      fill: options.missing ? 0xff6f7d : 0xf1df9a,
      fontSize: 12,
      fontWeight: "900",
    });
    this.bindTooltip(token, options.tooltip);

    token.hitArea = new Rectangle(0, -2, label.width + 26, 20);
    return token;
  }

  private drawStatPill(parent: Container, iconId: string, label: string, x: number, y: number): void {
    const pill = new Container();
    pill.x = x;
    pill.y = y;
    parent.addChild(pill);
    this.drawPanel(pill, 0, 0, 118, 30);
    this.drawIcon(pill, iconId, 16, 15, 15);
    this.drawText(pill, label, 32, 7, { fill: 0xf5efdf, fontSize: 12, fontWeight: "800" });
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

  private getCostLineParts(bag: ResourceBag, availableResources: GameState["resources"], translations: TranslationPack): CostLinePart[] {
    return Object.entries(bag)
      .filter(([, amount]) => (amount ?? 0) > 0)
      .map(([resourceId, amount]) => {
        const typedResourceId = resourceId as ResourceId;
        const required = Math.ceil(amount ?? 0);
        const available = availableResources[typedResourceId] ?? required;
        return {
          text: `${required}`,
          iconId: typedResourceId,
          missing: available < required,
          tooltip: `${translations.resources[typedResourceId]}: ${translations.resourceDescriptions[typedResourceId]} (${Math.floor(available)}/${required})`,
        };
      });
  }

  private getNextLevelEffects(buildingId: BuildingId, currentLevel: number, translations: TranslationPack): EffectLine[] {
    const definition = buildingById[buildingId];

    if (!definition || currentLevel >= definition.maxLevel) {
      return [];
    }

    const effects: EffectLine[] = [];

    if (buildingId === "mainBuilding") {
      const nextBonus = getMainBuildingProductionBonus(currentLevel + 1);
      if (nextBonus > 0) {
        effects.push({
          iconId: "build",
          value: this.formatPercentBonus(nextBonus),
          tooltip: `${translations.ui.production}: ${this.formatPercentBonus(nextBonus)}`,
        });
      }

      const currentMoralePerHour = getMainBuildingMoraleRate(currentLevel) *
        GAME_HOUR_REAL_SECONDS;
      const nextMoralePerHour = getMainBuildingMoraleRate(currentLevel + 1) *
        GAME_HOUR_REAL_SECONDS;
      const moraleDelta = nextMoralePerHour - currentMoralePerHour;

      if (moraleDelta > 0) {
        effects.push({
          iconId: "morale",
          value: `+${this.formatRate(moraleDelta)}/h`,
          tooltip: `${translations.resources.morale} +${this.formatRate(moraleDelta)}/h`,
        });
      }
    }

    const attractedSurvivors = getSurvivorAttractionOnCompletedLevel(
      buildingId,
      currentLevel + 1,
    );

    if (attractedSurvivors > 0) {
      effects.push({
        iconId: "people",
        value: `+${attractedSurvivors}`,
        tooltip: `${translations.ui.population} +${attractedSurvivors}`,
      });
    }
    if (buildingId === "clinic") {
      const treatmentPerHour = getClinicTreatmentRatePerGameHour(currentLevel + 1);
      const foodPerHour = treatmentPerHour * getClinicFoodPerTreatment();
      effects.push({
        iconId: "people",
        value: `+${this.formatRate(treatmentPerHour)}/h`,
        tooltip: `${translations.ui.treatment} +${this.formatRate(treatmentPerHour)}/h (${translations.resources.food} -${this.formatRate(foodPerHour)}/h)`,
      });
    }
    if (buildingId === "dormitory") {
      const housing = definition.housing ?? 0;
      effects.push({
        iconId: "home",
        value: `+${housing}`,
        tooltip: `${translations.ui.housingCapacity} +${housing}`,
      });
    }
    if (buildingId === "barracks") {
      effects.push({
        iconId: "scout",
        value: "+",
        tooltip: translations.ui.unlocksTroopTraining,
      });
    }
    if (buildingId === "generator") {
      const currentLimit = currentLevel <= 0 ? 0 : Math.min(4, currentLevel + 1);
      const nextLimit = Math.min(4, currentLevel + 2);
      const currentMaxRate = getCoalMineCoalRate(currentLevel, currentLimit) * GAME_HOUR_REAL_SECONDS;
      const nextMaxRate = getCoalMineCoalRate(currentLevel + 1, nextLimit) * GAME_HOUR_REAL_SECONDS;
      if (nextLimit > currentLimit) {
        effects.push({
          iconId: "people",
          value: `+${nextLimit - currentLimit}`,
          tooltip: `${translations.ui.workers} max +${nextLimit - currentLimit}`,
        });
      }
      effects.push({
        iconId: "coal",
        value: `+${this.formatRate(nextMaxRate - currentMaxRate)}/h`,
        tooltip: `${translations.resources.coal} max +${this.formatRate(nextMaxRate - currentMaxRate)}/h`,
      });
    }
    if (buildingId === "workshop") {
      const currentLimit = currentLevel <= 0 ? 0 : Math.min(4, currentLevel + 1);
      const nextLimit = Math.min(4, currentLevel + 2);
      const currentMaxRate = getWorkshopMaterialRate(currentLevel, currentLimit) * GAME_HOUR_REAL_SECONDS;
      const nextMaxRate = getWorkshopMaterialRate(currentLevel + 1, nextLimit) * GAME_HOUR_REAL_SECONDS;
      if (nextLimit > currentLimit) {
        effects.push({
          iconId: "people",
          value: `+${nextLimit - currentLimit}`,
          tooltip: `${translations.ui.workers} max +${nextLimit - currentLimit}`,
        });
      }
      effects.push({
        iconId: "material",
        value: `+${this.formatRate(nextMaxRate - currentMaxRate)}/h`,
        tooltip: `${translations.resources.material} max +${this.formatRate(nextMaxRate - currentMaxRate)}/h`,
      });
    }
    if (buildingId === "market") {
      const currentTradeLimit = getMarketTradeLimit(currentLevel);
      const nextTradeLimit = getMarketTradeLimit(currentLevel + 1);
      const currentTradeSlots = getMarketTradeSlots(currentLevel);
      const nextTradeSlots = getMarketTradeSlots(currentLevel + 1);

      if (nextTradeLimit > currentTradeLimit) {
        effects.push({
          iconId: "material",
          value: `+${nextTradeLimit - currentTradeLimit}`,
          tooltip: `${translations.ui.marketTradeLimit ?? "Trade limit"} +${nextTradeLimit - currentTradeLimit}`,
        });
      }

      if (nextTradeSlots > currentTradeSlots) {
        effects.push({
          iconId: "build",
          value: `+${nextTradeSlots - currentTradeSlots}`,
          tooltip: `${translations.ui.marketTrades ?? "Trades"} +${nextTradeSlots - currentTradeSlots}`,
        });
      }
    }
    if (definition.defense) {
      effects.push({
        iconId: "shield",
        value: `+${definition.defense}`,
        tooltip: `${translations.ui.defense} +${definition.defense}`,
      });
    }
    for (const [resourceId, amount] of Object.entries(definition.produces ?? {})) {
      const typedResourceId = resourceId as ResourceId;
      effects.push({
        iconId: typedResourceId,
        value: `+${this.formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
        tooltip: `${translations.resources[typedResourceId]} +${this.formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
      });
    }
    for (const [resourceId, amount] of Object.entries(definition.consumes ?? {})) {
      const typedResourceId = resourceId as ResourceId;
      effects.push({
        iconId: typedResourceId,
        value: `-${this.formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
        tooltip: `${translations.resources[typedResourceId]} -${this.formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
        negative: true,
      });
    }
    for (const [resourceId, amount] of Object.entries(definition.alwaysConsumes ?? {})) {
      const typedResourceId = resourceId as ResourceId;
      effects.push({
        iconId: typedResourceId,
        value: `-${this.formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
        tooltip: `${translations.resources[typedResourceId]} -${this.formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
        negative: true,
      });
    }
    for (const [resourceId, amount] of Object.entries(definition.storageBonus ?? {})) {
      const typedResourceId = resourceId as ResourceId;
      effects.push({
        iconId: typedResourceId,
        value: `+${Math.round(amount ?? 0)}`,
        tooltip: `${translations.resources[typedResourceId]} cap +${Math.round(amount ?? 0)}`,
      });
    }

    return effects;
  }

  private getCurrentBuildingEffects(buildingId: BuildingId, level: number, translations: TranslationPack): EffectLine[] {
    const definition = buildingById[buildingId];

    if (!definition || level <= 0) {
      return [];
    }

    const effects: EffectLine[] = [];

    if (buildingId === "mainBuilding") {
      const bonus = getMainBuildingProductionBonus(level);
      if (bonus > 0) {
        effects.push({
          iconId: "build",
          value: this.formatPercentBonus(bonus),
          tooltip: `${translations.ui.production}: ${this.formatPercentBonus(bonus)}`,
        });
      }

      const moralePerHour = getMainBuildingMoraleRate(level) * GAME_HOUR_REAL_SECONDS;

      if (moralePerHour > 0) {
        effects.push({
          iconId: "morale",
          value: `+${this.formatRate(moralePerHour)}/h`,
          tooltip: `${translations.resources.morale} +${this.formatRate(moralePerHour)}/h`,
        });
      }
    }

    if (buildingId === "clinic") {
      const treatmentPerHour = getClinicTreatmentRatePerGameHour(level);
      const foodPerHour = treatmentPerHour * getClinicFoodPerTreatment();
      effects.push({
        iconId: "people",
        value: `+${this.formatRate(treatmentPerHour)}/h`,
        tooltip: `${translations.ui.treatment} +${this.formatRate(treatmentPerHour)}/h (${translations.resources.food} -${this.formatRate(foodPerHour)}/h)`,
      });
    }

    if (buildingId === "dormitory" && definition.housing) {
      effects.push({
        iconId: "home",
        value: `+${definition.housing * level}`,
        tooltip: `${translations.ui.housingCapacity} +${definition.housing * level}`,
      });
    }

    if (buildingId === "market") {
      effects.push({
        iconId: "material",
        value: `${getMarketTradeLimit(level)}`,
        tooltip: `${translations.ui.marketTradeLimit ?? "Trade limit"} ${getMarketTradeLimit(level)}`,
      });

      if (getMarketTradeSlots(level) > 1) {
        effects.push({
          iconId: "build",
          value: `${getMarketTradeSlots(level)}x`,
          tooltip: `${translations.ui.marketTrades ?? "Trades"} ${getMarketTradeSlots(level)}`,
        });
      }
    }

    if (definition.defense) {
      effects.push({
        iconId: "shield",
        value: `+${definition.defense * level}`,
        tooltip: `${translations.ui.defense} +${definition.defense * level}`,
      });
    }

    for (const [resourceId, amount] of Object.entries(definition.produces ?? {})) {
      const typedResourceId = resourceId as ResourceId;
      effects.push({
        iconId: typedResourceId,
        value: `+${this.formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
        tooltip: `${translations.resources[typedResourceId]} +${this.formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
      });
    }

    for (const [resourceId, amount] of Object.entries(definition.consumes ?? {})) {
      const typedResourceId = resourceId as ResourceId;
      effects.push({
        iconId: typedResourceId,
        value: `-${this.formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
        tooltip: `${translations.resources[typedResourceId]} -${this.formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
        negative: true,
      });
    }

    for (const [resourceId, amount] of Object.entries(definition.alwaysConsumes ?? {})) {
      const typedResourceId = resourceId as ResourceId;
      effects.push({
        iconId: typedResourceId,
        value: `-${this.formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
        tooltip: `${translations.resources[typedResourceId]} -${this.formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
        negative: true,
      });
    }

    for (const [resourceId, amount] of Object.entries(definition.storageBonus ?? {})) {
      const typedResourceId = resourceId as ResourceId;
      effects.push({
        iconId: typedResourceId,
        value: `+${Math.round((amount ?? 0) * level)}`,
        tooltip: `${translations.resources[typedResourceId]} cap +${Math.round((amount ?? 0) * level)}`,
      });
    }

    return effects;
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
    const group = new Container();
    const text = new Text({
      text: label,
      style: {
        fill: labelFill,
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: compact ? 12 : 13,
        fontWeight: "800",
      },
    });
    const subtext = sublabel
      ? new Text({
        text: sublabel,
        style: {
          fill: sublabelFill,
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: compact ? 9 : 10,
          fontWeight: "800",
        },
      })
      : null;
    const width = Math.max(compact ? 62 : 68, Math.max(text.width, subtext?.width ?? 0) + (compact ? 38 : 44));
    const height = subtext ? (compact ? 38 : 46) : (compact ? 30 : 34);
    const panel = new Graphics();
    panel
      .roundRect(0, 0, width, height, compact ? 7 : 8)
      .fill({ color: 0x10120e, alpha: compact ? 0.64 : 0.76 })
      .stroke({ color: compact ? 0xb8c693 : 0xe0c46f, alpha: compact ? 0.16 : 0.22, width: 1 });
    group.addChild(panel);
    this.drawIcon(group, iconId, compact ? 15 : 17, height / 2, compact ? 14 : 16);
    text.x = compact ? 28 : 32;
    text.y = subtext ? (compact ? 4 : 6) : (compact ? 6 : 7);
    group.addChild(text);
    if (subtext) {
      subtext.x = compact ? 28 : 32;
      subtext.y = compact ? 22 : 25;
      group.addChild(subtext);
    }
    if (tooltip) {
      this.bindTooltip(group, tooltip);
    }
    if (action) {
      this.bindAction(group, action);
    }
    return group;
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
  ): Container {
    return this.createCircleButton(parent, {
      iconId,
      x,
      y,
      radius,
      detail,
      tooltip,
      active,
    });
  }

  private createRectButton(parent: Container, options: RectButtonOptions): Container {
    const button = new Container();
    button.x = options.x;
    button.y = options.y;

    const style = this.getRectButtonStyle(options.tone ?? "toolbar", options.disabled ?? false, options.active ?? false);
    const box = new Graphics();
    box.roundRect(0, 0, options.width, options.height, 7)
      .fill({ color: style.fill, alpha: style.fillAlpha })
      .stroke({ color: 0xe0c46f, alpha: style.strokeAlpha, width: 1 });
    button.addChild(box);

    if (options.iconId) {
      const icon = this.drawIcon(button, options.iconId, options.width / 2, options.height / 2, Math.min(options.width, options.height) - 14);
      icon.alpha = options.active ? 0.9 : 1;
    }

    if (options.label) {
      this.drawCenteredText(button, options.label, options.width / 2, options.height / 2, {
        fill: style.textFill,
        fontSize: options.fontSize ?? 13,
        fontWeight: options.fontWeight ?? "900",
      });
    }

    if (!options.disabled) {
      if (options.detail) {
        this.bindAction(button, options.detail);
      } else if (options.onTap) {
        this.bindLocalAction(button, options.onTap);
      }
    }

    if (options.tooltip) {
      this.bindTooltip(button, options.tooltip);
    }

    parent.addChild(button);
    return button;
  }

  private createCircleButton(parent: Container, options: CircleButtonOptions): Container {
    const button = new Container();
    button.x = options.x;
    button.y = options.y;

    const circle = new Graphics();
    circle.circle(0, 0, options.radius)
      .fill({ color: options.active ? 0xe0c46f : 0x2d2f23, alpha: options.active ? 1 : 0.9 })
      .stroke({ color: 0xe0c46f, alpha: options.active ? 0.72 : 0.28, width: 1.5 });
    button.addChild(circle);

    const icon = this.drawIcon(button, options.iconId, 0, 0, options.radius * 1.08);
    icon.alpha = options.active ? 0.92 : 1;
    this.bindAction(button, options.detail);
    this.bindTooltip(button, options.tooltip);
    parent.addChild(button);
    return button;
  }

  private getRectButtonStyle(
    tone: RectButtonTone,
    disabled: boolean,
    active: boolean,
  ): { fill: number; fillAlpha: number; strokeAlpha: number; textFill: number } {
    if (disabled) {
      return {
        fill: 0x34362e,
        fillAlpha: tone === "secondary" ? 0.52 : 0.62,
        strokeAlpha: tone === "secondary" ? 0.16 : 0.22,
        textFill: 0xaeb4b8,
      };
    }

    if (active || tone === "primary") {
      return {
        fill: 0xe0c46f,
        fillAlpha: 1,
        strokeAlpha: tone === "primary" ? 0.54 : 0.6,
        textFill: 0x141719,
      };
    }

    if (tone === "secondary") {
      return {
        fill: 0x262719,
        fillAlpha: 0.92,
        strokeAlpha: 0.36,
        textFill: 0xf1df9a,
      };
    }

    return {
      fill: 0x2d2f23,
      fillAlpha: 0.84,
      strokeAlpha: 0.18,
      textFill: 0xf4eedf,
    };
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
      box.roundRect(0, 0, tabWidth, options.height, 7)
        .fill({ color: active ? 0xe0c46f : 0x151813, alpha: active ? 1 : 0.78 })
        .stroke({ color: 0xe0c46f, alpha: active ? 0.62 : 0.22, width: 1 });
      tabLayer.addChild(box);
      this.drawCenteredText(tabLayer, tab.label, tabWidth / 2, options.height / 2, {
        fill: active ? 0x11140f : 0xd8d2bd,
        fontSize: 12,
        fontWeight: "900",
      });

      if (!active) {
        this.bindLocalAction(tabLayer, () => options.onSelect(tab.id));
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
    cornerRadius = 8,
  ): Graphics {
    const panel = new Graphics();
    if (cornerRadius > 0) {
      panel.roundRect(x, y, width, height, cornerRadius);
    } else {
      panel.rect(x, y, width, height);
    }
    panel
      .fill({ color: 0x10120e, alpha: fillAlpha })
      .stroke({ color: 0xe0c46f, alpha: 0.22, width: 1 });
    parent.addChild(panel);
    return panel;
  }

  private bindAction(target: Container, detail: PixiActionDetail): void {
    target.eventMode = "static";
    target.cursor = "pointer";
    target.on("pointerdown", (event) => {
      event.stopPropagation();
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
    target.on("pointerover", (event) => {
      this.showCanvasTooltip(text, event.global.x, event.global.y);
    });
    target.on("pointermove", (event) => {
      this.showCanvasTooltip(text, event.global.x, event.global.y);
    });
    target.on("pointerout", () => {
      this.hideCanvasTooltip();
    });
  }

  private showCanvasTooltip(text: string, x: number, y: number): void {
    if (!text) {
      this.hideCanvasTooltip();
      return;
    }

    if (this.canvasTooltipText !== text) {
      this.canvasTooltipText = text;
      this.canvasTooltipLabel.text = text;
      this.canvasTooltipWidth = Math.min(320, Math.max(92, this.canvasTooltipLabel.width + 24));
      this.canvasTooltipHeight = Math.max(36, this.canvasTooltipLabel.height + 18);
      this.canvasTooltipPanel.clear();
      this.canvasTooltipPanel.roundRect(0, 0, this.canvasTooltipWidth, this.canvasTooltipHeight, 7)
        .fill({ color: 0x111519, alpha: 0.96 })
        .stroke({ color: 0xe0c46f, alpha: 0.28, width: 1 });
    }

    this.tooltipLayer.visible = true;
    this.positionCanvasTooltip(x, y, this.canvasTooltipWidth, this.canvasTooltipHeight);
  }

  private positionCanvasTooltip(x: number, y: number, width: number, height: number): void {
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

    this.tooltipLayer.x = Math.max(margin, Math.min(stageWidth - width - margin, nextX));
    this.tooltipLayer.y = Math.max(margin, Math.min(stageHeight - height - margin, nextY));
  }

  private hideCanvasTooltip(): void {
    this.tooltipLayer.visible = false;
    this.canvasTooltipText = "";
  }

  private addPalisadeTooltip(
    selected: boolean,
    level: number,
    upgradingRemaining: number,
    name: string,
  ): void {
    const plot = villagePlotDefinitions.find((candidate) => candidate.id === "plot-palisade");

    if (!plot) {
      return;
    }

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
    marker
      .roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 7 * this.layout.scale)
      .stroke({
        color: 0xf6e58d,
        alpha: 0.8,
        width: 2,
      },
    );
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
      .fill({ color: 0x2a090b, alpha: 0.94 })
      .stroke({ color: 0xff5566, alpha: 0.86, width: 2 });
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
      .fill({ color: 0x24494d, alpha: 0.95 })
      .stroke({ color: 0x8ed7cf, alpha: 0.74, width: 1.4 });
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
    shadow.roundRect(2, 3, width, height, 7)
      .fill({ color: 0x000000, alpha: 0.32 });
    badge.addChild(shadow);

    const box = new Graphics();
    box.roundRect(0, 0, width, height, 7)
      .fill({ color: asleep ? 0x1a1d18 : 0x10120e, alpha: 0.94 })
      .stroke({
        color: asleep ? 0x889089 : 0xe0c46f,
        alpha: asleep ? 0.32 : 0.44,
        width: 1,
      });
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
    shadow.roundRect(-width / 2 + 2, 3, width, height, 7)
      .fill({ color: 0x000000, alpha: 0.34 });
    badge.addChild(shadow);

    const box = new Graphics();
    box.roundRect(-width / 2, 0, width, height, 7)
      .fill({ color: 0x10120e, alpha: 0.94 })
      .stroke({ color: 0xe0c46f, alpha: 0.46, width: 1 });
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
      const texture = this.resolveAnimationTexture(animationFrames, performance.now());
      if (texture) {
        return new Sprite(texture);
      }
    }

    return new Sprite(this.assets.getBuildingTexture(buildingId, level, built));
  }

  private createTerrainSprite(textureKey: string): Sprite | null {
    const animationFrames = this.assets.getTerrainTileAnimationFrames(textureKey);

    if (animationFrames) {
      const sprite = new Sprite();
      this.registerTextureAnimation(sprite, animationFrames);
      return sprite;
    }

    const texture = this.assets.getTerrainTileTexture(textureKey);
    return texture ? new Sprite(texture) : null;
  }

  private registerTextureAnimation(
    sprite: Sprite,
    animationFrames: FrameObject[],
  ): void {
    const frames = animationFrames.flatMap((frame): TextureAnimationFrame[] => {
      const durationMs = typeof frame.time === "number" ? frame.time : 100;
      return durationMs > 0
        ? [{ texture: frame.texture, durationMs }]
        : [];
    });

    if (frames.length <= 1) {
      if (frames[0]) {
        sprite.texture = frames[0].texture;
      }
      return;
    }

    const totalDurationMs = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
    if (totalDurationMs <= 0) {
      sprite.texture = frames[0].texture;
      return;
    }

    const binding: TextureAnimationBinding = {
      sprite,
      frames,
      totalDurationMs,
      currentFrameIndex: -1,
    };

    this.textureAnimationBindings.add(binding);
    this.applyTextureAnimationFrame(binding, performance.now());
    this.updateAmbientAnimationLoop();
  }

  private resolveAnimationTexture(
    animationFrames: FrameObject[],
    nowMs: number,
  ): FrameObject["texture"] | null {
    const frames = animationFrames.flatMap((frame): TextureAnimationFrame[] => {
      const durationMs = typeof frame.time === "number" ? frame.time : 100;
      return durationMs > 0
        ? [{ texture: frame.texture, durationMs }]
        : [];
    });

    if (frames.length === 0) {
      return null;
    }

    if (frames.length === 1) {
      return frames[0].texture;
    }

    const totalDurationMs = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
    if (totalDurationMs <= 0) {
      return frames[0].texture;
    }

    const frameIndex = this.getTextureAnimationFrameIndex(
      frames,
      totalDurationMs,
      nowMs,
    );
    return frames[frameIndex]?.texture ?? frames[0].texture;
  }

  private refreshTextureAnimations(nowMs: number): void {
    if (this.textureAnimationBindings.size === 0) {
      return;
    }

    if (
      this.lastTextureAnimationFrameAtMs > 0 &&
      nowMs - this.lastTextureAnimationFrameAtMs < TEXTURE_ANIMATION_FRAME_MIN_MS
    ) {
      return;
    }
    this.lastTextureAnimationFrameAtMs = nowMs;

    for (const binding of Array.from(this.textureAnimationBindings)) {
      if (binding.sprite.destroyed || !binding.sprite.parent) {
        this.textureAnimationBindings.delete(binding);
        continue;
      }

      this.applyTextureAnimationFrame(binding, nowMs);
    }
  }

  private applyTextureAnimationFrame(binding: TextureAnimationBinding, nowMs: number): void {
    const frameIndex = this.getTextureAnimationFrameIndex(
      binding.frames,
      binding.totalDurationMs,
      nowMs,
    );

    if (frameIndex === binding.currentFrameIndex) {
      return;
    }

    binding.currentFrameIndex = frameIndex;
    binding.sprite.texture = binding.frames[frameIndex].texture;
  }

  private getTextureAnimationFrameIndex(
    frames: TextureAnimationFrame[],
    totalDurationMs: number,
    nowMs: number,
  ): number {
    const loopPositionMs = nowMs % totalDurationMs;
    let elapsed = 0;

    for (let index = 0; index < frames.length; index += 1) {
      elapsed += frames[index].durationMs;
      if (loopPositionMs < elapsed) {
        return index;
      }
    }

    return frames.length - 1;
  }

  private unregisterTextureAnimationsForNode(node: Container): void {
    for (const binding of Array.from(this.textureAnimationBindings)) {
      if (binding.sprite === node) {
        this.textureAnimationBindings.delete(binding);
      }
    }

    for (const child of node.children) {
      this.unregisterTextureAnimationsForNode(child as Container);
    }
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
    },
  ): Text {
    const label = this.drawText(parent, text, x, y, options);
    label.anchor.set(0.5);
    return label;
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
    },
  ): Text {
    const label = new Text({
      text,
      style: {
        fill: options.fill,
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: options.fontSize,
        fontWeight: options.fontWeight ?? "700",
        align: options.align,
        wordWrap: options.wordWrap,
        wordWrapWidth: options.wordWrapWidth,
      },
    });
    label.alpha = options.alpha ?? 1;
    label.x = x;
    label.y = y;
    parent.addChild(label);
    return label;
  }

  private applyHudPixelScale(container: Container, scale: number): void {
    if (scale === 1) {
      return;
    }

    for (const child of container.children) {
      child.x *= scale;
      child.y *= scale;
      this.scaleHitArea(child, scale);

      if (child instanceof Text) {
        const fontSize = this.scaleTextStyleValue(child.style.fontSize, scale);
        const lineHeight = this.scaleTextStyleValue(child.style.lineHeight, scale);
        const wordWrapWidth = this.scaleTextStyleValue(child.style.wordWrapWidth, scale);

        if (fontSize !== undefined) {
          child.style.fontSize = fontSize;
        }
        if (lineHeight !== undefined) {
          child.style.lineHeight = lineHeight;
        }
        if (wordWrapWidth !== undefined) {
          child.style.wordWrapWidth = wordWrapWidth;
        }
        child.resolution = window.devicePixelRatio || 1;
        continue;
      }

      if (child instanceof Graphics || child instanceof Sprite) {
        child.scale.x *= scale;
        child.scale.y *= scale;
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

    bounds.x *= scale;
    bounds.y *= scale;
    bounds.width *= scale;
    bounds.height *= scale;
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
      target.hitArea.x *= scale;
      target.hitArea.y *= scale;
      target.hitArea.width *= scale;
      target.hitArea.height *= scale;
    }
  }

  private scaleTextStyleValue(value: number | string | undefined, scale: number): number | undefined {
    if (typeof value !== "number") {
      return undefined;
    }

    return Math.round(value * scale * 100) / 100;
  }

  private getLogicalWheelDelta(event: WheelEvent): number {
    return event.deltaY / this.hudPixelScale;
  }

  private shouldAnimateCamera(): boolean {
    return (
      Math.abs(this.cameraTargetZoom - this.cameraZoom) > CAMERA_ZOOM_SNAP_EPSILON ||
      Math.abs(this.cameraTargetOffsetX - this.cameraOffsetX) > CAMERA_OFFSET_SNAP_EPSILON ||
      Math.abs(this.cameraTargetOffsetY - this.cameraOffsetY) > CAMERA_OFFSET_SNAP_EPSILON
    );
  }

  private refreshCameraTransform(): void {
    const viewportWidth = this.host.clientWidth;
    const viewportHeight = this.host.clientHeight;

    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    if (!this.shouldAnimateCamera()) {
      return;
    }

    this.cameraZoom += (this.cameraTargetZoom - this.cameraZoom) * CAMERA_SMOOTH_FACTOR;
    this.cameraOffsetX += (this.cameraTargetOffsetX - this.cameraOffsetX) * CAMERA_SMOOTH_FACTOR;
    this.cameraOffsetY += (this.cameraTargetOffsetY - this.cameraOffsetY) * CAMERA_SMOOTH_FACTOR;
    this.clampCurrentCamera(viewportWidth, viewportHeight);

    if (
      Math.abs(this.cameraTargetZoom - this.cameraZoom) <= CAMERA_ZOOM_SNAP_EPSILON &&
      Math.abs(this.cameraTargetOffsetX - this.cameraOffsetX) <= CAMERA_OFFSET_SNAP_EPSILON &&
      Math.abs(this.cameraTargetOffsetY - this.cameraOffsetY) <= CAMERA_OFFSET_SNAP_EPSILON
    ) {
      this.cameraZoom = this.cameraTargetZoom;
      this.cameraOffsetX = this.cameraTargetOffsetX;
      this.cameraOffsetY = this.cameraTargetOffsetY;
      this.clampCurrentCamera(viewportWidth, viewportHeight);
    }

    this.applyCameraTransform();
  }

  private clampCurrentCamera(viewportWidth: number, viewportHeight: number): void {
    const clamped = this.clampCamera(
      this.cameraZoom,
      this.cameraOffsetX,
      this.cameraOffsetY,
      viewportWidth,
      viewportHeight,
    );
    this.cameraZoom = clamped.zoom;
    this.cameraOffsetX = clamped.offsetX;
    this.cameraOffsetY = clamped.offsetY;
  }

  private clampTargetCamera(viewportWidth: number, viewportHeight: number): void {
    const clamped = this.clampCamera(
      this.cameraTargetZoom,
      this.cameraTargetOffsetX,
      this.cameraTargetOffsetY,
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

  private clampCamera(
    zoom: number,
    offsetX: number,
    offsetY: number,
    viewportWidth: number,
    viewportHeight: number,
  ): { zoom: number; offsetX: number; offsetY: number } {
    const scale = this.layout.scale;
    const terrainWidth = defaultVillageLayout.width * scale;
    const terrainHeight = defaultVillageLayout.height * scale;
    const originX = this.layout.originX + this.layout.width / 2 - terrainWidth / 2;
    const originY = this.layout.originY + this.layout.height / 2 - terrainHeight / 2;
    const clampedZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, zoom));
    const scaledTerrainWidth = terrainWidth * clampedZoom;
    const scaledTerrainHeight = terrainHeight * clampedZoom;
    let clampedOffsetX = offsetX;
    let clampedOffsetY = offsetY;

    if (scaledTerrainWidth <= viewportWidth) {
      clampedOffsetX = (viewportWidth - scaledTerrainWidth) / 2 - originX * clampedZoom;
    } else {
      const minX = viewportWidth - (originX + terrainWidth) * clampedZoom;
      const maxX = -originX * clampedZoom;
      clampedOffsetX = Math.max(minX, Math.min(maxX, clampedOffsetX));
    }

    if (scaledTerrainHeight <= viewportHeight) {
      clampedOffsetY = (viewportHeight - scaledTerrainHeight) / 2 - originY * clampedZoom;
    } else {
      const minY = viewportHeight - (originY + terrainHeight) * clampedZoom;
      const maxY = -originY * clampedZoom;
      clampedOffsetY = Math.max(minY, Math.min(maxY, clampedOffsetY));
    }

    return {
      zoom: clampedZoom,
      offsetX: clampedOffsetX,
      offsetY: clampedOffsetY,
    };
  }

  private getLayout(width: number, height: number): SceneLayout {
    const scale = Math.min(width / 1420, height / 880);
    const villageWidth = 1120 * scale;
    const villageHeight = 680 * scale;

    return {
      originX: (width - villageWidth) / 2,
      originY: Math.max(76, (height - villageHeight) / 2),
      width: villageWidth,
      height: villageHeight,
      scale,
    };
  }

  private getHudPixelScale(width: number, height: number): number {
    return Math.min(HUD_MAX_PIXEL_SCALE, Math.max(1, Math.min(width / 1120, height / 640)));
  }

  private getStaticWorldKey(state: GameState): string {
    return [
      state.environment.condition,
      this.layout.scale.toFixed(4),
      this.layout.originX.toFixed(2),
      this.layout.originY.toFixed(2),
    ].join("|");
  }

  private seededUnit(seed: number): number {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  private getPlotBounds(plot: VillagePlotDefinition): Bounds {
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

  private formatRate(value: number): string {
    if (Math.abs(value) >= 10) {
      return value.toFixed(0);
    }

    return value.toFixed(1);
  }

  private formatPercentBonus(value: number): string {
    return `+${Math.round(value * 100)}%`;
  }

  private formatTemplate(
    template: string,
    params: Record<string, string | number>,
  ): string {
    return Object.entries(params).reduce(
      (message, [key, value]) => message.split(`{${key}}`).join(String(value)),
      template,
    );
  }

  private formatScoutingRemaining(seconds: number): string {
    const gameHours = seconds / GAME_HOUR_REAL_SECONDS;

    if (gameHours >= 1) {
      return `${Math.ceil(gameHours)}h`;
    }

    return `${Math.max(1, Math.ceil(gameHours * 60))}m`;
  }

  private getHourlyRateLabel(ratePerSecond: number): string {
    const hourlyRate = ratePerSecond * GAME_HOUR_REAL_SECONDS;

    if (Math.abs(hourlyRate) < 0.05) {
      return "0/h";
    }

    return `${hourlyRate > 0 ? "+" : ""}${this.formatRate(hourlyRate)}/h`;
  }

  private getRateColor(ratePerSecond: number): number {
    const hourlyRate = ratePerSecond * GAME_HOUR_REAL_SECONDS;

    if (hourlyRate > 0.05) {
      return 0x8fe0b8;
    }

    if (hourlyRate < -0.05) {
      return 0xff9aa2;
    }

    return 0xaeb4b8;
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
  ): string[] {
    if (
      this.lastFormattedLogSource === state.log &&
      this.lastFormattedLogTranslations === translations
    ) {
      return this.lastFormattedLogEntries;
    }

    const entries = translations
      ? state.log.map((entry) => formatLogEntry(entry, translations))
      : state.log.map((entry) => entry.key);
    this.lastFormattedLogSource = state.log;
    this.lastFormattedLogTranslations = translations;
    this.lastFormattedLogEntries = entries;
    return entries;
  }
}
