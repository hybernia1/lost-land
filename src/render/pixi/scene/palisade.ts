import { Container, Sprite } from "pixi.js";
import { defaultVillageLayout, type VillageMapObjectDefinition } from "../../../data/villageLayouts";
import type { GameState } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { palisadePlotDefinition, upgradingTooltip } from "../core/constants";
import type { SceneLayout } from "../core/types";
import type { WorldRenderHost } from "./worldRenderer";

const PALISADE_BLOCK_WIDTH = 128;
const PALISADE_BLOCK_HEIGHT = 64;
const GATE_HIT_PADDING = 0.2;

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

export function drawPalisade(host: WorldRenderHost, state: GameState, translations?: TranslationPack): void {
  const plotDefinition = palisadePlotDefinition;
  if (!plotDefinition) {
    return;
  }

  const plotId = plotDefinition.id;
  const plot = state.village.plots.find((candidate) => candidate.id === plotId);
  const building = plot?.buildingId ? state.buildings[plot.buildingId] : null;
  const selected = state.village.selectedPlotId === plotId;
  const ring = getPalisadeRingObject();
  drawPalisadeFromMap(host, state);

  if (!ring) {
    return;
  }

  const gateCenter = getPalisadeGateCenter(host.layout, ring);
  if (!gateCenter) {
    return;
  }

  addGateTooltip(
    host,
    gateCenter,
    upgradingTooltip(
      translations?.buildings.palisade.name ?? "Palisade",
      building?.level ?? 0,
      building?.upgradingRemaining ?? 0,
      translations?.ui.level ?? "Lvl",
    ),
    selected,
  );

  if (building && building.upgradingRemaining > 0) {
    host.drawConstructionCountdown(
      host.cameraDynamicLayer,
      building.upgradingRemaining,
      gateCenter.x,
      gateCenter.y - 54 * host.layout.scale,
      Math.max(70, 84 * host.layout.scale),
      undefined,
    );
  }
}

export function isInsidePalisadeGateHitArea(layout: SceneLayout, x: number, y: number): boolean {
  if (defaultVillageLayout.orientation !== "isometric") {
    return false;
  }

  const ring = getPalisadeRingObject();
  if (!ring) {
    return false;
  }

  const gateCenter = getPalisadeGateCenter(layout, ring);
  if (!gateCenter) {
    return false;
  }

  return isInsideIsoDiamond(
    x,
    y,
    gateCenter.x,
    gateCenter.y,
    PALISADE_BLOCK_WIDTH * layout.scale,
    PALISADE_BLOCK_HEIGHT * layout.scale,
    GATE_HIT_PADDING,
  );
}

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
  const shape = getPalisadeShapeForHost(host, ring);
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

  const cornerPoints = getPalisadeCornerPoints(shape);
  for (const [cornerIndex, corner] of cornerPoints.entries()) {
    const cornerTextureKey = getPalisadeCornerTextureKey(cornerIndex);
    const sprite = createPalisadeSprite(host, cornerTextureKey, corner.x, corner.y, alpha * ring.opacity, tint);

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
      textureKey: "palisade:palisadeDiagUp",
      gateTextureKey: "palisade:palisadeGateUp",
      blockCount: shape.xBlocks,
    },
    {
      id: "southEast",
      start: shape.right,
      end: shape.bottom,
      textureKey: "palisade:palisadeDiagDown",
      gateTextureKey: "palisade:palisadeGateDown",
      blockCount: shape.yBlocks,
    },
    {
      id: "southWest",
      start: shape.bottom,
      end: shape.left,
      textureKey: "palisade:palisadeDiagUpSideB",
      gateTextureKey: "palisade:palisadeGateUpSideB",
      blockCount: shape.xBlocks,
    },
    {
      id: "northWest",
      start: shape.left,
      end: shape.top,
      textureKey: "palisade:palisadeDiagDownSideB",
      gateTextureKey: "palisade:palisadeGateDownSideB",
      blockCount: shape.yBlocks,
    },
  ];
}

function getPalisadeCornerTextureKey(cornerIndex: number): string {
  // Corner order is [top, right, bottom, left].
  // Top/left corners use sideB shading to match the west-facing edge set.
  const isSideB = cornerIndex === 0 || cornerIndex === 3;
  return isSideB ? "palisade:palisadeCornerSideB" : "palisade:palisadeCorner";
}

function getPalisadeShapeForHost(host: WorldRenderHost, ring: VillageMapObjectDefinition): PalisadeShape {
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

  return getPalisadeShapeForLayout(host.layout, ring);
}

function getPalisadeShapeForLayout(layout: SceneLayout, ring: VillageMapObjectDefinition): PalisadeShape {
  const xBlocks = getPalisadeBlockCount(ring.width);
  const yBlocks = getPalisadeBlockCount(ring.height);
  const top = {
    x: getTerrainOriginX(layout) + ring.x * layout.scale,
    y: getTerrainOriginY(layout) + ring.y * layout.scale,
  };
  const mapXAxis = {
    x: xBlocks * defaultVillageLayout.tileHeight * layout.scale,
    y: (xBlocks * defaultVillageLayout.tileHeight / 2) * layout.scale,
  };
  const mapYAxis = {
    x: -yBlocks * defaultVillageLayout.tileHeight * layout.scale,
    y: (yBlocks * defaultVillageLayout.tileHeight / 2) * layout.scale,
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

function getPalisadeGateCenter(layout: SceneLayout, ring: VillageMapObjectDefinition): Point | null {
  const shape = getPalisadeShapeForLayout(layout, ring);
  const edge = getPalisadeEdges(shape).find((candidate) => candidate.id === getPalisadeGateEdge(ring));

  if (!edge || edge.blockCount <= 0) {
    return null;
  }

  const maxIndex = edge.blockCount - 1;
  const gateIndex = Math.min(maxIndex, getIntegerObjectProperty(ring, "gateIndex", 0));
  const segmentCenter = (gateIndex + 0.5) / edge.blockCount;
  return interpolatePoint(edge.start, edge.end, segmentCenter);
}

function getPalisadeCornerPoints(shape: PalisadeShape): Point[] {
  return [shape.top, shape.right, shape.bottom, shape.left];
}

function getPalisadeBlockCount(rawExtent: number): number {
  return Math.max(1, Math.round(rawExtent / defaultVillageLayout.tileHeight));
}

function getTerrainOriginX(layout: SceneLayout): number {
  const terrainWidth = defaultVillageLayout.width * layout.scale;
  return layout.originX + layout.width / 2 - terrainWidth / 2;
}

function getTerrainOriginY(layout: SceneLayout): number {
  const terrainHeight = defaultVillageLayout.height * layout.scale;
  return layout.originY + layout.height / 2 - terrainHeight / 2;
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
  sprite.width = PALISADE_BLOCK_WIDTH * host.layout.scale;
  sprite.height = PALISADE_BLOCK_HEIGHT * host.layout.scale;
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

function isInsideIsoDiamond(
  px: number,
  py: number,
  cx: number,
  cy: number,
  width: number,
  height: number,
  padding: number,
): boolean {
  const halfWidth = (width / 2) * (1 + padding);
  const halfHeight = (height / 2) * (1 + padding);

  if (halfWidth <= 0 || halfHeight <= 0) {
    return false;
  }

  const nx = Math.abs(px - cx) / halfWidth;
  const ny = Math.abs(py - cy) / halfHeight;

  return nx + ny <= 1;
}

function addGateTooltip(
  host: WorldRenderHost,
  gateCenter: Point,
  text: string,
  selected: boolean,
): void {
  const hitLayer = new Container();
  hitLayer.x = gateCenter.x;
  hitLayer.y = gateCenter.y;
  const basePadding = selected ? 0.32 : GATE_HIT_PADDING;
  const hitWidth = PALISADE_BLOCK_WIDTH * host.layout.scale;
  const hitHeight = PALISADE_BLOCK_HEIGHT * host.layout.scale;
  hitLayer.hitArea = {
    contains: (x: number, y: number) =>
      isInsideIsoDiamond(x, y, 0, 0, hitWidth, hitHeight, basePadding),
  };
  host.bindTooltip(hitLayer, text);
  host.cameraDynamicLayer.addChild(hitLayer);
}
