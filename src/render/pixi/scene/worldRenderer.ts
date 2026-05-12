import { Container, Graphics, Sprite } from "pixi.js";
import { buildingById } from "../../../data/buildings";
import { defaultVillageLayout, type VillageMapObjectDefinition } from "../../../data/villageLayouts";
import type { VillagePlotDefinition, VillageResourceSiteDefinition } from "../../../data/villagePlots";
import type { BuildingId, EnvironmentConditionId, GameState } from "../../../game/types";
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
  trackTerrainSprite: (
    sprite: Sprite,
    tintByEnvironment?: Partial<Record<EnvironmentConditionId, number>>,
  ) => void;
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
  const terrainWidth = layout.width * scale;
  const terrainHeight = layout.height * scale;
  const originX = host.layout.originX + host.layout.width / 2 - terrainWidth / 2;
  const originY = host.layout.originY + host.layout.height / 2 - terrainHeight / 2;

  for (const layer of layout.tileLayers) {
    for (const tile of layer.tiles) {
      const tileX = originX + tile.x * scale;
      const tileY = originY + tile.y * scale;
      const sprite = host.createTerrainSprite(tile.textureKey);

      if (!sprite) {
        continue;
      }
      const tileDefinition = layout.tileTextures[tile.textureKey];
      const tileWidth = tileDefinition.frame.width * scale;
      const tileHeight = tileDefinition.frame.height * scale;
      host.trackTerrainSprite(sprite, tileDefinition.tintByEnvironment);
      sprite.alpha = layer.opacity;

      if (tile.rotation || tile.flipX || tile.flipY) {
        sprite.anchor.set(0.5);
        sprite.rotation = ((tile.rotation ?? 0) * Math.PI) / 180;
        sprite.x = tileX + tileWidth / 2;
        sprite.y = tileY + tileHeight / 2;
        sprite.scale.set(
          (tile.flipX ? -1 : 1) * ((tileWidth + 0.5) / sprite.texture.width),
          (tile.flipY ? -1 : 1) * ((tileHeight + 0.5) / sprite.texture.height),
        );
      } else {
        sprite.x = tileX;
        sprite.y = tileY;
        sprite.width = tileWidth + 0.5;
        sprite.height = tileHeight + 0.5;
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

  for (const layer of layout.objectLayers) {
    if (!isStaticVisualObjectLayer(layer.name)) {
      continue;
    }

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

      const usesTileObjectAnchor = layout.orientation === "isometric" && object.tileId !== null;
      sprite.anchor.set(usesTileObjectAnchor ? 0.5 : 0, 1);
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

function isStaticVisualObjectLayer(layerName: string): boolean {
  return layerName === "decor";
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
  drawPalisadeFromMap(host, state);

  host.addPalisadeTooltip(
    plotDefinition,
    selected,
    building?.level ?? 0,
    building?.upgradingRemaining ?? 0,
    translations?.buildings.palisade.name ?? "Palisade",
  );

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

type PalisadeEdgeId = "northEast" | "southEast" | "southWest" | "northWest";

type Point = {
  x: number;
  y: number;
};

type PalisadeEdge = {
  id: PalisadeEdgeId;
  start: Point;
  end: Point;
  textureKey: string;
  gateTextureKey: string;
  blockCount: number;
};

type PalisadeShape = {
  top: Point;
  right: Point;
  bottom: Point;
  left: Point;
  xBlocks: number;
  yBlocks: number;
};

function drawPalisadeFromMap(host: WorldRenderHost, state: GameState): void {
  const ring = getPalisadeRingObject();

  if (!ring) {
    return;
  }

  const hasBuiltPalisade = state.buildings.palisade.level > 0;
  const alpha = hasBuiltPalisade ? 0.95 : 0.5;
  const tint = hasBuiltPalisade ? 0xffffff : 0xd7c29d;
  const gateEdge = getPalisadeGateEdge(ring);
  const gateIndex = getIntegerObjectProperty(ring, "gateIndex", 0);
  const shape = getPalisadeShape(host, ring);
  const edges = getPalisadeEdges(shape);
  const drawItems: Array<{ y: number; sprite: Sprite }> = [];

  for (const edge of edges) {
    drawPalisadeEdge(host, edge, {
      alpha: alpha * ring.opacity,
      tint,
      gateIndex,
      hasGate: edge.id === gateEdge,
      drawItems,
    });
  }

  for (const corner of getPalisadeCornerPoints(shape)) {
    const sprite = createPalisadeSprite(host, "palisade:palisadeCorner", corner.x, corner.y, alpha * ring.opacity, tint);

    if (sprite) {
      drawItems.push({ y: sprite.y, sprite });
    }
  }

  drawItems
    .sort((left, right) => left.y - right.y)
    .forEach((item) => host.cameraDynamicLayer.addChild(item.sprite));
}

function getPalisadeRingObject(): VillageMapObjectDefinition | null {
  const layer = defaultVillageLayout.objectLayers.find((candidate) => candidate.name === "palisade");
  return layer?.objects.find((object) => object.type === "ring") ?? null;
}

function getPalisadeEdges(shape: PalisadeShape): PalisadeEdge[] {
  return [
    {
      id: "northEast",
      start: shape.top,
      end: shape.right,
      textureKey: "palisade:palisadeDiagDown",
      gateTextureKey: "palisade:palisadeGateDown",
      blockCount: shape.xBlocks,
    },
    {
      id: "southEast",
      start: shape.right,
      end: shape.bottom,
      textureKey: "palisade:palisadeDiagUp",
      gateTextureKey: "palisade:palisadeGateUp",
      blockCount: shape.yBlocks,
    },
    {
      id: "southWest",
      start: shape.bottom,
      end: shape.left,
      textureKey: "palisade:palisadeDiagDown",
      gateTextureKey: "palisade:palisadeGateDown",
      blockCount: shape.xBlocks,
    },
    {
      id: "northWest",
      start: shape.left,
      end: shape.top,
      textureKey: "palisade:palisadeDiagUp",
      gateTextureKey: "palisade:palisadeGateUp",
      blockCount: shape.yBlocks,
    },
  ];
}

function getPalisadeShape(host: WorldRenderHost, ring: VillageMapObjectDefinition): PalisadeShape {
  const xBlocks = getPalisadeBlockCount(ring.width);
  const yBlocks = getPalisadeBlockCount(ring.height);

  if (defaultVillageLayout.orientation !== "isometric") {
    const bounds = host.getPlotBounds({
      x: ring.x,
      y: ring.y,
      width: xBlocks * defaultVillageLayout.tileWidth,
      height: yBlocks * defaultVillageLayout.tileHeight,
    });

    return {
      top: { x: bounds.x + bounds.width / 2, y: bounds.y },
      right: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
      bottom: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
      left: { x: bounds.x, y: bounds.y + bounds.height / 2 },
      xBlocks,
      yBlocks,
    };
  }

  const scale = host.layout.scale;
  const origin = getTerrainOrigin(host);
  const top = {
    x: origin.x + ring.x * scale,
    y: origin.y + ring.y * scale,
  };
  const mapXAxis = {
    x: xBlocks * defaultVillageLayout.tileHeight * scale,
    y: (xBlocks * defaultVillageLayout.tileHeight / 2) * scale,
  };
  const mapYAxis = {
    x: -yBlocks * defaultVillageLayout.tileHeight * scale,
    y: (yBlocks * defaultVillageLayout.tileHeight / 2) * scale,
  };

  return {
    top,
    right: { x: top.x + mapXAxis.x, y: top.y + mapXAxis.y },
    bottom: { x: top.x + mapXAxis.x + mapYAxis.x, y: top.y + mapXAxis.y + mapYAxis.y },
    left: { x: top.x + mapYAxis.x, y: top.y + mapYAxis.y },
    xBlocks,
    yBlocks,
  };
}

function getPalisadeCornerPoints(shape: PalisadeShape): Point[] {
  return [shape.top, shape.right, shape.bottom, shape.left];
}

function getPalisadeBlockCount(rawExtent: number): number {
  return Math.max(1, Math.round(rawExtent / defaultVillageLayout.tileHeight));
}

function getTerrainOrigin(host: WorldRenderHost): Point {
  const layout = defaultVillageLayout;
  const terrainWidth = layout.width * host.layout.scale;
  const terrainHeight = layout.height * host.layout.scale;

  return {
    x: host.layout.originX + host.layout.width / 2 - terrainWidth / 2,
    y: host.layout.originY + host.layout.height / 2 - terrainHeight / 2,
  };
}

function drawPalisadeEdge(
  host: WorldRenderHost,
  edge: PalisadeEdge,
  options: {
    alpha: number;
    tint: number;
    gateIndex: number;
    hasGate: boolean;
    drawItems: Array<{ y: number; sprite: Sprite }>;
  },
): void {
  const segmentCount = edge.blockCount;

  for (let index = 0; index < segmentCount; index += 1) {
    const segmentCenter = (index + 0.5) / segmentCount;
    const isGateSegment = options.hasGate && index === options.gateIndex;

    const point = interpolatePoint(edge.start, edge.end, segmentCenter);
    const sprite = createPalisadeSprite(
      host,
      isGateSegment ? edge.gateTextureKey : edge.textureKey,
      point.x,
      point.y,
      options.alpha,
      options.tint,
    );

    if (sprite) {
      options.drawItems.push({ y: sprite.y, sprite });
    }
  }
}

function createPalisadeSprite(
  host: WorldRenderHost,
  textureKey: string,
  x: number,
  y: number,
  alpha: number,
  tint: number,
): Sprite | null {
  const sprite = host.createTerrainSprite(textureKey);

  if (!sprite) {
    return null;
  }

  sprite.anchor.set(0.5);
  sprite.x = x;
  sprite.y = y;
  sprite.width = 128 * host.layout.scale;
  sprite.height = 64 * host.layout.scale;
  sprite.alpha = alpha;
  sprite.tint = tint;
  return sprite;
}

function interpolatePoint(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function getPalisadeGateEdge(object: VillageMapObjectDefinition): PalisadeEdgeId {
  const value = object.properties.gateEdge;

  if (
    value === "northEast" ||
    value === "southEast" ||
    value === "southWest" ||
    value === "northWest"
  ) {
    return value;
  }

  return "southWest";
}

function getIntegerObjectProperty(
  object: VillageMapObjectDefinition,
  propertyName: string,
  fallback: number,
): number {
  const value = object.properties[propertyName];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(value));
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
