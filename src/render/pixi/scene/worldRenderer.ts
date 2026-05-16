import { Container, Graphics, Rectangle, Sprite } from "pixi.js";
import { buildingById } from "../../../data/buildings";
import {
  buildingVisualDefinitions,
  type BuildingVisualFitDefinition,
  type BuildingVisualPlacementDefinition,
} from "../../../data/buildingVisuals";
import {
  type VillageMapObjectDefinition,
  type VillageObjectLayerDefinition,
  type VillageLayoutDefinition,
} from "../../../data/villageLayouts";
import type {
  VillagePlotDefinition,
  VillageResourceSiteDefinition,
  VillageResourceSitePalisadeType,
} from "../../../data/villagePlots";
import type { BuildingId, EnvironmentConditionId, GameState } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getBuildingWorkerLimit, isBuildingInactiveDueToCoal } from "../../../systems/buildings";
import { uiTextSize, uiTheme, VILLAGE_BUILDING_RENDER_SCALE } from "../core/constants";
import type { Bounds, DrawTextFn, DrawIconFn, SceneLayout } from "../core/types";
import { upgradingTooltip } from "../core/constants";
import { getMapRenderBounds } from "./mapGeometry";

const DEFAULT_BUILDING_VISUAL_PLACEMENT: Required<BuildingVisualPlacementDefinition> = {
  anchor: { x: 0.5, y: 0.78 },
  offset: { x: 0, y: 18 },
};

const DEFAULT_BUILDING_VISUAL_FIT: Required<BuildingVisualFitDefinition> = {
  footprintWidthScale: VILLAGE_BUILDING_RENDER_SCALE * 1.08,
  visualHeightScale: VILLAGE_BUILDING_RENDER_SCALE * 2.9,
};

const TERRAIN_CHUNK_SPRITE_LIMIT = 24;
const EMPTY_PLOT_FILL = 0x181a12;
const EMPTY_PLOT_STROKE = 0xd6bd6e;
const EMPTY_PLOT_SELECTED_STROKE = 0xf3c85f;
const FOOTPRINT_SHADOW_COLOR = 0x050604;
type BuildingLotSpec = {
  widthScale: number;
  heightRatio: number;
  groundYOffset: number;
};

export type WorldRenderHost = {
  cameraStaticLayer: Container;
  cameraForegroundDecorLayer: Container;
  cameraDynamicLayer: Container;
  backgroundLayer: Container;
  mapLayout: VillageLayoutDefinition;
  layout: SceneLayout;
  activeModalPlotId: string | null;
  drawIcon: DrawIconFn;
  drawText: DrawTextFn;
  bindTooltip: (target: Container, text: string) => void;
  createTerrainSprite: (textureKey: string) => Sprite | null;
  createResourceSiteSettlementSprite: (type: VillageResourceSitePalisadeType) => Sprite | null;
  trackTerrainSprite: (
    sprite: Sprite,
    tintByEnvironment?: Partial<Record<EnvironmentConditionId, number>>,
  ) => void;
  createBuildingSprite: (buildingId: BuildingId, level: number, built: boolean) => Sprite;
  fitSprite: (sprite: Sprite, maxWidth: number, maxHeight: number) => void;
  getPlotBounds: (plot: Pick<VillagePlotDefinition, "x" | "y" | "width" | "height">) => Bounds;
  drawBuildingWorkerBadge: (
    parent: Container,
    buildingId: BuildingId,
    workers: number,
    workerLimit: number,
    bounds: Bounds,
    translations?: TranslationPack,
  ) => void;
  drawConstructionCountdown: (
    parent: Container,
    remainingSeconds: number,
    x: number,
    y: number,
    width: number,
    translations?: TranslationPack,
  ) => void;
  drawPowerWarning: (parent: Container, bounds: Bounds) => void;
};

export function drawBackground(host: WorldRenderHost, width: number, height: number): void {
  const base = new Graphics();
  base.rect(0, 0, width, height).fill({ color: 0x151812, alpha: 1 });
  host.backgroundLayer.addChild(base);

  const overlay = new Graphics();
  overlay.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.08 });
  host.backgroundLayer.addChild(overlay);
}

export function drawTerrain(host: WorldRenderHost): void {
  const layout = host.mapLayout;
  const scale = host.layout.scale;
  const mapBounds = getMapRenderBounds(layout, host.layout);

  for (const layer of layout.tileLayers) {
    let chunk = createTerrainChunk();

    for (const tile of layer.tiles) {
      if (chunk.spriteCount >= TERRAIN_CHUNK_SPRITE_LIMIT) {
        addTerrainChunk(host.cameraStaticLayer, chunk);
        chunk = createTerrainChunk();
      }

      const tileX = mapBounds.x + tile.x * scale;
      const tileY = mapBounds.y + tile.y * scale;
      const sprite = host.createTerrainSprite(tile.textureKey);

      if (!sprite) {
        continue;
      }
      const tileDefinition = layout.tileTextures[tile.textureKey];
      const tileWidth = tileDefinition.frame.width * scale;
      const tileHeight = tileDefinition.frame.height * scale;
      const edgeOverscan = tileDefinition.edgeOverscan;
      const offsetX = tileDefinition.tileLayerOffset.x * scale;
      const offsetY = tileDefinition.tileLayerOffset.y * scale;
      const drawX = tileX + offsetX;
      const drawY = tileY + offsetY;
      const drawWidth = tileWidth + edgeOverscan;
      const drawHeight = tileHeight + edgeOverscan;
      host.trackTerrainSprite(sprite, tileDefinition.tintByEnvironment);
      sprite.alpha = layer.opacity;
      sprite.roundPixels = true;
      sprite.cullable = false;

      if (tile.rotation || tile.flipX || tile.flipY) {
        sprite.anchor.set(0.5);
        sprite.rotation = ((tile.rotation ?? 0) * Math.PI) / 180;
        sprite.x = drawX + tileWidth / 2;
        sprite.y = drawY + tileHeight / 2;
        sprite.scale.set(
          (tile.flipX ? -1 : 1) * (drawWidth / sprite.texture.width),
          (tile.flipY ? -1 : 1) * (drawHeight / sprite.texture.height),
        );
      } else {
        sprite.x = drawX;
        sprite.y = drawY;
        sprite.width = drawWidth;
        sprite.height = drawHeight;
      }

      chunk.container.addChild(sprite);
      expandTerrainChunkBounds(chunk, drawX, drawY, drawWidth, drawHeight);
    }

    addTerrainChunk(host.cameraStaticLayer, chunk);
  }
}

export function drawDecorObjects(host: WorldRenderHost, renderBand: "base" | "foreground" = "base"): void {
  const layout = host.mapLayout;
  const scale = host.layout.scale;
  const mapBounds = getMapRenderBounds(layout, host.layout);

  for (const layer of layout.objectLayers) {
    if (!layer.isStaticVisualLayer || layer.renderBand !== renderBand) {
      continue;
    }

    const objects = getObjectDrawOrder(layer);

    for (const object of objects) {
      if (!object.textureKey) {
        continue;
      }

      const render = object.render;
      const objectX = mapBounds.x + render.x * scale;
      const objectY = mapBounds.y + render.y * scale;
      const objectWidth = render.width * scale;
      const objectHeight = render.height * scale;
      const sprite = host.createTerrainSprite(object.textureKey);

      if (!sprite) {
        continue;
      }

      if (!render.anchor) {
        throw new Error(`Map object "${object.id}" has a texture but no render anchor.`);
      }

      sprite.anchor.set(render.anchor.x, render.anchor.y);
      sprite.x = objectX;
      sprite.y = objectY;
      sprite.width = objectWidth;
      sprite.height = objectHeight;
      sprite.rotation = (render.rotation * Math.PI) / 180;
      if (render.flipX) {
        sprite.scale.x *= -1;
      }
      if (render.flipY) {
        sprite.scale.y *= -1;
      }
      sprite.alpha = render.opacity * layer.opacity;
      sprite.cullable = true;
      const targetLayer = renderBand === "foreground"
        ? host.cameraForegroundDecorLayer
        : host.cameraStaticLayer;
      targetLayer.addChild(sprite);
    }
  }
}

function getObjectDrawOrder(layer: VillageObjectLayerDefinition): VillageMapObjectDefinition[] {
  if (layer.drawOrder === "index") {
    return layer.objects;
  }

  return [...layer.objects].sort((left, right) => left.render.y - right.render.y);
}

export function drawResourceSites(host: WorldRenderHost, state: GameState, translations?: TranslationPack): void {
  for (const siteDefinition of host.mapLayout.resourceSites) {
    drawResourceSite(host, siteDefinition, state, translations);
  }
}

type TerrainChunk = {
  container: Container;
  spriteCount: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function createTerrainChunk(): TerrainChunk {
  const container = new Container();
  container.cullable = true;
  container.cullableChildren = false;
  container.eventMode = "none";

  return {
    container,
    spriteCount: 0,
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
}

function expandTerrainChunkBounds(
  chunk: TerrainChunk,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  chunk.spriteCount += 1;
  chunk.minX = Math.min(chunk.minX, x);
  chunk.minY = Math.min(chunk.minY, y);
  chunk.maxX = Math.max(chunk.maxX, x + width);
  chunk.maxY = Math.max(chunk.maxY, y + height);
}

function addTerrainChunk(parent: Container, chunk: TerrainChunk): void {
  if (chunk.spriteCount === 0) {
    chunk.container.destroy({ children: true });
    return;
  }

  chunk.container.cullArea = new Rectangle(
    chunk.minX,
    chunk.minY,
    Math.max(1, chunk.maxX - chunk.minX),
    Math.max(1, chunk.maxY - chunk.minY),
  );
  parent.addChild(chunk.container);
}

function drawResourceSite(
  host: WorldRenderHost,
  siteDefinition: VillageResourceSiteDefinition,
  state: GameState,
  translations?: TranslationPack,
): void {
  const siteState = state.resourceSites.find((candidate) => candidate.id === siteDefinition.id);
  if (!siteState) {
    return;
  }

  const bounds = host.getPlotBounds(siteDefinition);
  const selected = host.activeModalPlotId === siteDefinition.id;
  const settlementVisual = getResourceSiteSettlementVisual(bounds);
  const layer = new Container();
  layer.x = bounds.x + bounds.width / 2;
  layer.y = bounds.y + bounds.height / 2 + settlementVisual.offsetY;
  layer.hitArea = {
    contains: (x: number, y: number) =>
      x >= -settlementVisual.width / 2 &&
      x <= settlementVisual.width / 2 &&
      y >= -settlementVisual.height / 2 &&
      y <= settlementVisual.height / 2,
  };
  host.cameraDynamicLayer.addChild(layer);

  const isLooted = siteState.looted;
  const isAssault = Boolean(siteState.assault);
  drawResourceSiteSettlement(
    host,
    layer,
    settlementVisual.width,
    settlementVisual.height,
    siteDefinition.palisadeType,
    selected,
    isLooted,
    isAssault,
  );

  if (siteState.assault) {
    host.drawConstructionCountdown(
      layer,
      siteState.assault.remainingSeconds,
      0,
      -settlementVisual.height * 0.65 - 24,
      Math.max(96, settlementVisual.width * 0.7),
      undefined,
    );
  }

  const siteName = translations?.ui.resourceSiteTitle ?? "Settlement";
  const tooltip = siteState.assault
    ? `${siteName} / ${translations?.ui.resourceSiteStatusAssault ?? "Assault in progress"}`
    : siteState.looted
      ? `${siteName} / ${translations?.ui.resourceSiteStatusLooted ?? "Looted"}`
      : `${siteName} / ${translations?.ui.resourceSiteStatusLocked ?? "Locked"}`;
  host.bindTooltip(layer, tooltip);
}

function getResourceSiteSettlementVisual(bounds: Bounds): { width: number; height: number; offsetY: number } {
  return {
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height),
    offsetY: 0,
  };
}

function drawResourceSiteSettlement(
  host: WorldRenderHost,
  parent: Container,
  width: number,
  height: number,
  palisadeType: VillageResourceSitePalisadeType,
  selected: boolean,
  isLooted: boolean,
  isAssault: boolean,
): void {
  const sprite = host.createResourceSiteSettlementSprite(palisadeType);
  if (sprite) {
    sprite.anchor.set(0.5);
    sprite.width = width;
    sprite.height = height;
    sprite.alpha = isLooted ? 0.72 : 1;
    sprite.tint = isLooted
      ? 0x91a08a
      : isAssault
        ? 0xffd69a
        : selected
          ? 0xfff0c7
          : 0xffffff;
    parent.addChild(sprite);
  }

  if (isAssault) {
    const alert = new Graphics();
    alert.circle(width * 0.34, -height * 0.5, Math.max(4, width * 0.05))
      .fill({ color: uiTheme.warning, alpha: 0.9 });
    parent.addChild(alert);
  }
}

export function drawPlot(
  host: WorldRenderHost,
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
  const bounds = host.getPlotBounds(plot);
  const selected = state.village.selectedPlotId === plot.id;
  const isMainPlot = plot.allowedBuildingIds?.includes("mainBuilding") ?? false;
  const hasBuilding = Boolean(buildingId && building);
  const buildingLot = buildingId && hasBuilding ? getBuildingLotSpec(buildingId, isMainPlot) : null;
  const hitWidth = buildingLot ? bounds.width * (buildingLot.widthScale + 0.2) : bounds.width;
  const hitHeight = buildingLot ? hitWidth * buildingLot.heightRatio * 1.18 : bounds.height;

  const plotLayer = new Container();
  plotLayer.x = bounds.x + bounds.width / 2;
  plotLayer.y = bounds.y + bounds.height / 2;
  plotLayer.hitArea = {
    contains: (x: number, y: number) =>
      x >= -hitWidth / 2 &&
      x <= hitWidth / 2 &&
      y >= -hitHeight / 2 &&
      y <= hitHeight / 2,
  };
  host.cameraDynamicLayer.addChild(plotLayer);

  if (buildingId && building) {
    host.bindTooltip(plotLayer, upgradingTooltip(name, building.level, building.upgradingRemaining, translations?.ui.level ?? "Lvl"));

    const built = building.level > 0;
    const visual = built ? buildingVisualDefinitions[buildingId] : null;
    const placement = resolveBuildingVisualPlacement(visual?.placement);
    const fit = resolveBuildingVisualFit(visual?.fit);
    const asset = host.createBuildingSprite(buildingId, Math.max(1, building.level), built);
    drawBuildingFootprint(plotLayer, buildingId, bounds, selected, isMainPlot);
    asset.anchor.set(placement.anchor.x, placement.anchor.y);
    asset.x = placement.offset.x * host.layout.scale;
    asset.y = placement.offset.y * host.layout.scale;
    host.fitSprite(
      asset,
      bounds.width * fit.footprintWidthScale,
      bounds.height * fit.visualHeightScale,
    );
    asset.alpha = built || isMainPlot ? 1 : 0.62;
    drawBuildingSpriteShadow(host, plotLayer, buildingId, Math.max(1, building.level), built, asset, bounds, isMainPlot);
    plotLayer.addChild(asset);

    if (isBuildingInactiveDueToCoal(state, buildingId)) {
      host.drawPowerWarning(plotLayer, bounds);
    }
    host.drawBuildingWorkerBadge(plotLayer, buildingId, building.workers, getBuildingWorkerLimit(state, buildingId), bounds, translations);
    if (building.upgradingRemaining > 0) {
      host.drawConstructionCountdown(
        plotLayer,
        building.upgradingRemaining,
        0,
        -bounds.height * 0.44,
        Math.max(64, Math.min(92, bounds.width * 0.82)),
        translations,
      );
    }
    return;
  }

  host.bindTooltip(plotLayer, translations?.ui.emptyPlot ?? "Empty plot");
  drawEmptyPlotMarker(host, plotLayer, bounds, selected);
}

function drawBuildingFootprint(
  parent: Container,
  buildingId: BuildingId,
  bounds: Bounds,
  selected: boolean,
  isMainPlot: boolean,
): void {
  const lot = getBuildingLotSpec(buildingId, isMainPlot);
  const width = Math.max(isMainPlot ? 150 : 94, bounds.width * lot.widthScale);
  const height = Math.max(isMainPlot ? 66 : 42, width * lot.heightRatio);
  const groundY = bounds.height * lot.groundYOffset;

  if (!selected) {
    return;
  }

  const ring = new Graphics();
  ring.y = groundY + height * 0.08;
  drawDiamond(ring, width * 1.07, height * 1.08)
    .stroke({ color: EMPTY_PLOT_SELECTED_STROKE, alpha: 0.7, width: isMainPlot ? 2 : 1.8 });
  parent.addChild(ring);
}

function getBuildingLotSpec(buildingId: BuildingId, isMainPlot: boolean): BuildingLotSpec {
  if (isMainPlot) {
    return {
      widthScale: 2.55,
      heightRatio: 0.48,
      groundYOffset: 0.25,
    };
  }

  return getBuildingLotShape(buildingId);
}

function getBuildingLotShape(
  buildingId: BuildingId,
): BuildingLotSpec {
  switch (buildingId) {
    case "academy":
      return { widthScale: 2.16, heightRatio: 0.42, groundYOffset: 0.26 };
    case "barracks":
      return { widthScale: 2.08, heightRatio: 0.44, groundYOffset: 0.25 };
    case "clinic":
      return { widthScale: 1.82, heightRatio: 0.48, groundYOffset: 0.25 };
    case "dormitory":
      return { widthScale: 2.22, heightRatio: 0.42, groundYOffset: 0.25 };
    case "coalMine":
      return { widthScale: 1.68, heightRatio: 0.48, groundYOffset: 0.26 };
    case "hydroponics":
      return { widthScale: 2.02, heightRatio: 0.44, groundYOffset: 0.25 };
    case "market":
      return { widthScale: 2.24, heightRatio: 0.38, groundYOffset: 0.24 };
    case "storage":
      return { widthScale: 2.06, heightRatio: 0.43, groundYOffset: 0.25 };
    case "watchtower":
      return { widthScale: 1.28, heightRatio: 0.56, groundYOffset: 0.28 };
    case "waterStill":
      return { widthScale: 1.9, heightRatio: 0.46, groundYOffset: 0.25 };
    case "workshop":
      return { widthScale: 2.12, heightRatio: 0.43, groundYOffset: 0.25 };
    default:
      return { widthScale: 1.9, heightRatio: 0.44, groundYOffset: 0.25 };
  }
}

function drawBuildingSpriteShadow(
  host: WorldRenderHost,
  parent: Container,
  buildingId: BuildingId,
  level: number,
  built: boolean,
  source: Sprite,
  bounds: Bounds,
  isMainPlot: boolean,
): void {
  const shadow = host.createBuildingSprite(buildingId, level, built);
  shadow.anchor.copyFrom(source.anchor);
  shadow.position.set(
    source.x + Math.max(4, bounds.width * 0.055),
    source.y + Math.max(5, bounds.height * 0.06),
  );
  shadow.scale.set(source.scale.x * 1.01, source.scale.y * 1.01);
  shadow.tint = FOOTPRINT_SHADOW_COLOR;
  shadow.alpha = isMainPlot ? 0.14 : 0.27;
  parent.addChild(shadow);
}

function drawEmptyPlotMarker(
  host: WorldRenderHost,
  parent: Container,
  bounds: Bounds,
  selected: boolean,
): void {
  const footprintWidth = Math.max(34, Math.min(bounds.width * 0.6, bounds.height * 0.9));
  const footprintHeight = Math.max(18, footprintWidth * 0.46);
  const markerY = bounds.height * 0.04;
  const strokeColor = selected ? EMPTY_PLOT_SELECTED_STROKE : EMPTY_PLOT_STROKE;

  const pad = new Graphics();
  pad.y = markerY;
  drawDiamond(pad, footprintWidth, footprintHeight)
    .fill({ color: EMPTY_PLOT_FILL, alpha: selected ? 0.34 : 0.2 })
    .stroke({ color: strokeColor, alpha: selected ? 0.92 : 0.44, width: selected ? 2.4 : 1.6 });
  parent.addChild(pad);

  const corners = new Graphics();
  corners.y = markerY;
  drawPlotCornerMarks(corners, footprintWidth, footprintHeight, selected);
  parent.addChild(corners);

  const addMarker = host.drawIcon(parent, "plus", 0, markerY, Math.max(12, footprintHeight * 0.72));
  addMarker.alpha = selected ? 0.9 : 0.5;
}

function drawDiamond(graphic: Graphics, width: number, height: number): Graphics {
  return graphic.poly([
    0,
    -height / 2,
    width / 2,
    0,
    0,
    height / 2,
    -width / 2,
    0,
  ]);
}

function drawPlotCornerMarks(
  graphic: Graphics,
  width: number,
  height: number,
  selected: boolean,
  color = selected ? EMPTY_PLOT_SELECTED_STROKE : EMPTY_PLOT_STROKE,
): void {
  const cornerLength = Math.max(5, Math.min(11, width * 0.12));
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const insetX = width * 0.18;
  const insetY = height * 0.2;
  const alpha = selected ? 0.9 : 0.48;
  const strokeWidth = selected ? 2.2 : 1.4;
  const points = [
    { x: -halfWidth + insetX, y: -insetY, sx: 1, sy: -1 },
    { x: halfWidth - insetX, y: -insetY, sx: -1, sy: -1 },
    { x: halfWidth - insetX, y: insetY, sx: -1, sy: 1 },
    { x: -halfWidth + insetX, y: insetY, sx: 1, sy: 1 },
  ];

  for (const point of points) {
    graphic.moveTo(point.x, point.y + point.sy * cornerLength);
    graphic.lineTo(point.x, point.y);
    graphic.lineTo(point.x + point.sx * cornerLength, point.y);
  }

  graphic.stroke({
    color,
    alpha,
    width: strokeWidth,
  });
}

function resolveBuildingVisualPlacement(
  placement: BuildingVisualPlacementDefinition | undefined,
): Required<BuildingVisualPlacementDefinition> {
  return {
    anchor: placement?.anchor ?? DEFAULT_BUILDING_VISUAL_PLACEMENT.anchor,
    offset: placement?.offset ?? DEFAULT_BUILDING_VISUAL_PLACEMENT.offset,
  };
}

function resolveBuildingVisualFit(
  fit: BuildingVisualFitDefinition | undefined,
): Required<BuildingVisualFitDefinition> {
  return {
    footprintWidthScale: fit?.footprintWidthScale ?? DEFAULT_BUILDING_VISUAL_FIT.footprintWidthScale,
    visualHeightScale: fit?.visualHeightScale ?? DEFAULT_BUILDING_VISUAL_FIT.visualHeightScale,
  };
}

