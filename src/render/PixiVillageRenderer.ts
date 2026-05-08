import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Text,
  Sprite,
  Texture,
  type TextStyleFontWeight,
} from "pixi.js";
import { resourceDefinitions } from "../data/resources";
import { buildingById, buildingDefinitions } from "../data/buildings";
import { buildingVisualDefinitions, getBuildingVisualFrame } from "../data/buildingVisuals";
import { villagePlotDefinitions, type VillagePlotDefinition } from "../data/villagePlots";
import { formatGameClock, GAME_HOUR_REAL_SECONDS, getGameDay } from "../game/time";
import type { BuildingCategory, BuildingId, GameSpeed, GameState, ResourceBag, ResourceId, ScoutingMode } from "../game/types";
import type { TranslationPack } from "../i18n/types";
import {
  getAvailableBuildingsForPlot,
  getActiveBuildingQueue,
  getBuildingBuildSeconds,
  getBuildingWorkerLimit,
  getConstructionWorkerRequirement,
  getGeneratorEnergyRate,
  getHousingStatus,
  getResourceBreakdown,
  getResourceProductionRates,
  getUpgradeCost,
  hasAvailableBuildingSlot,
  isBuildingInactiveDueToEnergy,
  MAX_ACTIVE_BUILDINGS,
  type ResourceBreakdownLine,
} from "../systems/buildings";
import { getClinicFoodPerTreatment } from "../systems/health";
import {
  getAssignedBuildingWorkerCount,
  getConstructionWorkerCount,
  getPopulation,
} from "../systems/population";
import { canAfford } from "../systems/resources";
import { SCOUTING_CARRY_PER_TROOP, SCOUTING_DURATION_SECONDS, getScoutingTroopCount } from "../systems/scouting";
import villageBackgroundUrl from "../assets/village-bg.webp";
import { drawBuildingAsset } from "./buildingAssets";
import { drawPixiIcon } from "./pixiIcons";

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

export type PixiActionDetail = {
  action?: string;
  building?: BuildingId;
  plot?: string;
  delta?: number;
  troopCount?: number;
  scoutMode?: ScoutingMode;
  scoutTroops?: number;
  resourceId?: ResourceId;
  speed?: GameSpeed;
  continuousShifts?: boolean;
};

export type VillageInfoPanel = ResourceId | "survivors";

type EffectLine = {
  iconId: string;
  value: string;
  tooltip: string;
  negative?: boolean;
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

type MainBuildingEffect = {
  phase: number;
  bounds: Bounds;
  base: Graphics;
  lights: Graphics;
  smoke: Graphics;
};

type PalisadeGeometry = {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
};

const resourceColors: Record<ResourceId, number> = {
  food: 0xd8b66a,
  water: 0x66bde8,
  material: 0xc7c9bd,
  energy: 0xf0ce55,
  morale: 0xe9a0a0,
};

const VILLAGE_BUILDING_RENDER_SCALE = 1.3;
const buildCategoryOrder: BuildingCategory[] = ["resource", "housing", "defense", "support"];

const buildingTextureCache = new Map<string, Texture>();

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

export class PixiVillageRenderer {
  private app: Application | null = null;
  private readonly rootLayer = new Container();
  private readonly worldLayer = new Container();
  private readonly hudLayer = new Container();
  private readonly tooltipLayer = new Container();
  private readonly buildingSpritesheets = new Map<BuildingId, Texture>();
  private backgroundTexture: Texture | null = null;
  private mainBuildingEffects: MainBuildingEffect[] = [];
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
  private activeBuildCategory: BuildingCategory = "resource";
  private activeBarracksTab: BarracksTab = "training";
  private barracksTroopCount = 1;
  private readonly handleWheel = (event: WheelEvent) => this.handleHostWheel(event);
  private readonly handleMouseLeave = () => this.hideCanvasTooltip();

  constructor(
    private readonly host: HTMLElement,
    private readonly requestRender: () => void = () => {},
  ) {
    this.tooltipLayer.eventMode = "none";
    this.rootLayer.addChild(this.worldLayer, this.hudLayer, this.tooltipLayer);
    this.host.addEventListener("wheel", this.handleWheel, { passive: false });
    this.host.addEventListener("mouseleave", this.handleMouseLeave);
    void this.initialize();
  }

  render(
    state: GameState,
    translations?: TranslationPack,
    modalPlotId?: string | null,
    infoPanel?: VillageInfoPanel | null,
  ): void {
    this.lastState = state;
    this.lastTranslations = translations;

    if (!this.app) {
      return;
    }

    const width = this.host.clientWidth;
    const height = this.host.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    this.layout = this.getLayout(width, height);
    const hudScale = this.getHudScale(width, height);
    const hudWidth = width / hudScale;
    const hudHeight = height / hudScale;
    const visualTime = performance.now() / 1000;
    this.mainBuildingEffects = [];
    this.worldLayer.removeChildren();
    this.hudLayer.removeChildren();
    this.buildChoicesScrollArea = null;
    this.buildChoicesScrollMax = 0;
    this.hudLayer.scale.set(hudScale);
    this.drawBackground(width, height);
    this.drawPalisade(state, translations?.buildings);

    for (const plot of villagePlotDefinitions.filter((candidate) => candidate.kind !== "perimeter")) {
      this.drawPlot(plot, state, translations, visualTime);
    }

    this.drawGate(state);
    this.drawHud(state, translations, hudWidth, hudHeight);
    this.drawVillageModal(state, translations, hudWidth, hudHeight, modalPlotId ?? null);
    this.drawInfoPanel(state, translations, hudWidth, hudHeight, infoPanel ?? null);
  }

  hitTest(clientX: number, clientY: number): string | null {
    const rect = this.host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

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
    if (!this.buildChoicesScrollArea || this.buildChoicesScrollMax <= 0) {
      return;
    }

    const rect = this.host.getBoundingClientRect();
    const hudScale = this.hudLayer.scale.x || 1;
    const x = (event.clientX - rect.left) / hudScale;
    const y = (event.clientY - rect.top) / hudScale;
    const area = this.buildChoicesScrollArea;

    if (
      x < area.x ||
      x > area.x + area.width ||
      y < area.y ||
      y > area.y + area.height
    ) {
      return;
    }

    event.preventDefault();
    const nextScroll = Math.max(
      0,
      Math.min(this.buildChoicesScrollMax, this.buildChoicesScrollY + event.deltaY),
    );

    if (nextScroll === this.buildChoicesScrollY) {
      return;
    }

    this.buildChoicesScrollY = nextScroll;
    this.requestRender();
  }

  destroy(): void {
    this.host.removeEventListener("wheel", this.handleWheel);
    this.host.removeEventListener("mouseleave", this.handleMouseLeave);
    this.app?.destroy(true);
    this.app = null;
  }

  private async initialize(): Promise<void> {
    const app = new Application();
    await app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    app.canvas.classList.add("pixi-canvas");
    this.host.append(app.canvas);
    app.stage.addChild(this.rootLayer);
    app.ticker.add(() => this.updateMainBuildingEffects());
    this.app = app;

    const [backgroundTexture] = await Promise.all([
      Assets.load<Texture>(villageBackgroundUrl),
      this.loadBuildingSpritesheets(),
    ]);
    this.backgroundTexture = backgroundTexture;
    this.requestRender();
  }

  private async loadBuildingSpritesheets(): Promise<void> {
    await Promise.all(
      Object.entries(buildingVisualDefinitions).map(async ([buildingId, visual]) => {
        if (!visual) {
          return;
        }

        const texture = await Assets.load<Texture>(visual.spritesheetUrl);
        this.buildingSpritesheets.set(buildingId as BuildingId, texture);
      }),
    );
  }

  private drawBackground(width: number, height: number): void {
    if (this.backgroundTexture) {
      const sprite = new Sprite(this.backgroundTexture);
      const scale = Math.max(width / sprite.texture.width, height / sprite.texture.height);
      sprite.width = sprite.texture.width * scale;
      sprite.height = sprite.texture.height * scale;
      sprite.x = (width - sprite.width) / 2;
      sprite.y = (height - sprite.height) / 2;
      this.worldLayer.addChild(sprite);
    }

    const overlay = new Graphics();
    overlay.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.08 });
    this.worldLayer.addChild(overlay);
  }

  private drawPalisade(
    state: GameState,
    buildingLabels?: TranslationPack["buildings"],
  ): void {
    const { scale } = this.layout;
    const plot = state.village.plots.find((candidate) => candidate.id === "plot-palisade");
    const building = plot?.buildingId ? state.buildings[plot.buildingId] : null;
    const hasStarted = plot?.buildingId === "palisade";
    const built = (building?.level ?? 0) > 0;
    const selected = state.village.selectedPlotId === "plot-palisade";
    const { centerX, centerY, radiusX, radiusY } = this.getPalisadeGeometry();
    const alpha = built ? 1 : hasStarted ? 0.58 : 0.25;

    const palisade = new Graphics();
    palisade
      .ellipse(centerX, centerY, radiusX * 0.93, radiusY * 0.9)
      .fill({ color: 0x4f4a2d, alpha: 0.26 });
    palisade
      .ellipse(centerX, centerY, radiusX, radiusY)
      .stroke({ color: 0x2c2119, alpha, width: 18 + (building?.level ?? 0) * 1.2 });
    palisade
      .ellipse(centerX, centerY, radiusX, radiusY)
      .stroke({ color: 0x8f6842, alpha, width: 7 + (building?.level ?? 0) * 0.7 });
    this.worldLayer.addChild(palisade);

    const posts = new Container();
    for (let index = 0; index < 76; index += 1) {
      const angle = (Math.PI * 2 * index) / 76 - Math.PI / 2;
      const post = new Graphics();
      post.rect(-2.5 * scale, -14 * scale, 5 * scale, 28 * scale).fill({ color: 0xa77a4d, alpha });
      post.x = centerX + Math.cos(angle) * radiusX;
      post.y = centerY + Math.sin(angle) * radiusY;
      post.rotation = angle + Math.PI / 2;
      posts.addChild(post);
    }
    this.worldLayer.addChild(posts);

    this.addPalisadeTooltip(
      selected,
      building?.level ?? 0,
      building?.upgradingRemaining ?? 0,
      buildingLabels?.palisade.name ?? "Palisade",
    );
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
    this.worldLayer.addChild(plotLayer);

    if (buildingId && building) {
      const tooltip = upgradingTooltip(
        name,
        building.level,
        building.upgradingRemaining,
        translations?.ui.level ?? "Lvl",
      );
      this.bindTooltip(plotLayer, tooltip);

      const shadow = new Graphics();
      shadow
        .ellipse(0, bounds.height * 0.36, bounds.width * 0.58, bounds.height * 0.33)
        .fill({ color: 0x000000, alpha: 0.36 });
      plotLayer.addChild(shadow);

      const asset = new Sprite(this.getBuildingTexture(buildingId, Math.max(1, building.level), building.level > 0));
      asset.anchor.set(0.5);
      this.fitSprite(
        asset,
        bounds.width * VILLAGE_BUILDING_RENDER_SCALE,
        bounds.height * VILLAGE_BUILDING_RENDER_SCALE,
      );
      asset.alpha = building.level > 0 || isMainPlot ? 1 : 0.62;
      plotLayer.addChild(asset);
      this.drawBuildingVisualEffects(plotLayer, buildingId, Math.max(1, building.level), bounds, visualTime);
      if (isBuildingInactiveDueToEnergy(state, buildingId)) {
        this.drawPowerWarning(plotLayer, bounds);
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

  private drawGate(state: GameState): void {
    const plot = state.village.plots.find((candidate) => candidate.id === "plot-palisade");
    const building = plot?.buildingId ? state.buildings[plot.buildingId] : null;
    const alpha = (building?.level ?? 0) > 0 ? 1 : plot?.buildingId ? 0.58 : 0.3;
    const { centerX, centerY, radiusY } = this.getPalisadeGeometry();
    const gateX = centerX;
    const gateY = centerY + radiusY;
    const gate = new Graphics();

    gate.rect(gateX - 42, gateY - 56, 84, 70).fill({ color: 0x4d3629, alpha });
    gate.rect(gateX - 24, gateY - 38, 48, 52).fill({ color: 0x161916, alpha });
    gate.rect(gateX - 52, gateY - 64, 104, 12).fill({ color: 0xb0834d, alpha });
    this.worldLayer.addChild(gate);
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

    this.drawBrand(state.communityName, `${t?.ui.day ?? "Day"} ${day} / ${clock}`);
    this.drawTopPills(
      [
        { iconId: "clock", label: `${t?.ui.day ?? "Day"} ${day} / ${clock}`, tooltip: t?.ui.dayTooltip },
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
    );
    this.drawResourcePills(state, translations, width, rates);
    this.drawActiveScouting(state, translations, width);
    this.drawEventLog(state, translations, height);
    this.drawQueue(state, translations, height);
    this.drawActionPanel(state, translations, width, height);
    this.drawToolbar(state, translations, width, height);
  }

  private drawBrand(title: string, subtitle: string): void {
    const layer = new Container();
    layer.x = 28;
    layer.y = 22;
    this.hudLayer.addChild(layer);

    const mark = new Graphics();
    mark.roundRect(0, 0, 52, 52, 8).fill({ color: 0x141611, alpha: 0.76 }).stroke({ color: 0xe0c46f, alpha: 0.5, width: 2 });
    layer.addChild(mark);
    this.drawIcon(layer, "shield", 26, 26, 28);
    this.drawText(layer, title.toUpperCase(), 64, 4, {
      fill: 0xf5efdf,
      fontSize: 33,
      fontWeight: "900",
    });
    this.drawText(layer, subtitle, 64, 40, {
      fill: 0xd8c890,
      fontSize: 12,
      fontWeight: "700",
    });
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
  ): void {
    const group = new Container();
    group.y = 30;
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
      );
      pill.x = x;
      group.addChild(pill);
      x += pill.width + 8;
    }

    group.x = Math.max(390, (width - x) / 2);
  }

  private drawResourcePills(
    state: GameState,
    translations: TranslationPack | undefined,
    width: number,
    rates: Record<ResourceId, number>,
  ): void {
    const group = new Container();
    group.y = 18;
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
      );
      pill.x = x;
      group.addChild(pill);
      x += pill.width + 8;
    }

    group.x = Math.max(28, width - x - 28);
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
    backdrop.rect(0, 0, width, height).fill({ color: 0x030405, alpha: 0.52 });
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

    this.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1);
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
      { iconId: "morale", value: `${state.health.injured}`, label: translations.roles.injured, tooltip: translations.roles.injured, missing: state.health.injured > 0 },
      {
        iconId: "home",
        value: `${housing.housed}/${housing.civilianCapacity + this.getTroopHousingCapacity(state)}`,
        label: translations.ui.housed,
        tooltip: translations.ui.housingTooltip,
      },
      {
        iconId: "home",
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

  private drawActiveScouting(
    state: GameState,
    translations: TranslationPack | undefined,
    width: number,
  ): void {
    const panelWidth = 308;
    const layer = new Container();
    layer.x = Math.max(28, width - panelWidth - 28);
    layer.y = 152;
    this.hudLayer.addChild(layer);

    const missions = state.scouting.missions.slice(0, 4);
    const panelHeight = missions.length > 0 ? 52 + missions.length * 24 : 82;

    this.drawPanel(layer, 0, 0, panelWidth, panelHeight);
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
      return;
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

    row.hitArea = {
      contains: (x: number, y: number) => x >= 0 && x <= options.width && y >= -2 && y <= 21,
    };
    this.bindTooltip(row, options.tooltip);
  }

  private drawQueue(state: GameState, translations: TranslationPack | undefined, height: number): void {
    const queue = getActiveBuildingQueue(state);
    const layer = new Container();
    layer.x = 28;
    layer.y = height - 104;
    this.hudLayer.addChild(layer);
    this.drawPanel(layer, 0, 0, 308, 78);
    this.drawIcon(layer, "build", 18, 22, 14);
    this.drawText(layer, translations?.ui.buildingQueue ?? "Building queue", 34, 14, { fill: 0xf5efdf, fontSize: 12, fontWeight: "800" });
    this.drawText(layer, `${queue.length}/${MAX_ACTIVE_BUILDINGS}`, 280, 14, { fill: 0xf1df9a, fontSize: 13, fontWeight: "800" }).anchor.set(1, 0);

    if (queue.length === 0) {
      this.drawText(layer, translations?.ui.queueEmpty ?? "No active construction.", 14, 44, { fill: 0xaeb4b8, fontSize: 12, fontWeight: "700" });
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
  }

  private drawEventLog(state: GameState, translations: TranslationPack | undefined, height: number): void {
    const layer = new Container();
    layer.x = 28;
    layer.y = Math.max(282, height - 242);
    this.hudLayer.addChild(layer);

    const width = 308;
    const panelHeight = 128;
    this.drawPanel(layer, 0, 0, width, panelHeight);
    this.drawIcon(layer, "clock", 18, 22, 14);
    this.drawText(layer, translations?.ui.log ?? "Log", 34, 14, {
      fill: 0xf5efdf,
      fontSize: 12,
      fontWeight: "800",
    });

    const entries = state.log.slice(0, 4);

    if (entries.length === 0) {
      this.drawText(layer, "-", 14, 44, {
        fill: 0xaeb4b8,
        fontSize: 11,
        fontWeight: "700",
      });
      return;
    }

    entries.forEach((entry, index) => {
      this.drawText(layer, entry, 14, 42 + index * 20, {
        fill: index === 0 ? 0xf1df9a : 0xc8cabb,
        fontSize: 10,
        fontWeight: index === 0 ? "800" : "700",
        wordWrap: true,
        wordWrapWidth: width - 28,
      });
    });
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
  }

  private drawActionPanel(
    state: GameState,
    translations: TranslationPack | undefined,
    width: number,
    height: number,
  ): void {
    const panelWidth = 92;
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
      "fist",
      panelWidth / 2,
      40,
      27,
      { action: "set-continuous-shifts", continuousShifts: !continuousShifts },
      tooltip,
      continuousShifts,
    );
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
    backdrop.rect(0, 0, width, height).fill({ color: 0x030405, alpha: 0.52 });
    overlay.addChild(backdrop);
    this.bindAction(backdrop, { action: "close-village-modal" });

    const panelWidth = Math.min(520, width - 48);
    const panelHeight = 340;
    const panel = new Container();
    panel.x = (width - panelWidth) / 2;
    panel.y = Math.max(36, (height - panelHeight) / 2);
    panel.eventMode = "static";
    overlay.addChild(panel);
    this.drawPanel(panel, 0, 0, panelWidth, panelHeight, 1);
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

    if (breakdown.length === 0) {
      this.drawText(panel, translations.ui.resourceNoActiveEffects, 24, 148, {
        fill: 0xc8cabb,
        fontSize: 13,
        fontWeight: "700",
      });
      return;
    }

    breakdown.forEach((line, index) => {
      this.drawBreakdownRow(
        panel,
        this.getResourceBreakdownLabel(line, translations),
        this.getHourlyRateLabel(line.ratePerSecond),
        line.ratePerSecond,
        panelWidth,
        148 + index * 34,
      );
    });
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
    if ((line.source === "building" || line.source === "generator") && line.buildingId) {
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

    return translations.ui.moraleWaterShortage;
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
    backdrop.rect(0, 0, width, height).fill({ color: 0x030405, alpha: 0.62 });
    overlay.addChild(backdrop);
    this.bindAction(backdrop, { action: "close-village-modal" });

    const isBuildChoice = selectedPlot.buildingId === null;
    const detailBuildingId = selectedPlot.buildingId;
    const modalWidth = isBuildChoice ? Math.min(1100, width - 48) : Math.min(860, width - 40);
    const modalHeight = isBuildChoice
      ? Math.min(840, height - 48)
      : Math.min(detailBuildingId === "barracks" ? 590 : 510, height - 40);
    const panel = new Container();
    panel.x = (width - modalWidth) / 2;
    panel.y = (height - modalHeight) / 2;
    panel.eventMode = "static";
    overlay.addChild(panel);
    this.drawPanel(panel, 0, 0, modalWidth, modalHeight, 1);

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
    badgeBox.roundRect(0, 0, 42, 42, 8)
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
    const rowHeight = modalHeight < 620 ? 80 : 88;
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
      const disabled = !affordable || !queueAvailable || !workersAvailable;
      const buttonLabel = !queueAvailable
        ? translations.ui.queueFull
        : !workersAvailable
          ? translations.ui.notEnoughWorkers
          : translations.ui.buildHere;

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
        buttonLabel,
        disabled,
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

    const asset = new Sprite(this.getBuildingTexture(options.buildingId, options.level, options.built));
    asset.anchor.set(0.5);
    asset.x = 72;
    asset.y = options.height / 2;
    this.fitSprite(asset, Math.min(104, options.height * 1.42), Math.min(78, options.height * 0.96));
    row.addChild(asset);

    const textX = 150;
    const buttonWidth = 124;
    const buttonHeight = 34;
    const buttonX = options.width - buttonWidth - 28;
    const textWidth = Math.max(220, buttonX - textX - 24);
    const compact = options.height < 66;
    const tokenY = options.height - 22;

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

    let tokenOffset = 0;
    tokenOffset += this.drawCostLine(row, options.cost, options.state.resources, options.translations, textX, tokenY);
    tokenOffset += tokenOffset > 0 ? 12 : 0;
    tokenOffset += this.drawEffects(row, options.effects, textX + tokenOffset, tokenY, buttonX - textX - tokenOffset - 18);
    if (options.requiredWorkers > 0) {
      this.drawWorkerRequirement(
        row,
        options.requiredWorkers,
        options.state.survivors.workers,
        options.translations,
        Math.min(textX + tokenOffset + 12, buttonX - 64),
        tokenY,
      );
    }
    this.createModalButton(
      row,
      options.disabled ? options.buttonLabel : options.buttonLabel.toUpperCase(),
      buttonX,
      (options.height - buttonHeight) / 2,
      buttonWidth,
      buttonHeight,
      options.action,
      options.disabled,
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
    const disabled = locked || upgrading || !affordable || !queueAvailable || !workersAvailable;

    const content = new Container();
    parent.addChild(content);

    const sideMargin = 28;
    const contentTop = 34;
    const previewWidth = 136;
    const titleX = sideMargin + previewWidth + 22;
    const titleWidth = modalWidth - titleX - sideMargin;
    const bodyWidth = modalWidth - sideMargin * 2;

    const asset = new Sprite(this.getBuildingTexture(buildingId, Math.max(1, level), level > 0));
    asset.anchor.set(0.5);
    asset.x = sideMargin + 54;
    asset.y = contentTop + 50;
    this.fitSprite(asset, 96, 72);
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
    if (buildingId === "generator") {
      this.drawGeneratorControls(content, buildingId, state, translations, sideMargin, operationsY, bodyWidth);
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

    warnings.forEach((warning, index) => {
      this.drawText(content, warning, sideMargin + 28, footerY + 86 + index * 16, { fill: 0xff9aa2, fontSize: 11, fontWeight: "800" });
    });

    const buttonLabel = upgrading
      ? `${Math.ceil(upgradingRemaining)}s`
      : locked
        ? `${level}/${maxLevel}`
        : queueAvailable
          ? translations.ui.upgrade
          : translations.ui.queueFull;
    this.createModalButton(content, buttonLabel, modalWidth - 258, footerY + 24, 210, 44, { action: "upgrade", building: buildingId }, disabled);
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
      this.getBuildingProductionMetric(buildingId, building, level, translations),
      this.getBuildingEnergyMetric(buildingId, building, level, translations),
    ];
  }

  private getBuildingProductionMetric(
    buildingId: BuildingId,
    building: GameState["buildings"][BuildingId],
    level: number,
    translations: TranslationPack,
  ): BuildingMetric {
    const definition = buildingById[buildingId];

    if (buildingId === "generator") {
      const rate = getGeneratorEnergyRate(level, building.workers);
      return {
        iconId: "energy",
        label: translations.ui.production,
        value: this.getHourlyRateLabel(rate),
        fill: this.getRateColor(rate),
        tooltip: `${translations.resources.energy}: ${this.getHourlyRateLabel(rate)}`,
      };
    }

    const produced = Object.entries(definition.produces ?? {})
      .find(([, amount]) => (amount ?? 0) > 0);

    if (produced) {
      const [resourceId, amount] = produced;
      const typedResourceId = resourceId as ResourceId;
      const rate = (amount ?? 0) * level;
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

  private getBuildingEnergyMetric(
    buildingId: BuildingId,
    building: GameState["buildings"][BuildingId],
    level: number,
    translations: TranslationPack,
  ): BuildingMetric {
    const definition = buildingById[buildingId];
    const consumption =
      ((definition.consumes?.energy ?? 0) + (definition.alwaysConsumes?.energy ?? 0)) * level;
    const production = buildingId === "generator"
      ? getGeneratorEnergyRate(level, building.workers)
      : 0;
    const netRate = production - consumption;

    return {
      iconId: "energy",
      label: translations.resources.energy,
      value: this.getHourlyRateLabel(netRate),
      fill: this.getRateColor(netRate),
      tooltip: `${translations.resources.energy}: ${this.getHourlyRateLabel(netRate)}`,
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

  private drawGeneratorControls(
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

    const energyPerHour = getGeneratorEnergyRate(building.level, building.workers) * GAME_HOUR_REAL_SECONDS;
    this.drawPanel(parent, x, y, width, 104);
    this.drawSectionTitle(parent, translations.ui.operations ?? "Operations", x + 20, y + 18);
    this.drawText(parent, `${translations.ui.workers}: ${building.workers}/${workerLimit}`, x + 20, y + 50, { fill: 0xf5efdf, fontSize: 13, fontWeight: "800" });
    this.drawInfoToken(parent, {
      iconId: "energy",
      text: `+${this.formatRate(energyPerHour)}/h`,
      tooltip: `${translations.resources.energy}: +${this.formatRate(energyPerHour)}/h`,
      x: x + 20,
      y: y + 74,
    });
    this.createModalButton(parent, "-", x + width - 96, y + 42, 36, 32, { action: "building-workers", building: buildingId, delta: -1 }, building.workers <= 0);
    this.createModalButton(parent, "+", x + width - 48, y + 42, 36, 32, { action: "building-workers", building: buildingId, delta: 1 }, building.workers >= workerLimit || state.survivors.workers <= 0);
    return y + 118;
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
    rowContainer.hitArea = {
      contains: (hitX: number, hitY: number) =>
        hitX >= x + 18 && hitX <= x + width - 34 && hitY >= y - 2 && hitY <= y + 26,
    };
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

    token.hitArea = {
      contains: (x: number, y: number) => x >= 0 && x <= label.width + 26 && y >= -2 && y <= 18,
    };
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

  private createModalButton(parent: Container, label: string, x: number, y: number, width: number, height: number, detail: PixiActionDetail, disabled = false): Container {
    return this.createRectButton(parent, {
      label,
      x,
      y,
      width,
      height,
      detail,
      disabled,
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

    if (buildingId === "palisade") {
      effects.push({
        iconId: "people",
        value: "+1",
        tooltip: `${translations.ui.population} +1`,
      });
    }
    if (buildingId === "clinic") {
      const treatmentPerHour = (currentLevel + 1) * GAME_HOUR_REAL_SECONDS / 60;
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
      const currentMaxRate = getGeneratorEnergyRate(currentLevel, currentLimit) * GAME_HOUR_REAL_SECONDS;
      const nextMaxRate = getGeneratorEnergyRate(currentLevel + 1, nextLimit) * GAME_HOUR_REAL_SECONDS;
      if (nextLimit > currentLimit) {
        effects.push({
          iconId: "people",
          value: `+${nextLimit - currentLimit}`,
          tooltip: `${translations.ui.workers} max +${nextLimit - currentLimit}`,
        });
      }
      effects.push({
        iconId: "energy",
        value: `+${this.formatRate(nextMaxRate - currentMaxRate)}/h`,
        tooltip: `${translations.resources.energy} max +${this.formatRate(nextMaxRate - currentMaxRate)}/h`,
      });
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

    if (buildingId === "clinic") {
      const treatmentPerHour = level * GAME_HOUR_REAL_SECONDS / 60;
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
  ): Container {
    const group = new Container();
    const text = new Text({
      text: label,
      style: {
        fill: labelFill,
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 13,
        fontWeight: "800",
      },
    });
    const subtext = sublabel
      ? new Text({
        text: sublabel,
        style: {
          fill: sublabelFill,
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: 10,
          fontWeight: "800",
        },
      })
      : null;
    const width = Math.max(68, Math.max(text.width, subtext?.width ?? 0) + 44);
    const height = subtext ? 46 : 34;
    this.drawPanel(group, 0, 0, width, height);
    this.drawIcon(group, iconId, 17, height / 2, 16);
    text.x = 32;
    text.y = subtext ? 6 : 7;
    group.addChild(text);
    if (subtext) {
      subtext.x = 32;
      subtext.y = 25;
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
  ): Graphics {
    const panel = new Graphics();
    panel.roundRect(x, y, width, height, 8)
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

    this.tooltipLayer.removeChildren();

    const label = new Text({
      text,
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
    label.x = 12;
    label.y = 9;

    const panelWidth = Math.min(320, Math.max(92, label.width + 24));
    const panelHeight = Math.max(36, label.height + 18);
    const panel = new Graphics();
    panel.roundRect(0, 0, panelWidth, panelHeight, 7)
      .fill({ color: 0x111519, alpha: 0.96 })
      .stroke({ color: 0xe0c46f, alpha: 0.28, width: 1 });
    this.tooltipLayer.addChild(panel, label);
    this.positionCanvasTooltip(x, y, panelWidth, panelHeight);
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
    this.tooltipLayer.removeChildren();
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
    this.worldLayer.addChild(hitLayer);

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
    this.worldLayer.addChild(marker);
  }

  private drawBuildingVisualEffects(
    parent: Container,
    buildingId: BuildingId,
    level: number,
    bounds: Bounds,
    visualTime: number,
  ): void {
    if (buildingId !== "mainBuilding") {
      return;
    }

    const phase = getBuildingVisualFrame(buildingId, level);
    const effects = new Container();
    effects.eventMode = "none";
    const base = new Graphics();
    const lights = new Graphics();
    const smoke = new Graphics();
    base.eventMode = "none";
    lights.eventMode = "none";
    smoke.eventMode = "none";
    effects.addChild(base);
    effects.addChild(lights);
    effects.addChild(smoke);
    this.drawMainBuildingBaseGlow(base, phase, bounds, visualTime);
    this.drawMainBuildingLights(lights, phase, bounds, visualTime);
    this.drawMainBuildingSmoke(smoke, phase, bounds, visualTime);
    this.mainBuildingEffects.push({ phase, bounds, base, lights, smoke });

    parent.addChild(effects);
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

  private drawMainBuildingBaseGlow(
    graphics: Graphics,
    phase: number,
    bounds: Bounds,
    visualTime: number,
  ): void {
    const baseGlowAlpha = 0.08 + phase * 0.025;
    const lightPulse = 0.75 + Math.sin(visualTime * 4.4 + phase) * 0.18;

    graphics.clear()
      .ellipse(0, bounds.height * 0.3, bounds.width * (0.18 + phase * 0.035), bounds.height * 0.07)
      .fill({ color: 0xf0c766, alpha: baseGlowAlpha * lightPulse });
  }

  private drawMainBuildingLights(
    graphics: Graphics,
    phase: number,
    bounds: Bounds,
    visualTime: number,
  ): void {
    graphics.clear();
    const positions = [
      { x: -0.2, y: 0.03, delay: 0 },
      { x: -0.04, y: -0.1, delay: 1.1 },
      { x: 0.17, y: 0.0, delay: 2.2 },
      { x: 0.28, y: -0.14, delay: 3.1 },
    ];

    for (let index = 0; index <= Math.min(phase, positions.length - 1); index += 1) {
      const position = positions[index];
      const flicker = 0.58 + Math.sin(visualTime * 7.2 + position.delay) * 0.22 +
        Math.sin(visualTime * 13.4 + position.delay) * 0.08;
      const x = bounds.width * position.x;
      const y = bounds.height * position.y;
      const radius = Math.max(2, (3.3 + phase * 0.25) * this.layout.scale);

      graphics
        .circle(x, y, radius * 3.4)
        .fill({ color: 0xffc85b, alpha: 0.045 * flicker });
      graphics
        .circle(x, y, radius * 1.45)
        .fill({ color: 0xffd36a, alpha: 0.14 * flicker });
      graphics
        .circle(x, y, radius)
        .fill({ color: 0xfff2b0, alpha: 0.42 * flicker });
    }
  }

  private drawMainBuildingSmoke(
    graphics: Graphics,
    phase: number,
    bounds: Bounds,
    visualTime: number,
  ): void {
    graphics.clear();
    const sourceCount = Math.min(3, 1 + Math.floor(phase / 2));

    for (let source = 0; source < sourceCount; source += 1) {
      const sourceX = bounds.width * (-0.06 + source * 0.11);
      const sourceY = -bounds.height * (0.32 + source * 0.03);

      for (let puff = 0; puff < 4; puff += 1) {
        const progress = (visualTime * (0.13 + source * 0.02) + puff * 0.25 + source * 0.17) % 1;
        const drift = Math.sin(visualTime * 1.8 + puff * 1.7 + source) * bounds.width * 0.016;
        const rise = bounds.height * (0.05 + progress * (0.22 + phase * 0.015));
        const radius = Math.max(3.5, bounds.width * (0.018 + progress * 0.025));
        const alpha = (1 - progress) * (0.13 + phase * 0.012);

        graphics
          .circle(sourceX + drift + progress * bounds.width * 0.035, sourceY - rise, radius)
          .fill({ color: 0xb8b2a0, alpha });
        graphics
          .circle(sourceX + drift - radius * 0.45, sourceY - rise + radius * 0.18, radius * 0.62)
          .fill({ color: 0xd6d0bd, alpha: alpha * 0.52 });
      }
    }

    for (let index = 0; index < phase; index += 1) {
      const blink = 0.45 + Math.sin(visualTime * 5 + index) * 0.2;
      graphics
        .circle(bounds.width * 0.08, -bounds.height * (0.34 + index * 0.055), Math.max(1.5, 2.3 * this.layout.scale))
        .fill({ color: 0x9bd8ff, alpha: 0.12 * blink });
    }
  }

  private fitSprite(sprite: Sprite, maxWidth: number, maxHeight: number): void {
    const widthScale = maxWidth / sprite.texture.width;
    const heightScale = maxHeight / sprite.texture.height;
    const scale = Math.min(widthScale, heightScale);
    sprite.scale.set(scale);
  }

  private updateMainBuildingEffects(): void {
    if (this.mainBuildingEffects.length === 0) {
      return;
    }

    const visualTime = performance.now() / 1000;
    for (const effect of this.mainBuildingEffects) {
      this.drawMainBuildingBaseGlow(effect.base, effect.phase, effect.bounds, visualTime);
      this.drawMainBuildingLights(effect.lights, effect.phase, effect.bounds, visualTime);
      this.drawMainBuildingSmoke(effect.smoke, effect.phase, effect.bounds, visualTime);
    }
  }

  private getBuildingTexture(buildingId: BuildingId, level: number, built: boolean): Texture {
    const spritesheetTexture = this.getSpritesheetBuildingTexture(buildingId, level, built);

    if (spritesheetTexture) {
      return spritesheetTexture;
    }

    const key = `${buildingId}:${level}:${built ? "built" : "ghost"}`;
    const cached = buildingTextureCache.get(key);

    if (cached) {
      return cached;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const context = canvas.getContext("2d");

    if (!context) {
      return Texture.WHITE;
    }

    context.translate(canvas.width / 2, canvas.height * 0.52);
    drawBuildingAsset(context, {
      id: buildingId,
      width: 130,
      height: 92,
      level,
      built,
      scale: 1.25,
    });

    const texture = Texture.from(canvas);
    buildingTextureCache.set(key, texture);
    return texture;
  }

  private getSpritesheetBuildingTexture(
    buildingId: BuildingId,
    level: number,
    built: boolean,
  ): Texture | null {
    if (!built) {
      return null;
    }

    const visual = buildingVisualDefinitions[buildingId];
    const spritesheet = this.buildingSpritesheets.get(buildingId);

    if (!visual || !spritesheet) {
      return null;
    }

    const frame = getBuildingVisualFrame(buildingId, level);
    const key = `${buildingId}:spritesheet:${frame}`;
    const cached = buildingTextureCache.get(key);

    if (cached) {
      return cached;
    }

    const frameWidth = spritesheet.width / visual.frames;
    const texture = new Texture({
      source: spritesheet.source,
      frame: new Rectangle(frame * frameWidth, 0, frameWidth, spritesheet.height),
    });

    buildingTextureCache.set(key, texture);
    return texture;
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

  private getLayout(width: number, height: number): SceneLayout {
    const scale = Math.min(width / 1420, height / 880);
    const villageWidth = 1120 * scale;
    const villageHeight = 680 * scale;

    return {
      originX: (width - villageWidth) / 2,
      originY: Math.max(92, (height - villageHeight) / 2),
      width: villageWidth,
      height: villageHeight,
      scale,
    };
  }

  private getHudScale(width: number, height: number): number {
    return Math.min(1.2, Math.max(1, Math.min(width / 1120, height / 640)));
  }

  private getPalisadeGeometry(): PalisadeGeometry {
    const { originX, originY, width, height } = this.layout;

    return {
      centerX: originX + width * 0.5,
      centerY: originY + height * 0.525,
      radiusX: width * 0.535,
      radiusY: height * 0.425,
    };
  }

  private getPlotBounds(plot: VillagePlotDefinition): Bounds {
    if (plot.id === "plot-palisade") {
      return this.getPalisadePlotBounds(plot);
    }

    const width = plot.width * this.layout.scale;
    const height = plot.height * this.layout.scale;

    return {
      x: this.layout.originX + plot.x * this.layout.width - width / 2,
      y: this.layout.originY + plot.y * this.layout.height - height / 2,
      width,
      height,
    };
  }

  private getPalisadePlotBounds(plot: VillagePlotDefinition): Bounds {
    const width = plot.width * this.layout.scale;
    const height = plot.height * this.layout.scale;
    const { centerX, centerY, radiusY } = this.getPalisadeGeometry();

    return {
      x: centerX - width / 2,
      y: centerY + radiusY - height * 0.62,
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
}
