import { Container, Graphics, Sprite } from "pixi.js";
import { buildingById } from "../../../data/buildings";
import {
  buildingVisualDefinitions,
  type BuildingVisualFitDefinition,
  type BuildingVisualPlacementDefinition,
} from "../../../data/buildingVisuals";
import {
  defaultVillageLayout,
  type VillageMapObjectDefinition,
  type VillageObjectLayerDefinition,
} from "../../../data/villageLayouts";
import type { VillagePlotDefinition, VillageResourceSiteDefinition } from "../../../data/villagePlots";
import type { BuildingId, EnvironmentConditionId, GameState } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getBuildingWorkerLimit, isBuildingInactiveDueToCoal } from "../../../systems/buildings";
import { VILLAGE_BUILDING_RENDER_SCALE, resourceSiteDefinitions } from "../core/constants";
import type { Bounds, DrawTextFn, DrawIconFn, SceneLayout } from "../core/types";
import { upgradingTooltip } from "../core/constants";
import { getMapRenderBounds } from "./mapGeometry";

const DEFAULT_BUILDING_VISUAL_PLACEMENT: Required<BuildingVisualPlacementDefinition> = {
  anchor: { x: 0.5, y: 0.5 },
  offset: { x: 0, y: 0 },
};

const DEFAULT_BUILDING_VISUAL_FIT: Required<BuildingVisualFitDefinition> = {
  footprintWidthScale: VILLAGE_BUILDING_RENDER_SCALE,
  visualHeightScale: VILLAGE_BUILDING_RENDER_SCALE * 4,
};

export type WorldRenderHost = {
  cameraStaticLayer: Container;
  cameraForegroundDecorLayer: Container;
  cameraDynamicLayer: Container;
  backgroundLayer: Container;
  layout: SceneLayout;
  activeModalPlotId: string | null;
  drawIcon: DrawIconFn;
  drawText: DrawTextFn;
  bindTooltip: (target: Container, text: string) => void;
  createTerrainSprite: (textureKey: string) => Sprite | null;
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
  const layout = defaultVillageLayout;
  const scale = host.layout.scale;
  const mapBounds = getMapRenderBounds(layout, host.layout);

  for (const layer of layout.tileLayers) {
    for (const tile of layer.tiles) {
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
      host.trackTerrainSprite(sprite, tileDefinition.tintByEnvironment);
      sprite.alpha = layer.opacity;
      sprite.roundPixels = true;

      if (tile.rotation || tile.flipX || tile.flipY) {
        sprite.anchor.set(0.5);
        sprite.rotation = ((tile.rotation ?? 0) * Math.PI) / 180;
        sprite.x = drawX + tileWidth / 2;
        sprite.y = drawY + tileHeight / 2;
        sprite.scale.set(
          (tile.flipX ? -1 : 1) * ((tileWidth + edgeOverscan) / sprite.texture.width),
          (tile.flipY ? -1 : 1) * ((tileHeight + edgeOverscan) / sprite.texture.height),
        );
      } else {
        sprite.x = drawX;
        sprite.y = drawY;
        sprite.width = tileWidth + edgeOverscan;
        sprite.height = tileHeight + edgeOverscan;
      }
      sprite.cullable = true;

      host.cameraStaticLayer.addChild(sprite);
    }
  }
}

export function drawDecorObjects(host: WorldRenderHost, renderBand: "base" | "foreground" = "base"): void {
  const layout = defaultVillageLayout;
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
  for (const siteDefinition of resourceSiteDefinitions) {
    drawResourceSite(host, siteDefinition, state, translations);
  }
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
  const layer = new Container();
  layer.x = bounds.x + bounds.width / 2;
  layer.y = bounds.y + bounds.height / 2;
  layer.hitArea = {
    contains: (x: number, y: number) =>
      x >= -bounds.width / 2 &&
      x <= bounds.width / 2 &&
      y >= -bounds.height / 2 &&
      y <= bounds.height / 2,
  };
  host.cameraDynamicLayer.addChild(layer);

  const ring = new Graphics();
  const radius = Math.max(16, Math.min(bounds.width, bounds.height) * 0.34);
  const isCaptured = siteState.captured;
  const isAssault = Boolean(siteState.assault);
  const fill = isCaptured ? 0x14322d : isAssault ? 0x3f2e18 : 0x2b1717;
  const stroke = isCaptured ? 0x9ed99b : isAssault ? 0xf1c17f : 0xd38a8a;
  ring.circle(0, 0, radius).fill({ color: fill, alpha: selected ? 0.78 : 0.58 }).stroke({
    color: stroke,
    alpha: selected ? 1 : 0.9,
    width: selected ? 3 : 2,
  });
  layer.addChild(ring);

  const resourceIcon = siteState.resourceId === "food"
    ? "food"
    : siteState.resourceId === "water"
      ? "water"
      : siteState.resourceId === "coal"
        ? "coal"
        : "material";
  host.drawIcon(layer, resourceIcon, 0, 0, Math.max(18, radius * 1.1));

  if (siteState.assault) {
    host.drawConstructionCountdown(layer, siteState.assault.remainingSeconds, 0, -radius - 24, Math.max(60, radius * 2.1), undefined);
  }

  if (siteState.captured) {
    host.drawText(layer, `${siteState.assignedWorkers}/${siteState.maxWorkers}`, -radius * 0.55, radius * 0.3, {
      fill: 0xe6f0e0,
      fontSize: 11,
      fontWeight: "900",
    });
    host.drawIcon(layer, "people", radius * 0.5, radius * 0.55, 14);
  }

  const resourceName = translations?.resources[siteState.resourceId] ?? siteState.resourceId;
  const tooltip = siteState.assault
    ? `${resourceName} / ${translations?.ui.resourceSiteStatusAssault ?? "Assault in progress"}`
    : siteState.captured
      ? `${resourceName} / ${translations?.ui.resourceSiteStatusCaptured ?? "Captured"}`
      : `${resourceName} / ${translations?.ui.resourceSiteStatusLocked ?? "Locked"}`;
  host.bindTooltip(layer, tooltip);
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
  host.cameraDynamicLayer.addChild(plotLayer);

  if (buildingId && building) {
    host.bindTooltip(plotLayer, upgradingTooltip(name, building.level, building.upgradingRemaining, translations?.ui.level ?? "Lvl"));

    const built = building.level > 0;
    const visual = built ? buildingVisualDefinitions[buildingId] : null;
    const placement = resolveBuildingVisualPlacement(visual?.placement);
    const fit = resolveBuildingVisualFit(visual?.fit);
    const asset = host.createBuildingSprite(buildingId, Math.max(1, building.level), built);
    asset.anchor.set(placement.anchor.x, placement.anchor.y);
    asset.x = placement.offset.x * host.layout.scale;
    asset.y = placement.offset.y * host.layout.scale;
    host.fitSprite(
      asset,
      bounds.width * fit.footprintWidthScale,
      bounds.height * fit.visualHeightScale,
    );
    asset.alpha = built || isMainPlot ? 1 : 0.62;
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
        -bounds.height * 0.72,
        Math.max(64, Math.min(92, bounds.width * 0.82)),
        translations,
      );
    }
    return;
  }

  host.bindTooltip(plotLayer, translations?.ui.emptyPlot ?? "Empty plot");
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
  plotLayer.addChild(empty);
  const addMarker = host.drawIcon(plotLayer, "plus", 0, 0, Math.max(14, markerSize * 0.78));
  addMarker.alpha = selected ? 0.95 : 0.58;
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

