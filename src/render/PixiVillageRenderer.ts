import {
  Application,
  Assets,
  Container,
  Graphics,
  Text,
  Sprite,
  Texture,
  type TextStyleFontWeight,
} from "pixi.js";
import { resourceDefinitions } from "../data/resources";
import { buildingById, buildingDefinitions } from "../data/buildings";
import { villagePlotDefinitions, type VillagePlotDefinition } from "../data/villagePlots";
import { formatGameClock, getGameDay } from "../game/time";
import type { BuildingId, GameSpeed, GameState, ResourceBag, ResourceId } from "../game/types";
import type { TranslationPack } from "../i18n/types";
import {
  getAvailableBuildingsForPlot,
  getActiveBuildingQueue,
  getBuildingWorkerLimit,
  getConstructionWorkerRequirement,
  getGeneratorEnergyRate,
  getResourceProductionRates,
  getUpgradeCost,
  hasAvailableBuildingSlot,
  MAX_ACTIVE_BUILDINGS,
} from "../systems/buildings";
import { getClinicFoodPerTreatment } from "../systems/health";
import { canAfford } from "../systems/resources";
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

type PixiActionDetail = {
  action?: string;
  building?: BuildingId;
  plot?: string;
  delta?: number;
  speed?: GameSpeed;
  view?: "village" | "world";
};

type PixiTooltipDetail = {
  visible: boolean;
  text?: string;
  x?: number;
  y?: number;
};

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

const resourceColors: Record<ResourceId, number> = {
  food: 0xd8b66a,
  water: 0x66bde8,
  material: 0xc7c9bd,
  energy: 0xf0ce55,
  morale: 0xe9a0a0,
};

const buildingTextureCache = new Map<string, Texture>();

export class PixiVillageRenderer {
  private app: Application | null = null;
  private readonly rootLayer = new Container();
  private readonly worldLayer = new Container();
  private readonly hudLayer = new Container();
  private backgroundTexture: Texture | null = null;
  private layout: SceneLayout = {
    originX: 0,
    originY: 0,
    width: 0,
    height: 0,
    scale: 1,
  };
  private lastState: GameState | null = null;
  private lastTranslations: TranslationPack | undefined;

  constructor(
    private readonly host: HTMLElement,
    private readonly requestRender: () => void = () => {},
  ) {
    this.rootLayer.addChild(this.worldLayer, this.hudLayer);
    void this.initialize();
  }

  render(state: GameState, translations?: TranslationPack, modalPlotId?: string | null): void {
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
    this.worldLayer.removeChildren();
    this.hudLayer.removeChildren();
    this.drawBackground(width, height);
    this.drawPalisade(state, translations?.buildings);

    for (const plot of villagePlotDefinitions.filter((candidate) => candidate.kind !== "perimeter")) {
      this.drawPlot(plot, state, translations);
    }

    this.drawGate(state);
    this.drawHud(state, translations, width, height);
    this.drawVillageModal(state, translations, width, height, modalPlotId ?? null);
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

  destroy(): void {
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
    this.app = app;

    this.backgroundTexture = await Assets.load<Texture>(villageBackgroundUrl);
    this.requestRender();
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
    const { originX, originY, width, height, scale } = this.layout;
    const plot = state.village.plots.find((candidate) => candidate.id === "plot-palisade");
    const building = plot?.buildingId ? state.buildings[plot.buildingId] : null;
    const hasStarted = plot?.buildingId === "palisade";
    const built = (building?.level ?? 0) > 0;
    const selected = state.village.selectedPlotId === "plot-palisade";
    const centerX = originX + width / 2;
    const centerY = originY + height * 0.52;
    const radiusX = width * 0.47;
    const radiusY = height * 0.41;
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

    this.drawPalisadePlotLabel(
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
    this.worldLayer.addChild(plotLayer);

    const shadow = new Graphics();
    shadow
      .ellipse(0, bounds.height * 0.36, bounds.width * 0.58, bounds.height * 0.33)
      .fill({ color: 0x000000, alpha: buildingId ? 0.36 : 0.18 });
    plotLayer.addChild(shadow);

    if (buildingId && building) {
      const asset = new Sprite(this.getBuildingTexture(buildingId, Math.max(1, building.level), building.level > 0));
      asset.anchor.set(0.5);
      asset.width = bounds.width;
      asset.height = bounds.height;
      asset.alpha = building.level > 0 || isMainPlot ? 1 : 0.62;
      plotLayer.addChild(asset);

      this.drawBuildingNameplate(
        plotLayer,
        name,
        building.level,
        selected,
        isMainPlot ? bounds.height + 10 * this.layout.scale : bounds.height,
        building.upgradingRemaining,
      );
      return;
    }

    const empty = new Graphics();
    empty
      .roundRect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height, 6 * this.layout.scale)
      .fill({ color: 0x292b1f, alpha: 0.46 })
      .stroke({
        color: selected ? 0xf3c85f : 0xe0c46f,
        alpha: selected ? 1 : 0.5,
        width: selected ? 3 : 2,
      });
    plotLayer.addChild(empty);
    this.drawCenteredText(plotLayer, "+", 0, -bounds.height * 0.08, {
      fill: 0xeadca0,
      fontSize: Math.max(30, 38 * this.layout.scale),
      fontWeight: "700",
      alpha: 0.72,
    });
    this.drawCenteredText(plotLayer, (translations?.ui.emptyPlot ?? "Empty plot").toUpperCase(), 0, bounds.height * 0.26, {
      fill: 0xefe5c5,
      fontSize: Math.max(10, 12 * this.layout.scale),
      fontWeight: "700",
      alpha: 0.72,
    });
  }

  private drawGate(state: GameState): void {
    const { originX, originY, width, height } = this.layout;
    const plot = state.village.plots.find((candidate) => candidate.id === "plot-palisade");
    const building = plot?.buildingId ? state.buildings[plot.buildingId] : null;
    const alpha = (building?.level ?? 0) > 0 ? 1 : plot?.buildingId ? 0.58 : 0.3;
    const gateX = originX + width * 0.5;
    const gateY = originY + height * 0.9;
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
    const population = this.getPopulation(state);

    this.drawBrand(state.communityName, `${t?.ui.day ?? "Day"} ${day} / ${clock}`);
    this.drawTopPills(
      [
        ["day", `${t?.ui.day ?? "Day"} ${day} / ${clock}`, t?.ui.dayTooltip],
        ["people", `${population}`, t?.ui.populationTooltip],
        ["shield", `${Math.round(this.getDefenseScore(state))}`, t?.ui.defenseTooltip],
        ["morale", `${Math.floor(state.resources.morale)}%`, t ? `${t.resources.morale}: ${t.resourceDescriptions.morale}` : undefined],
      ],
      width,
    );
    this.drawResourcePills(state, translations, width);
    this.drawViewTabs(translations);
    this.drawProduction(state, translations);
    this.drawWorkforce(state, translations);
    this.drawActionRail(translations, width, height);
    this.drawQueue(state, translations, height);
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

  private drawTopPills(items: Array<[string, string, string | undefined]>, width: number): void {
    const group = new Container();
    group.y = 30;
    this.hudLayer.addChild(group);

    let x = 0;
    for (const [iconId, label, tooltip] of items) {
      const pill = this.createPill(label, iconId, tooltip);
      pill.x = x;
      group.addChild(pill);
      x += pill.width + 8;
    }

    group.x = Math.max(390, (width - x) / 2);
  }

  private drawResourcePills(state: GameState, translations: TranslationPack | undefined, width: number): void {
    const group = new Container();
    group.y = 30;
    this.hudLayer.addChild(group);

    let x = 0;
    for (const resource of resourceDefinitions.filter((definition) => definition.id !== "morale")) {
      const label = `${Math.floor(state.resources[resource.id])}/${Math.floor(state.capacities[resource.id])}`;
      const tooltip = translations
        ? `${translations.resources[resource.id]}: ${translations.resourceDescriptions[resource.id]}`
        : resource.id;
      const pill = this.createPill(label, resource.id, tooltip);
      pill.x = x;
      group.addChild(pill);
      x += pill.width + 8;
    }

    group.x = Math.max(28, width - x - 28);
  }

  private drawViewTabs(translations: TranslationPack | undefined): void {
    const group = new Container();
    group.x = 28;
    group.y = 94;
    this.hudLayer.addChild(group);

    this.createHudButton(group, translations?.ui.village ?? "Village", 0, 0, 90, 42, { view: "village" }, true);
    this.createHudButton(group, translations?.ui.worldMap ?? "World map", 98, 0, 116, 42, { view: "world" });
  }

  private drawProduction(state: GameState, translations: TranslationPack | undefined): void {
    const rates = getResourceProductionRates(state);
    const layer = new Container();
    layer.x = 28;
    layer.y = 152;
    this.hudLayer.addChild(layer);

    const width = 308;
    const rowHeight = 18;
    const height = 44 + resourceDefinitions.length * rowHeight;
    this.drawPanel(layer, 0, 0, width, height);
    this.drawIcon(layer, "build", 18, 22, 14);
    this.drawText(layer, translations?.ui.production ?? "Production", 34, 14, {
      fill: 0xf3edda,
      fontSize: 12,
      fontWeight: "800",
    });
    if (translations?.ui.productionTooltip) {
      this.bindTooltip(layer, translations.ui.productionTooltip);
    }

    this.drawText(layer, translations?.ui.stock ?? "Stock", 226, 14, { fill: 0xaeb4b8, fontSize: 11, fontWeight: "800" }).anchor.set(1, 0);
    this.drawText(layer, translations?.ui.perMinute ?? "+/min", 290, 14, { fill: 0xaeb4b8, fontSize: 11, fontWeight: "800" }).anchor.set(1, 0);

    resourceDefinitions.forEach((resource, index) => {
      const y = 38 + index * rowHeight;
      const perMinute = rates[resource.id] * 60;
      const stock = resource.id === "morale"
        ? `${Math.floor(state.resources[resource.id])}%`
        : `${Math.floor(state.resources[resource.id])}/${Math.floor(state.capacities[resource.id])}`;
      const rateLabel = `${perMinute > 0 ? "+" : ""}${this.formatRate(perMinute)}`;
      const rateColor = perMinute > 0.004 ? 0x8fe0b8 : perMinute < -0.004 ? 0xff9aa2 : 0xaeb4b8;

      const resourceCell = new Container();
      resourceCell.x = 142;
      resourceCell.y = y + 7;
      layer.addChild(resourceCell);
      if (translations) {
        this.bindTooltip(resourceCell, `${translations.resources[resource.id]}: ${translations.resourceDescriptions[resource.id]}`);
      }
      this.drawIcon(resourceCell, resource.id, 0, 0, 15);
      this.drawText(layer, stock, 226, y, { fill: 0xd7ddd8, fontSize: 11 }).anchor.set(1, 0);
      this.drawText(layer, rateLabel, 290, y, { fill: rateColor, fontSize: 11, fontWeight: "700" }).anchor.set(1, 0);
    });
  }

  private drawWorkforce(state: GameState, translations: TranslationPack | undefined): void {
    const layer = new Container();
    layer.x = 28;
    layer.y = 304;
    this.hudLayer.addChild(layer);

    const buildingWorkers = Object.values(state.buildings)
      .reduce((total, building) => total + building.workers, 0);
    const constructionWorkers = Object.values(state.buildings)
      .reduce((total, building) => total + building.constructionWorkers, 0);
    const expeditionTroops = state.expeditions
      .reduce((total, expedition) => total + expedition.survivors, 0);
    const totalPopulation =
      state.survivors.workers +
      state.survivors.troops +
      buildingWorkers +
      constructionWorkers +
      expeditionTroops +
      state.health.injured;
    const t = translations;

    this.drawPanel(layer, 0, 0, 308, 126);
    this.drawIcon(layer, "people", 18, 22, 15);
    this.drawText(layer, t?.ui.survivors ?? "Survivors", 34, 14, {
      fill: 0xf3edda,
      fontSize: 12,
      fontWeight: "800",
    });
    this.drawInfoToken(layer, {
      iconId: "people",
      text: `${totalPopulation}`,
      tooltip: t?.ui.totalPopulation ?? "Total population",
      x: 246,
      y: 14,
    });

    const rows: Array<[string, string, string, number]> = [
      ["people", `${state.survivors.workers}`, t?.ui.availableWorkers ?? "Available workers", 0],
      ["build", `${buildingWorkers}`, t?.ui.buildingWorkers ?? "Working in buildings", 1],
      ["material", `${constructionWorkers}`, t?.ui.constructionCrew ?? "Construction crew", 2],
      ["scout", `${state.survivors.troops}`, t?.ui.availableTroops ?? "Available troops", 3],
      ["day", `${expeditionTroops}`, t?.ui.expeditionTroops ?? "On expedition", 4],
      ["morale", `${state.health.injured}`, t?.roles.injured ?? "Injured", 5],
    ];

    rows.forEach(([iconId, value, tooltip, index]) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      this.drawInfoToken(layer, {
        iconId,
        text: value,
        tooltip,
        missing: iconId === "morale" && state.health.injured > 0,
        x: 16 + column * 144,
        y: 44 + row * 26,
      });
    });
  }

  private drawActionRail(translations: TranslationPack | undefined, width: number, height: number): void {
    const actions: Array<[string, string, string]> = [
      [translations?.ui.buildAction ?? "Build", "▥", "open-selected-plot"],
      [translations?.ui.upgradeAction ?? "Upgrade", "◆", "open-selected-plot"],
      [translations?.ui.settlersAction ?? "Settlers", "●●", "open-survivors"],
      [translations?.ui.logAction ?? "Log", "▤", "open-log"],
    ];
    const rail = new Container();
    rail.x = width - 120;
    rail.y = Math.max(150, height / 2 - 202);
    this.hudLayer.addChild(rail);

    const visibleActions: Array<[string, string, string]> = [
      [translations?.ui.buildAction ?? "Build", "build", "open-selected-plot"],
      [translations?.ui.upgradeAction ?? "Upgrade", "material", "open-selected-plot"],
    ];
    visibleActions.forEach(([label, symbol, action], index) => {
      const button = this.createActionButton(label, symbol, action);
      button.y = index * 106;
      rail.addChild(button);
    });
    void actions;
  }

  private drawQueue(state: GameState, translations: TranslationPack | undefined, height: number): void {
    const queue = getActiveBuildingQueue(state);
    const layer = new Container();
    layer.x = 300;
    layer.y = height - 86;
    this.hudLayer.addChild(layer);
    this.drawPanel(layer, 0, 0, 310, 62);
    this.drawText(layer, translations?.ui.buildingQueue ?? "Building queue", 12, 13, { fill: 0xf5efdf, fontSize: 12, fontWeight: "800" });
    this.drawText(layer, `${queue.length}/${MAX_ACTIVE_BUILDINGS}`, 276, 13, { fill: 0xf1df9a, fontSize: 13, fontWeight: "800" });

    if (queue.length === 0) {
      this.drawText(layer, translations?.ui.queueEmpty ?? "No active construction.", 12, 38, { fill: 0xaeb4b8, fontSize: 12 });
      return;
    }

    queue.slice(0, 2).forEach((buildingId, index) => {
      const building = state.buildings[buildingId];
      const label = translations?.buildings[buildingId].name ?? buildingById[buildingId].name;
      this.drawText(layer, `${label} / ${Math.ceil(building.upgradingRemaining)}s`, 12, 38 + index * 16, {
        fill: 0xd7ddd8,
        fontSize: 11,
      });
    });
  }

  private drawToolbar(state: GameState, translations: TranslationPack | undefined, width: number, height: number): void {
    const group = new Container();
    group.x = width - 318;
    group.y = height - 72;
    this.hudLayer.addChild(group);
    this.drawPanel(group, 0, 0, 290, 48);

    this.createIconButton(group, state.paused ? "play" : "pause", 8, 8, 40, 32, { action: "pause" }, state.paused ? translations?.ui.resume : translations?.ui.pause);
    this.createHudButton(group, translations?.ui.speedNormal ?? "1x", 56, 8, 44, 32, { speed: 1 }, state.speed === 1);
    this.createHudButton(group, translations?.ui.speedFast ?? "Fast", 108, 8, 52, 32, { speed: 8 }, state.speed === 8);
    this.createIconButton(group, "save", 168, 8, 40, 32, { action: "save" }, translations?.ui.save);
    this.createIconButton(group, "load", 216, 8, 32, 32, { action: "load" }, translations?.ui.load);
    this.createIconButton(group, "reset", 256, 8, 26, 32, { action: "reset" }, translations?.ui.reset);
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

    const modalWidth = Math.min(1100, width - 48);
    const modalHeight = Math.min(840, height - 48);
    const panel = new Container();
    panel.x = (width - modalWidth) / 2;
    panel.y = (height - modalHeight) / 2;
    panel.eventMode = "static";
    overlay.addChild(panel);
    this.drawPanel(panel, 0, 0, modalWidth, modalHeight);

    const title = selectedPlot.buildingId === null
      ? translations.ui.availableBuilds
      : translations.ui.selectedPlot;
    const subtitle = `${selectedPlot.id} / ${selectedPlot.buildingId === null ? translations.ui.emptyPlot : translations.ui.alreadyBuilt}`;
    this.drawText(panel, title, 24, 20, { fill: 0xf5efdf, fontSize: 22, fontWeight: "900" });
    this.drawText(panel, subtitle, 24, 50, { fill: 0xaeb4b8, fontSize: 12, fontWeight: "700" });
    this.createIconButton(panel, "close", modalWidth - 58, 18, 36, 36, { action: "close-village-modal" }, translations.ui.close);

    if (selectedPlot.buildingId === null) {
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

    const buildingId = selectedPlot.buildingId;
    const building = state.buildings[buildingId];
    const definition = buildingById[buildingId];
    this.drawBuildingDetail(panel, buildingId, building.level, building.upgradingRemaining, definition.maxLevel, definition.buildSeconds, state, translations, modalWidth);
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

    const gap = 4;
    const listX = 24;
    const listY = 88;
    const rowWidth = modalWidth - 48;
    const availableHeight = modalHeight - listY - 24;
    const rowHeight = Math.max(
      58,
      Math.min(76, (availableHeight - gap * (buildableBuildings.length - 1)) / buildableBuildings.length),
    );

    buildableBuildings.forEach((buildingId, index) => {
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

      this.drawBuildRow(parent, {
        x: listX,
        y: listY + index * (rowHeight + gap),
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
    asset.width = Math.min(104, options.height * 1.42);
    asset.height = Math.min(78, options.height * 0.96);
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
    buildSeconds: number,
    state: GameState,
    translations: TranslationPack,
    modalWidth: number,
  ): void {
    const translated = translations.buildings[buildingId];
    const cost = getUpgradeCost(buildingId, level);
    const locked = level >= maxLevel;
    const upgrading = upgradingRemaining > 0;
    const affordable = canAfford(state.resources, cost);
    const queueAvailable = hasAvailableBuildingSlot(state);
    const requiredWorkers = getConstructionWorkerRequirement(buildingId, level);
    const workersAvailable = state.survivors.workers >= requiredWorkers;
    const disabled = locked || upgrading || !affordable || !queueAvailable || !workersAvailable;

    const content = new Container();
    content.x = 24;
    content.y = 88;
    parent.addChild(content);

    const asset = new Sprite(this.getBuildingTexture(buildingId, Math.max(1, level), level > 0));
    asset.anchor.set(0.5);
    asset.x = 90;
    asset.y = 76;
    asset.width = 150;
    asset.height = 112;
    content.addChild(asset);

    this.drawText(content, translated.name, 196, 6, { fill: 0xf5efdf, fontSize: 24, fontWeight: "900" });
    this.drawText(content, translated.description, 196, 40, {
      fill: 0xc8cabb,
      fontSize: 13,
      fontWeight: "600",
      wordWrap: true,
      wordWrapWidth: modalWidth - 260,
    });

    this.drawStatPill(content, "build", `${translations.ui.level} ${level}/${maxLevel}`, 196, 88);
    this.drawStatPill(content, "shield", `${translations.ui.defense} ${Math.round(this.getDefenseScore(state))}`, 330, 88);
    this.drawEffects(content, this.getNextLevelEffects(buildingId, level, translations), 196, 132, modalWidth - 270);

    let y = 184;
    if (buildingId === "generator") {
      y = this.drawGeneratorControls(content, buildingId, state, translations, y);
    }

    if (buildingId === "barracks") {
      y = this.drawBarracksControls(content, state, translations, y);
    }

    this.drawText(content, locked ? translations.ui.maxLevelReached : translations.ui.nextLevel, 0, y, {
      fill: 0xf1df9a,
      fontSize: 13,
      fontWeight: "900",
    });
    this.drawCostLine(content, cost, state.resources, translations, 0, y + 28);
    this.drawWorkerRequirement(content, requiredWorkers, state.survivors.workers, translations, 190, y + 28);

    const warnings: string[] = [];
    if (!queueAvailable && !upgrading) {
      warnings.push(translations.ui.queueFull);
    }
    if (!workersAvailable && !upgrading) {
      warnings.push(translations.ui.notEnoughWorkers);
    }

    warnings.forEach((warning, index) => {
      this.drawText(content, warning, 0, y + 66 + index * 18, { fill: 0xff9aa2, fontSize: 12, fontWeight: "800" });
    });

    const buttonLabel = upgrading
      ? `${Math.ceil(upgradingRemaining)}s`
      : queueAvailable
        ? translations.ui.upgrade
        : translations.ui.queueFull;
    this.createModalButton(content, buttonLabel, modalWidth - 210, y + 24, 162, 36, { action: "upgrade", building: buildingId }, disabled);
    this.drawText(content, `${Math.ceil(buildSeconds * (1 + level * 0.35))}s`, modalWidth - 210, y + 68, {
      fill: 0xaeb4b8,
      fontSize: 11,
      fontWeight: "700",
    });
  }

  private drawGeneratorControls(parent: Container, buildingId: BuildingId, state: GameState, translations: TranslationPack, y: number): number {
    const building = state.buildings[buildingId];
    const workerLimit = getBuildingWorkerLimit(state, buildingId);

    if (workerLimit <= 0) {
      return y;
    }

    const energyPerMinute = getGeneratorEnergyRate(building.level, building.workers) * 60;
    this.drawPanel(parent, 0, y, 360, 58);
    this.drawText(parent, `${translations.ui.workers}: ${building.workers}/${workerLimit}`, 14, y + 11, { fill: 0xf5efdf, fontSize: 13, fontWeight: "800" });
    this.drawInfoToken(parent, {
      iconId: "energy",
      text: `+${this.formatRate(energyPerMinute)}/min`,
      tooltip: `${translations.resources.energy}: +${this.formatRate(energyPerMinute)}/min`,
      x: 14,
      y: y + 32,
    });
    this.createModalButton(parent, "-", 254, y + 14, 36, 30, { action: "building-workers", building: buildingId, delta: -1 }, building.workers <= 0);
    this.createModalButton(parent, "+", 302, y + 14, 36, 30, { action: "building-workers", building: buildingId, delta: 1 }, building.workers >= workerLimit || state.survivors.workers <= 0);
    return y + 78;
  }

  private drawBarracksControls(parent: Container, state: GameState, translations: TranslationPack, y: number): number {
    if (state.buildings.barracks.level <= 0) {
      return y;
    }

    this.drawPanel(parent, 0, y, 430, 72);
    this.drawText(parent, `${translations.ui.availableWorkers}: ${state.survivors.workers}`, 14, y + 12, { fill: 0xf5efdf, fontSize: 13, fontWeight: "800" });
    this.drawText(parent, `${translations.ui.availableTroops}: ${state.survivors.troops}`, 14, y + 38, { fill: 0xf5efdf, fontSize: 13, fontWeight: "800" });
    this.createModalButton(parent, translations.ui.workerToTroop, 188, y + 12, 112, 30, { action: "barracks-worker-to-troop" }, state.survivors.workers <= 0);
    this.createModalButton(parent, translations.ui.troopToWorker, 308, y + 12, 108, 30, { action: "barracks-troop-to-worker" }, state.survivors.troops <= 0);
    return y + 92;
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
    const button = new Container();
    button.x = x;
    button.y = y;
    parent.addChild(button);
    const box = new Graphics();
    box.roundRect(0, 0, width, height, 6)
      .fill({ color: disabled ? 0x34362e : 0xe0c46f, alpha: disabled ? 0.62 : 1 })
      .stroke({ color: 0xe0c46f, alpha: disabled ? 0.22 : 0.54, width: 1 });
    button.addChild(box);
    this.drawCenteredText(button, label, width / 2, height / 2, {
      fill: disabled ? 0xaeb4b8 : 0x141719,
      fontSize: 12,
      fontWeight: "900",
    });
    if (!disabled) {
      this.bindAction(button, detail);
    }
    return button;
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
      effects.push({
        iconId: "people",
        value: "+1/min",
        tooltip: `${translations.ui.treatment} +1/min (${translations.resources.food} -${getClinicFoodPerTreatment()})`,
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
      const currentMaxRate = getGeneratorEnergyRate(currentLevel, currentLimit) * 60;
      const nextMaxRate = getGeneratorEnergyRate(currentLevel + 1, nextLimit) * 60;
      if (nextLimit > currentLimit) {
        effects.push({
          iconId: "people",
          value: `+${nextLimit - currentLimit}`,
          tooltip: `${translations.ui.workers} max +${nextLimit - currentLimit}`,
        });
      }
      effects.push({
        iconId: "energy",
        value: `+${this.formatRate(nextMaxRate - currentMaxRate)}/min`,
        tooltip: `${translations.resources.energy} max +${this.formatRate(nextMaxRate - currentMaxRate)}/min`,
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
        value: `+${this.formatRate((amount ?? 0) * 60)}/min`,
        tooltip: `${translations.resources[typedResourceId]} +${this.formatRate((amount ?? 0) * 60)}/min`,
      });
    }
    for (const [resourceId, amount] of Object.entries(definition.consumes ?? {})) {
      const typedResourceId = resourceId as ResourceId;
      effects.push({
        iconId: typedResourceId,
        value: `-${this.formatRate((amount ?? 0) * 60)}/min`,
        tooltip: `${translations.resources[typedResourceId]} -${this.formatRate((amount ?? 0) * 60)}/min`,
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

  private createPill(label: string, color: number | string, prefix?: string): Container {
    const iconId = typeof color === "string" ? color : "day";
    const tooltip = prefix;
    const group = new Container();
    const text = new Text({
      text: label,
      style: {
        fill: 0xe9e4d2,
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 13,
        fontWeight: "800",
      },
    });
    const width = Math.max(62, text.width + 44);
    this.drawPanel(group, 0, 0, width, 34);
    this.drawIcon(group, iconId, 17, 17, 16);
    text.x = 32;
    text.y = 7;
    group.addChild(text);
    if (tooltip) {
      this.bindTooltip(group, tooltip);
    }
    return group;
  }

  private createActionButton(label: string, iconId: string, action: string): Container {
    const button = new Container();
    const box = new Graphics();
    box.roundRect(0, 0, 92, 96, 8).fill({ color: 0x10120e, alpha: 0.72 }).stroke({ color: 0xe0c46f, alpha: 0.28, width: 1 });
    button.addChild(box);
    this.drawIcon(button, iconId, 46, 31, 30);
    this.drawCenteredText(button, label.toUpperCase(), 46, 68, { fill: 0xf3c85f, fontSize: 11, fontWeight: "900" });
    this.bindAction(button, { action });
    this.bindTooltip(button, label);
    return button;
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
    const button = new Container();
    button.x = x;
    button.y = y;
    const box = new Graphics();
    box.roundRect(0, 0, width, height, 7)
      .fill({ color: active ? 0xe0c46f : 0x2d2f23, alpha: active ? 1 : 0.84 })
      .stroke({ color: 0xe0c46f, alpha: active ? 0.6 : 0.18, width: 1 });
    button.addChild(box);
    this.drawCenteredText(button, label, width / 2, height / 2, {
      fill: active ? 0x141719 : 0xf4eedf,
      fontSize: 13,
      fontWeight: "700",
    });
    this.bindAction(button, detail);
    parent.addChild(button);
    return button;
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
    const button = new Container();
    button.x = x;
    button.y = y;
    const box = new Graphics();
    box.roundRect(0, 0, width, height, 7)
      .fill({ color: active ? 0xe0c46f : 0x2d2f23, alpha: active ? 1 : 0.84 })
      .stroke({ color: 0xe0c46f, alpha: active ? 0.6 : 0.18, width: 1 });
    button.addChild(box);
    const icon = this.drawIcon(button, iconId, width / 2, height / 2, Math.min(width, height) - 14);
    icon.alpha = active ? 0.9 : 1;
    this.bindAction(button, detail);
    if (tooltip) {
      this.bindTooltip(button, tooltip);
    }
    parent.addChild(button);
    return button;
  }

  private drawIcon(parent: Container, iconId: string, x: number, y: number, size: number): Container {
    return drawPixiIcon(parent, iconId, x, y, size);
  }

  private drawPanel(parent: Container, x: number, y: number, width: number, height: number): Graphics {
    const panel = new Graphics();
    panel.roundRect(x, y, width, height, 8)
      .fill({ color: 0x10120e, alpha: 0.76 })
      .stroke({ color: 0xe0c46f, alpha: 0.22, width: 1 });
    parent.addChild(panel);
    return panel;
  }

  private bindAction(target: Container, detail: PixiActionDetail): void {
    target.eventMode = "static";
    target.cursor = "pointer";
    target.on("pointertap", () => {
      this.host.dispatchEvent(new CustomEvent<PixiActionDetail>("pixi-action", { detail }));
    });
  }

  private bindTooltip(target: Container, text: string): void {
    target.eventMode = "static";
    target.on("pointerover", (event) => {
      this.emitTooltip(true, text, event.global.x, event.global.y);
    });
    target.on("pointermove", (event) => {
      this.emitTooltip(true, text, event.global.x, event.global.y);
    });
    target.on("pointerout", () => {
      this.emitTooltip(false);
    });
  }

  private emitTooltip(visible: boolean, text?: string, x?: number, y?: number): void {
    this.host.dispatchEvent(new CustomEvent<PixiTooltipDetail>("pixi-tooltip", {
      detail: { visible, text, x, y },
    }));
  }

  private drawPalisadePlotLabel(
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
    const labelLayer = new Container();
    labelLayer.x = bounds.x;
    labelLayer.y = bounds.y;
    this.worldLayer.addChild(labelLayer);

    const plate = new Graphics();
    plate
      .roundRect(0, 0, bounds.width, bounds.height, 7 * this.layout.scale)
      .fill({ color: selected ? 0x1c1810 : 0x0a0c0c, alpha: selected ? 0.28 : 0.2 })
      .stroke({
        color: selected ? 0xf6e58d : 0xffffff,
        alpha: selected ? 1 : 0.22,
        width: selected ? 3 : 1,
      });
    labelLayer.addChild(plate);
    this.drawCenteredText(labelLayer, name, bounds.width / 2, bounds.height * 0.48, {
      fill: 0xf3edda,
      fontSize: Math.max(10, 12 * this.layout.scale),
    });
    this.drawCenteredText(
      labelLayer,
      upgradingRemaining > 0 ? `${Math.ceil(upgradingRemaining)}s` : `Lvl ${level}`,
      bounds.width / 2,
      bounds.height * 0.78,
      {
        fill: upgradingRemaining > 0 ? 0xf1bf55 : level > 0 ? 0xf3dc8f : 0xaab1aa,
        fontSize: Math.max(10, 12 * this.layout.scale),
      },
    );
  }

  private drawBuildingNameplate(
    parent: Container,
    name: string,
    level: number,
    selected: boolean,
    plotHeight: number,
    upgradingRemaining = 0,
  ): void {
    const plateWidth = 128 * this.layout.scale;
    const plateHeight = 44 * this.layout.scale;
    const y = plotHeight * 0.42;
    const plate = new Graphics();
    plate
      .roundRect(-plateWidth / 2, y, plateWidth, plateHeight, 5 * this.layout.scale)
      .fill({ color: selected ? 0x1c1810 : 0x12130f, alpha: selected ? 0.86 : 0.82 })
      .stroke({
        color: selected ? 0xf3c85f : 0xe0c46f,
        alpha: selected ? 1 : 0.32,
        width: selected ? 2 : 1,
      });
    parent.addChild(plate);
    this.drawCenteredText(parent, name.toUpperCase(), 0, y + plateHeight * 0.38, {
      fill: 0xf5efdf,
      fontSize: Math.max(11, 14 * this.layout.scale),
      fontWeight: "800",
    });
    this.drawCenteredText(
      parent,
      upgradingRemaining > 0 ? `${Math.ceil(upgradingRemaining)}s` : `Lvl ${level}`,
      0,
      y + plateHeight * 0.72,
      {
        fill: 0xf1bf55,
        fontSize: Math.max(10, 13 * this.layout.scale),
        fontWeight: "700",
      },
    );
  }

  private getBuildingTexture(buildingId: BuildingId, level: number, built: boolean): Texture {
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

  private getPlotBounds(plot: VillagePlotDefinition): Bounds {
    const width = plot.width * this.layout.scale;
    const height = plot.height * this.layout.scale;

    return {
      x: this.layout.originX + plot.x * this.layout.width - width / 2,
      y: this.layout.originY + plot.y * this.layout.height - height / 2,
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

  private getPopulation(state: GameState): number {
    const buildingWorkers = Object.values(state.buildings)
      .reduce((total, building) => total + building.workers, 0);
    const constructionWorkers = Object.values(state.buildings)
      .reduce((total, building) => total + building.constructionWorkers, 0);
    const expeditionTroops = state.expeditions
      .reduce((total, expedition) => total + expedition.survivors, 0);

    return state.survivors.workers +
      state.survivors.troops +
      buildingWorkers +
      constructionWorkers +
      expeditionTroops +
      state.health.injured;
  }

  private getDefenseScore(state: GameState): number {
    return state.survivors.troops * 4 +
      state.buildings.watchtower.level * 12 +
      state.buildings.palisade.level * 9;
  }
}
