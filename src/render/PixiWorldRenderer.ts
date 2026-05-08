import {
  Application,
  Container,
  Graphics,
  Text,
  type TextStyleFontWeight,
} from "pixi.js";
import { tileById } from "../data/mapTiles";
import { resourceDefinitions } from "../data/resources";
import { formatGameClock, getGameDay } from "../game/time";
import type { GameSpeed, GameState, MapSector, ResourceId } from "../game/types";
import type { TranslationPack } from "../i18n/types";
import { getDefenseScore, getResourceProductionRates } from "../systems/buildings";
import { getExpeditionSupplyCost } from "../systems/expeditions";
import { canAfford } from "../systems/resources";
import { drawPixiIcon } from "./pixiIcons";

type PixiActionDetail = {
  action?: string;
  sector?: string;
  speed?: GameSpeed;
  view?: "village" | "world";
};

type PixiTooltipDetail = {
  visible: boolean;
  text?: string;
  x?: number;
  y?: number;
};

const TILE_SIZE = 54;
const TILE_GAP = 4;

export class PixiWorldRenderer {
  private app: Application | null = null;
  private readonly rootLayer = new Container();
  private readonly worldLayer = new Container();
  private readonly hudLayer = new Container();
  private originX = 0;
  private originY = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly requestRender: () => void = () => {},
  ) {
    this.rootLayer.addChild(this.worldLayer, this.hudLayer);
    void this.initialize();
  }

  render(state: GameState, translations: TranslationPack): void {
    if (!this.app) {
      return;
    }

    const width = this.host.clientWidth;
    const height = this.host.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    this.worldLayer.removeChildren();
    this.hudLayer.removeChildren();
    this.drawBackground(width, height);
    this.drawMap(state, width, height);
    this.drawHud(state, translations, width, height);
    this.drawSectorPanel(state, translations, width);
  }

  hitTest(clientX: number, clientY: number, state: GameState): MapSector | null {
    const rect = this.host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return state.map.sectors.find((sector) => {
      const bounds = this.getSectorBounds(sector);
      return x >= bounds.x &&
        x <= bounds.x + TILE_SIZE &&
        y >= bounds.y &&
        y <= bounds.y + TILE_SIZE;
    }) ?? null;
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
    this.requestRender();
  }

  private drawBackground(width: number, height: number): void {
    const background = new Graphics();
    background.rect(0, 0, width, height).fill({ color: 0x171b20 });
    this.worldLayer.addChild(background);

    const grid = new Graphics();
    for (let x = 0; x < width; x += 28) {
      grid.moveTo(x, 0).lineTo(x, height);
    }
    for (let y = 0; y < height; y += 28) {
      grid.moveTo(0, y).lineTo(width, y);
    }
    grid.stroke({ color: 0xffffff, alpha: 0.035, width: 1 });
    this.worldLayer.addChild(grid);
  }

  private drawMap(state: GameState, width: number, height: number): void {
    const mapWidth = state.map.width * TILE_SIZE + (state.map.width - 1) * TILE_GAP;
    const mapHeight = state.map.height * TILE_SIZE + (state.map.height - 1) * TILE_GAP;
    this.originX = Math.max(26, (width - mapWidth - 210) / 2);
    this.originY = Math.max(118, (height - mapHeight) / 2);

    for (const sector of state.map.sectors) {
      this.drawSector(sector, sector.id === state.map.selectedSectorId);
    }
  }

  private drawSector(sector: MapSector, selected: boolean): void {
    const bounds = this.getSectorBounds(sector);
    const tile = tileById[sector.kind];
    const tileLayer = new Container();
    tileLayer.x = bounds.x;
    tileLayer.y = bounds.y;
    this.worldLayer.addChild(tileLayer);

    const tileBox = new Graphics();
    tileBox
      .roundRect(0, 0, TILE_SIZE, TILE_SIZE, 7)
      .fill({ color: sector.revealed ? hexToNumber(tile.color) : 0x25282e })
      .stroke({
        color: selected ? 0xf6e58d : sector.revealed ? 0x2c3337 : 0x30343c,
        width: selected ? 3 : 1,
      });
    tileLayer.addChild(tileBox);

    if (!sector.revealed) {
      return;
    }

    const accent = new Graphics();
    accent
      .circle(TILE_SIZE / 2, TILE_SIZE / 2, sector.kind === "base" ? 12 : 7)
      .fill({ color: hexToNumber(tile.accent), alpha: sector.scouted ? 0.88 : 0.46 });
    tileLayer.addChild(accent);

    if (sector.threat > 0 && sector.kind !== "base") {
      const threat = new Graphics()
        .rect(7, TILE_SIZE - 10, (TILE_SIZE - 14) * (sector.threat / 100), 3)
        .fill({ color: 0xf07178 });
      tileLayer.addChild(threat);
    }

    if (Object.keys(sector.loot).length > 0 && sector.kind !== "base") {
      const loot = new Graphics()
        .rect(TILE_SIZE - 13, 7, 6, 6)
        .fill({ color: 0xf2d785 });
      tileLayer.addChild(loot);
    }
  }

  private drawHud(state: GameState, translations: TranslationPack, width: number, height: number): void {
    const day = getGameDay(state.elapsedSeconds);
    const clock = formatGameClock(state.elapsedSeconds);
    const population = this.getPopulation(state);

    this.drawBrand(translations.ui.menuTitle, translations.ui.subtitle);
    this.drawTopPills([
      ["day", `${translations.ui.day} ${day} / ${clock}`, translations.ui.dayTooltip],
      ["people", `${population}`, translations.ui.populationTooltip],
      ["shield", `${Math.round(getDefenseScore(state))}`, translations.ui.defenseTooltip],
      ["morale", `${Math.floor(state.resources.morale)}%`, `${translations.resources.morale}: ${translations.resourceDescriptions.morale}`],
    ], width);
    this.drawResourcePills(state, translations, width);
    this.drawViewTabs(translations);
    this.drawProduction(state, translations);
    this.drawToolbar(state, translations, width, height);
  }

  private drawBrand(title: string, subtitle: string): void {
    const layer = new Container();
    layer.x = 28;
    layer.y = 22;
    this.hudLayer.addChild(layer);

    this.drawPanel(layer, 0, 0, 52, 52);
    drawPixiIcon(layer, "scout", 26, 26, 28);
    this.drawText(layer, title.toUpperCase(), 64, 4, { fill: 0xf5efdf, fontSize: 33, fontWeight: "900" });
    this.drawText(layer, subtitle, 64, 40, { fill: 0xd8c890, fontSize: 12, fontWeight: "700" });
  }

  private drawTopPills(items: Array<[string, string, string]>, width: number): void {
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

  private drawResourcePills(state: GameState, translations: TranslationPack, width: number): void {
    const group = new Container();
    group.y = 30;
    this.hudLayer.addChild(group);
    let x = 0;

    for (const resource of resourceDefinitions.filter((definition) => definition.id !== "morale")) {
      const label = `${Math.floor(state.resources[resource.id])}/${Math.floor(state.capacities[resource.id])}`;
      const pill = this.createPill(label, resource.id, `${translations.resources[resource.id]}: ${translations.resourceDescriptions[resource.id]}`);
      pill.x = x;
      group.addChild(pill);
      x += pill.width + 8;
    }

    group.x = Math.max(28, width - x - 28);
  }

  private drawViewTabs(translations: TranslationPack): void {
    const group = new Container();
    group.x = 28;
    group.y = 94;
    this.hudLayer.addChild(group);
    this.createHudButton(group, translations.ui.village, 0, 0, 90, 42, { view: "village" });
    this.createHudButton(group, translations.ui.worldMap, 98, 0, 116, 42, { view: "world" }, true);
  }

  private drawProduction(state: GameState, translations: TranslationPack): void {
    const rates = getResourceProductionRates(state);
    const layer = new Container();
    layer.x = 28;
    layer.y = 152;
    this.hudLayer.addChild(layer);
    this.drawPanel(layer, 0, 0, 308, 152);
    drawPixiIcon(layer, "build", 18, 80, 14);
    this.drawText(layer, translations.ui.production, 34, 72, { fill: 0xf3edda, fontSize: 12, fontWeight: "800" });
    this.bindTooltip(layer, translations.ui.productionTooltip);
    this.drawText(layer, translations.ui.resource, 114, 18, { fill: 0xaeb4b8, fontSize: 11, fontWeight: "800" });
    this.drawText(layer, translations.ui.stock, 216, 18, { fill: 0xaeb4b8, fontSize: 11, fontWeight: "800" });
    this.drawText(layer, translations.ui.perMinute, 258, 18, { fill: 0xaeb4b8, fontSize: 11, fontWeight: "800" });

    resourceDefinitions.forEach((resource, index) => {
      const y = 42 + index * 20;
      const perMinute = rates[resource.id] * 60;
      const stock = resource.id === "morale"
        ? `${Math.floor(state.resources[resource.id])}%`
        : `${Math.floor(state.resources[resource.id])}/${Math.floor(state.capacities[resource.id])}`;
      const rateColor = perMinute > 0.004 ? 0x8fe0b8 : perMinute < -0.004 ? 0xff9aa2 : 0xaeb4b8;
      const resourceCell = new Container();
      resourceCell.x = 114;
      resourceCell.y = y - 1;
      layer.addChild(resourceCell);
      drawPixiIcon(resourceCell, resource.id, 6, 8, 13);
      this.bindTooltip(resourceCell, `${translations.resources[resource.id]}: ${translations.resourceDescriptions[resource.id]}`);
      this.drawText(layer, translations.resources[resource.id], 130, y, { fill: 0xd7ddd8, fontSize: 11 });
      this.drawText(layer, stock, 216, y, { fill: 0xd7ddd8, fontSize: 11 });
      this.drawText(layer, `${perMinute > 0 ? "+" : ""}${this.formatRate(perMinute)}`, 268, y, { fill: rateColor, fontSize: 11, fontWeight: "700" });
    });
  }

  private drawToolbar(state: GameState, translations: TranslationPack, width: number, height: number): void {
    const group = new Container();
    group.x = width - 318;
    group.y = height - 72;
    this.hudLayer.addChild(group);
    this.drawPanel(group, 0, 0, 290, 48);
    this.createIconButton(group, state.paused ? "play" : "pause", 8, 8, 40, 32, { action: "pause" }, state.paused ? translations.ui.resume : translations.ui.pause);
    this.createHudButton(group, translations.ui.speedNormal, 56, 8, 44, 32, { speed: 1 }, state.speed === 1);
    this.createHudButton(group, translations.ui.speedFast, 108, 8, 52, 32, { speed: 8 }, state.speed === 8);
    this.createIconButton(group, "save", 168, 8, 40, 32, { action: "save" }, translations.ui.save);
    this.createIconButton(group, "load", 216, 8, 32, 32, { action: "load" }, translations.ui.load);
    this.createIconButton(group, "reset", 256, 8, 26, 32, { action: "reset" }, translations.ui.reset);
  }

  private drawSectorPanel(state: GameState, translations: TranslationPack, width: number): void {
    const sector = state.map.sectors.find((candidate) => candidate.id === state.map.selectedSectorId);

    if (!sector) {
      return;
    }

    const panel = new Container();
    panel.x = width - 360;
    panel.y = 106;
    this.hudLayer.addChild(panel);
    this.drawPanel(panel, 0, 0, 330, 250);

    if (!sector.revealed) {
      this.drawText(panel, translations.ui.unknownSector, 16, 18, { fill: 0xf5efdf, fontSize: 18, fontWeight: "900" });
      this.drawText(panel, translations.ui.unknownSectorText, 16, 52, { fill: 0xaeb4b8, fontSize: 13, wordWrap: true, wordWrapWidth: 280 });
      return;
    }

    const hasLoot = Object.keys(sector.loot).length > 0;
    const hasExpeditionTroops = state.survivors.troops >= 2;
    const supplyCost = getExpeditionSupplyCost(state, sector);
    const hasSupplies = canAfford(state.resources, supplyCost);
    const canSend = sector.kind !== "base" && hasLoot && hasExpeditionTroops && hasSupplies;

    this.drawText(panel, translations.tiles[sector.kind], 16, 18, { fill: 0xf5efdf, fontSize: 18, fontWeight: "900" });
    this.drawText(panel, `${sector.id} / ${translations.ui.threat} ${Math.round(sector.threat)}%`, 16, 48, { fill: 0xaeb4b8, fontSize: 12 });
    this.drawText(panel, hasLoot ? this.formatResourceBag(sector.loot, translations) : translations.ui.noLoot, 16, 82, { fill: 0xf1df9a, fontSize: 13, wordWrap: true, wordWrapWidth: 286 });

    if (sector.kind !== "base") {
      this.drawText(panel, `${translations.ui.expeditionSupplies}: ${this.formatResourceBag(supplyCost, translations)}`, 16, 124, { fill: 0xd7ddd8, fontSize: 12, wordWrap: true, wordWrapWidth: 286 });
      if (!hasExpeditionTroops) {
        this.drawText(panel, translations.ui.needTroops, 16, 154, { fill: 0xff9aa2, fontSize: 12, wordWrap: true, wordWrapWidth: 286 });
      } else if (!hasSupplies) {
        this.drawText(panel, translations.ui.needExpeditionSupplies, 16, 154, { fill: 0xff9aa2, fontSize: 12, wordWrap: true, wordWrapWidth: 286 });
      }
      this.createHudButton(panel, translations.ui.sendExpedition, 16, 196, 180, 36, { action: "expedition", sector: sector.id }, false, !canSend);
    }
  }

  private createPill(label: string, iconId: string, tooltip: string): Container {
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
    drawPixiIcon(group, iconId, 17, 17, 16);
    text.x = 32;
    text.y = 7;
    group.addChild(text);
    this.bindTooltip(group, tooltip);
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
    disabled = false,
  ): Container {
    const button = new Container();
    button.x = x;
    button.y = y;
    const box = new Graphics();
    box.roundRect(0, 0, width, height, 7)
      .fill({ color: active ? 0xe0c46f : 0x2d2f23, alpha: disabled ? 0.42 : active ? 1 : 0.84 })
      .stroke({ color: 0xe0c46f, alpha: active ? 0.6 : 0.18, width: 1 });
    button.addChild(box);
    this.drawCenteredText(button, label, width / 2, height / 2, {
      fill: active ? 0x141719 : 0xf4eedf,
      fontSize: 13,
      fontWeight: "700",
      alpha: disabled ? 0.52 : 1,
    });
    if (!disabled) {
      this.bindAction(button, detail);
    }
    parent.addChild(button);
    return button;
  }

  private createIconButton(parent: Container, iconId: string, x: number, y: number, width: number, height: number, detail: PixiActionDetail, tooltip?: string): Container {
    const button = new Container();
    button.x = x;
    button.y = y;
    const box = new Graphics();
    box.roundRect(0, 0, width, height, 7)
      .fill({ color: 0x2d2f23, alpha: 0.84 })
      .stroke({ color: 0xe0c46f, alpha: 0.18, width: 1 });
    button.addChild(box);
    drawPixiIcon(button, iconId, width / 2, height / 2, Math.min(width, height) - 14);
    this.bindAction(button, detail);
    if (tooltip) {
      this.bindTooltip(button, tooltip);
    }
    parent.addChild(button);
    return button;
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
    target.on("pointerover", (event) => this.emitTooltip(true, text, event.global.x, event.global.y));
    target.on("pointermove", (event) => this.emitTooltip(true, text, event.global.x, event.global.y));
    target.on("pointerout", () => this.emitTooltip(false));
  }

  private emitTooltip(visible: boolean, text?: string, x?: number, y?: number): void {
    this.host.dispatchEvent(new CustomEvent<PixiTooltipDetail>("pixi-tooltip", {
      detail: { visible, text, x, y },
    }));
  }

  private getSectorBounds(sector: MapSector): { x: number; y: number } {
    return {
      x: this.originX + sector.x * (TILE_SIZE + TILE_GAP),
      y: this.originY + sector.y * (TILE_SIZE + TILE_GAP),
    };
  }

  private drawCenteredText(parent: Container, text: string, x: number, y: number, options: {
    fill: number;
    fontSize: number;
    fontWeight?: TextStyleFontWeight;
    alpha?: number;
  }): Text {
    const label = this.drawText(parent, text, x, y, options);
    label.anchor.set(0.5);
    return label;
  }

  private drawText(parent: Container, text: string, x: number, y: number, options: {
    fill: number;
    fontSize: number;
    fontWeight?: TextStyleFontWeight;
    alpha?: number;
    wordWrap?: boolean;
    wordWrapWidth?: number;
  }): Text {
    const label = new Text({
      text,
      style: {
        fill: options.fill,
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: options.fontSize,
        fontWeight: options.fontWeight ?? "700",
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

  private formatResourceBag(bag: Partial<Record<ResourceId, number>>, translations: TranslationPack): string {
    return Object.entries(bag)
      .filter(([, amount]) => (amount ?? 0) > 0)
      .map(([resourceId, amount]) => `${translations.resources[resourceId as ResourceId]} ${Math.ceil(amount ?? 0)}`)
      .join(" / ");
  }

  private formatRate(value: number): string {
    if (Math.abs(value) >= 10) {
      return value.toFixed(0);
    }

    return value.toFixed(1);
  }

  private getPopulation(state: GameState): number {
    const buildingWorkers = Object.values(state.buildings).reduce((total, building) => total + building.workers, 0);
    const constructionWorkers = Object.values(state.buildings).reduce((total, building) => total + building.constructionWorkers, 0);
    const expeditionTroops = state.expeditions.reduce((total, expedition) => total + expedition.survivors, 0);
    return state.survivors.workers + state.survivors.troops + buildingWorkers + constructionWorkers + expeditionTroops + state.health.injured;
  }
}

function hexToNumber(value: string): number {
  return Number.parseInt(value.replace("#", ""), 16);
}
