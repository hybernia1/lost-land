import { Container, Graphics, Sprite } from "pixi.js";
import { buildingById } from "../../../data/buildings";
import { defaultVillageLayout } from "../../../data/villageLayouts";
import type { VillagePlotDefinition, VillageResourceSiteDefinition } from "../../../data/villagePlots";
import type { BuildingId, GameState } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getBuildingWorkerLimit, isBuildingInactiveDueToCoal } from "../../../systems/buildings";
import { VILLAGE_BUILDING_RENDER_SCALE, palisadePlotDefinition, resourceSiteDefinitions } from "../core/constants";
import type { Bounds, DrawTextFn, DrawIconFn, SceneLayout } from "../core/types";
import { upgradingTooltip } from "../core/constants";

type WorldRenderHost = {
  cameraStaticLayer: Container;
  cameraDynamicLayer: Container;
  backgroundLayer: Container;
  layout: SceneLayout;
  activeModalPlotId: string | null;
  drawIcon: DrawIconFn;
  drawText: DrawTextFn;
  bindTooltip: (target: Container, text: string) => void;
  createTerrainSprite: (textureKey: string) => Sprite | null;
  createBuildingSprite: (buildingId: BuildingId, level: number, built: boolean) => Sprite;
  fitSprite: (sprite: Sprite, maxWidth: number, maxHeight: number) => void;
  getPlotBounds: (plot: Pick<VillagePlotDefinition, "x" | "y" | "width" | "height">) => Bounds;
  addPalisadeTooltip: (
    plot: VillagePlotDefinition,
    selected: boolean,
    level: number,
    upgradingRemaining: number,
    name: string,
  ) => void;
  drawBuildingLevelBadge: (
    parent: Container,
    level: number,
    x: number,
    y: number,
    translations?: TranslationPack,
    buildingName?: string,
  ) => void;
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

export function drawTerrain(host: WorldRenderHost, state: GameState): void {
  const layout = defaultVillageLayout;
  const scale = host.layout.scale;
  const tileSize = layout.tileSize * scale;
  const terrainWidth = layout.width * scale;
  const terrainHeight = layout.height * scale;
  const originX = host.layout.originX + host.layout.width / 2 - terrainWidth / 2;
  const originY = host.layout.originY + host.layout.height / 2 - terrainHeight / 2;

  for (const layer of layout.tileLayers) {
    for (const tile of layer.tiles) {
      const tileX = originX + tile.x * tileSize;
      const tileY = originY + tile.y * tileSize;
      const sprite = host.createTerrainSprite(tile.textureKey);

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

      host.cameraStaticLayer.addChild(sprite);
    }
  }
}

export function drawDecorObjects(host: WorldRenderHost): void {
  const layout = defaultVillageLayout;
  const scale = host.layout.scale;
  const terrainWidth = layout.width * scale;
  const terrainHeight = layout.height * scale;
  const originX = host.layout.originX + host.layout.width / 2 - terrainWidth / 2;
  const originY = host.layout.originY + host.layout.height / 2 - terrainHeight / 2;

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
      const sprite = host.createTerrainSprite(object.textureKey);

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
      host.cameraStaticLayer.addChild(sprite);
    }
  }
}

export function drawPalisade(host: WorldRenderHost, state: GameState, translations?: TranslationPack): void {
  const plotDefinition = palisadePlotDefinition;
  if (!plotDefinition) {
    return;
  }

  const plotId = plotDefinition.id;
  const plot = state.village.plots.find((candidate) => candidate.id === plotId);
  const building = plot?.buildingId ? state.buildings[plot.buildingId] : null;
  const selected = state.village.selectedPlotId === plotId;

  const bounds = host.getPlotBounds(plotDefinition);
  const badgeX = bounds.x + bounds.width / 2;
  const badgeY = bounds.y - 18 * host.layout.scale;

  host.addPalisadeTooltip(
    plotDefinition,
    selected,
    building?.level ?? 0,
    building?.upgradingRemaining ?? 0,
    translations?.buildings.palisade.name ?? "Palisade",
  );

  if (building) {
    host.drawBuildingLevelBadge(
      host.cameraDynamicLayer,
      Math.max(1, building.level),
      badgeX,
      badgeY,
      translations,
      translations?.buildings.palisade.name ?? "Palisade",
    );
  }

  if (building && building.upgradingRemaining > 0) {
    host.drawConstructionCountdown(
      host.cameraDynamicLayer,
      building.upgradingRemaining,
      bounds.x + bounds.width / 2,
      bounds.y - 52 * host.layout.scale,
      Math.max(70, 86 * host.layout.scale),
      undefined,
    );
  }
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

    const asset = host.createBuildingSprite(buildingId, Math.max(1, building.level), building.level > 0);
    asset.anchor.set(0.5);
    host.fitSprite(asset, bounds.width * VILLAGE_BUILDING_RENDER_SCALE, bounds.height * VILLAGE_BUILDING_RENDER_SCALE);
    asset.alpha = building.level > 0 || isMainPlot ? 1 : 0.62;
    plotLayer.addChild(asset);

    if (isBuildingInactiveDueToCoal(state, buildingId)) {
      host.drawPowerWarning(plotLayer, bounds);
    }
    host.drawBuildingLevelBadge(plotLayer, Math.max(1, building.level), -bounds.width * 0.43, -bounds.height * 0.5, translations, name);
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
  empty
    .moveTo(-markerSize * 0.22, 0)
    .lineTo(markerSize * 0.22, 0)
    .moveTo(0, -markerSize * 0.22)
    .lineTo(0, markerSize * 0.22)
    .stroke({
      color: selected ? 0xf3c85f : 0xeadca0,
      alpha: selected ? 0.95 : 0.58,
      width: Math.max(3, 5 * host.layout.scale),
    });
  plotLayer.addChild(empty);
}
