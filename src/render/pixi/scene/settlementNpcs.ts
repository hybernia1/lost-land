import {
  Container,
  Graphics,
  Sprite,
} from "pixi.js";
import {
  mapNpcDefinitions,
  type MapNpcDefinition,
  type MapNpcKindId,
} from "../../../data/mapNpcs";
import {
  resourceSiteNpcDefinitions,
  settlementNpcByBuildingId,
  type ResourceSiteNpcDefinition,
  type SettlementNpcDefinition,
} from "../../../data/settlementNpcs";
import type { VillageLayoutDefinition } from "../../../data/villageLayouts";
import { isDaylightHour } from "../../../game/time";
import type { BuildingId, GameState } from "../../../game/types";
import type { MapNpcTextureSet } from "../../villageAssets";
import type { Bounds, SceneLayout } from "../core/types";
import { mapRectToSceneBounds } from "./mapGeometry";

type SettlementNpcDirection = keyof MapNpcTextureSet;

type SettlementNpcEntity = {
  id: string;
  emitterId: string;
  definition: MapNpcDefinition;
  textures: MapNpcTextureSet;
  container: Container;
  sprite: Sprite;
  bounds: Bounds;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  direction: SettlementNpcDirection;
  frameIndex: number;
  frameElapsedSeconds: number;
  idleUntilMs: number;
  seed: number;
};

type SettlementNpcEmitterRuntime = {
  id: string;
  settlementDefinition: SettlementNpcEmitterDefinition;
  npcDefinition: MapNpcDefinition;
  textures: MapNpcTextureSet;
  bounds: Bounds;
  sceneLayout: SceneLayout;
  count: number;
  active: boolean;
};

type SettlementNpcEmitterDefinition = Pick<SettlementNpcDefinition, "npcKindId" | "maxCount" | "wanderRadius"> |
  ResourceSiteNpcDefinition;

const SETTLEMENT_NPC_UPDATE_MIN_MS = 1000 / 15;
const SETTLEMENT_NPC_MAX_TOTAL_COUNT = 28;
const SETTLEMENT_NPC_TARGET_EPSILON = 1.8;
const SETTLEMENT_NPC_VIEWPORT_PADDING = 160;

export class SettlementNpcController {
  private readonly entities: SettlementNpcEntity[] = [];
  private readonly emitters: SettlementNpcEmitterRuntime[] = [];
  private lastBuildKey: string | null = null;
  private lastUpdateAtMs = 0;
  private paused = false;
  private parent: Container | null = null;
  private sceneScale = 1;

  sync(
    parent: Container,
    state: GameState,
    mapLayout: VillageLayoutDefinition,
    sceneLayout: SceneLayout,
    getTextures: (kindId: MapNpcKindId) => MapNpcTextureSet | null,
    paused: boolean,
    visibleBounds: Bounds | null,
  ): void {
    this.paused = paused;
    this.parent = parent;
    const buildKey = this.getBuildKey(state, mapLayout, sceneLayout);

    if (buildKey !== this.lastBuildKey) {
      this.clear();
      parent.removeChildren();
      this.parent = parent;
      this.sceneScale = sceneLayout.scale;
      this.lastBuildKey = buildKey;
      this.buildEmitterRuntimes(state, mapLayout, sceneLayout, getTextures);
      this.lastUpdateAtMs = 0;
    }

    this.refreshMaterializedEntities(visibleBounds);
  }

  shouldAnimate(): boolean {
    return !this.paused && this.entities.length > 0;
  }

  update(timestampMs: number, visibleBounds: Bounds | null = null): void {
    this.refreshMaterializedEntities(visibleBounds);

    if (this.paused || this.entities.length === 0) {
      this.lastUpdateAtMs = timestampMs;
      return;
    }

    if (
      this.lastUpdateAtMs > 0 &&
      timestampMs - this.lastUpdateAtMs < SETTLEMENT_NPC_UPDATE_MIN_MS
    ) {
      return;
    }

    const deltaSeconds = this.lastUpdateAtMs > 0
      ? Math.min(0.25, (timestampMs - this.lastUpdateAtMs) / 1000)
      : 0;
    this.lastUpdateAtMs = timestampMs;

    for (const entity of this.entities) {
      this.updateEntity(entity, timestampMs, deltaSeconds);
    }

    this.sortEntities();
  }

  clear(): void {
    for (const entity of this.entities) {
      entity.container.destroy({ children: true });
    }

    this.entities.length = 0;
    this.emitters.length = 0;
    this.lastBuildKey = null;
    this.lastUpdateAtMs = 0;
    this.parent = null;
  }

  private buildEmitterRuntimes(
    state: GameState,
    mapLayout: VillageLayoutDefinition,
    sceneLayout: SceneLayout,
    getTextures: (kindId: MapNpcKindId) => MapNpcTextureSet | null,
  ): void {
    if (!isSettlementActivityVisible(state)) {
      return;
    }

    for (const plotState of state.village.plots) {
      if (!plotState.buildingId) {
        continue;
      }

      const settlementDefinition = settlementNpcByBuildingId[plotState.buildingId];
      const building = state.buildings[plotState.buildingId];
      const plot = mapLayout.plots.find((candidate) => candidate.id === plotState.id);

      if (!settlementDefinition || !building || !plot || building.level <= 0) {
        continue;
      }

      const count = this.resolveEmitterCount(state, plotState.buildingId, settlementDefinition);

      if (count <= 0) {
        continue;
      }

      const textures = getTextures(settlementDefinition.npcKindId);

      if (!textures) {
        continue;
      }

      this.emitters.push({
        id: `${plotState.id}:${plotState.buildingId}`,
        settlementDefinition,
        npcDefinition: mapNpcDefinitions[settlementDefinition.npcKindId],
        textures,
        bounds: getSettlementNpcBounds(mapLayout, sceneLayout, plot, settlementDefinition),
        sceneLayout,
        count,
        active: false,
      });
    }

    for (const siteState of state.resourceSites) {
      const siteDefinition = mapLayout.resourceSites.find((candidate) => candidate.id === siteState.id);

      if (!siteDefinition) {
        continue;
      }

      const phaseDefinition = siteState.captured
        ? siteState.assignedWorkers > 0
          ? resourceSiteNpcDefinitions.occupied
          : null
        : resourceSiteNpcDefinitions.uncaptured;

      if (!phaseDefinition) {
        continue;
      }

      const count = siteState.captured
        ? Math.min(phaseDefinition.maxCount, siteState.assignedWorkers)
        : phaseDefinition.maxCount;

      if (count <= 0) {
        continue;
      }

      const textures = getTextures(phaseDefinition.npcKindId);

      if (!textures) {
        continue;
      }

      const phase = siteState.captured ? "occupied" : "uncaptured";
      this.emitters.push({
        id: `resource-site:${siteDefinition.id}:${phase}`,
        settlementDefinition: phaseDefinition,
        npcDefinition: mapNpcDefinitions[phaseDefinition.npcKindId],
        textures,
        bounds: getSettlementNpcBounds(mapLayout, sceneLayout, siteDefinition, phaseDefinition),
        sceneLayout,
        count,
        active: false,
      });
    }
  }

  private resolveEmitterCount(
    state: GameState,
    buildingId: BuildingId,
    settlementDefinition: SettlementNpcDefinition,
  ): number {
    if (settlementDefinition.requirement === "troops") {
      return state.survivors.troops > 0
        ? Math.min(settlementDefinition.maxCount, state.survivors.troops)
        : 0;
    }

    const workers = state.buildings[buildingId]?.workers ?? 0;
    return workers > 0
      ? Math.min(settlementDefinition.maxCount, workers)
      : 0;
  }

  private refreshMaterializedEntities(visibleBounds: Bounds | null): void {
    const parent = this.parent;

    if (!parent) {
      return;
    }

    const paddedBounds = visibleBounds
      ? padBounds(visibleBounds, SETTLEMENT_NPC_VIEWPORT_PADDING * this.sceneScale)
      : null;

    for (const runtime of this.emitters) {
      const shouldBeActive = !paddedBounds || boundsIntersect(runtime.bounds, paddedBounds);

      if (!shouldBeActive && runtime.active) {
        this.destroyEmitterEntities(runtime.id);
        runtime.active = false;
        continue;
      }

      if (shouldBeActive && !runtime.active) {
        const remaining = Math.max(0, SETTLEMENT_NPC_MAX_TOTAL_COUNT - this.entities.length);
        const spawnCount = Math.min(runtime.count, remaining);

        for (let index = 0; index < spawnCount; index += 1) {
          const entity = this.createEntity(runtime, index);
          this.entities.push(entity);
          parent.addChild(entity.container);
        }

        runtime.active = spawnCount > 0;
      }
    }
  }

  private createEntity(
    runtime: SettlementNpcEmitterRuntime,
    index: number,
  ): SettlementNpcEntity {
    const { id, npcDefinition, textures, bounds, sceneLayout } = runtime;
    let seed = hashString(`${id}:${index}:${npcDefinition.id}`);
    const x = randomRange(bounds.x, bounds.x + bounds.width, nextRandom(seed));
    seed = advanceSeed(seed);
    const y = randomRange(bounds.y, bounds.y + bounds.height, nextRandom(seed));
    seed = advanceSeed(seed);
    const direction: SettlementNpcDirection = nextRandom(seed) > 0.5 ? "east" : "west";
    seed = advanceSeed(seed);
    const sprite = new Sprite(textures[direction][0]);
    sprite.anchor.set(0.5, 0.86);
    sprite.width = npcDefinition.renderWidth * sceneLayout.scale;
    sprite.height = npcDefinition.renderHeight * sceneLayout.scale;
    sprite.roundPixels = true;

    const shadow = new Graphics();
    const shadowWidth = Math.max(4, npcDefinition.renderWidth * sceneLayout.scale * 0.45);
    const shadowHeight = Math.max(2, npcDefinition.renderHeight * sceneLayout.scale * 0.13);
    shadow.ellipse(0, 0, shadowWidth, shadowHeight).fill({ color: 0x050604, alpha: 0.32 });
    shadow.y = -shadowHeight * 0.3;

    const container = new Container();
    container.eventMode = "none";
    container.cullable = true;
    container.addChild(shadow, sprite);

    const entity: SettlementNpcEntity = {
      id: `${id}:${index}`,
      emitterId: id,
      definition: npcDefinition,
      textures,
      container,
      sprite,
      bounds,
      x,
      y,
      targetX: x,
      targetY: y,
      direction,
      frameIndex: Math.floor(nextRandom(seed) * textures[direction].length),
      frameElapsedSeconds: 0,
      idleUntilMs: 0,
      seed: advanceSeed(seed),
    };

    this.pickNextTarget(entity, 0, true);
    this.placeEntity(entity);
    return entity;
  }

  private updateEntity(entity: SettlementNpcEntity, timestampMs: number, deltaSeconds: number): void {
    if (timestampMs < entity.idleUntilMs) {
      return;
    }

    const distanceX = entity.targetX - entity.x;
    const distanceY = entity.targetY - entity.y;
    const distance = Math.hypot(distanceX, distanceY);

    if (distance <= SETTLEMENT_NPC_TARGET_EPSILON) {
      this.pickNextTarget(entity, timestampMs);
      return;
    }

    const step = entity.definition.speedPixelsPerSecond * deltaSeconds;
    const ratio = Math.min(1, step / distance);
    entity.x += distanceX * ratio;
    entity.y += distanceY * ratio;
    entity.direction = distanceX >= 0 ? "east" : "west";
    this.updateAnimationFrame(entity, deltaSeconds);
    this.placeEntity(entity);
  }

  private pickNextTarget(entity: SettlementNpcEntity, timestampMs: number, forceMove = false): void {
    const idleRoll = this.random(entity);

    if (!forceMove && idleRoll < entity.definition.idleChance) {
      entity.idleUntilMs = timestampMs + randomRange(
        entity.definition.idleSeconds.min,
        entity.definition.idleSeconds.max,
        this.random(entity),
      ) * 1000;
      return;
    }

    entity.idleUntilMs = 0;
    entity.targetX = randomRange(
      entity.bounds.x,
      entity.bounds.x + entity.bounds.width,
      this.random(entity),
    );
    entity.targetY = randomRange(
      entity.bounds.y,
      entity.bounds.y + entity.bounds.height,
      this.random(entity),
    );
  }

  private updateAnimationFrame(entity: SettlementNpcEntity, deltaSeconds: number): void {
    const frames = entity.textures[entity.direction];

    if (frames.length === 0) {
      return;
    }

    entity.frameElapsedSeconds += deltaSeconds;

    if (entity.frameElapsedSeconds >= entity.definition.animationFrameSeconds) {
      entity.frameElapsedSeconds = 0;
      entity.frameIndex = (entity.frameIndex + 1) % frames.length;
    }

    entity.sprite.texture = frames[entity.frameIndex] ?? frames[0];
  }

  private placeEntity(entity: SettlementNpcEntity): void {
    entity.container.x = entity.x;
    entity.container.y = entity.y;
    entity.container.zIndex = entity.y;
  }

  private sortEntities(): void {
    this.entities.sort((left, right) => left.y - right.y);

    for (let index = 0; index < this.entities.length; index += 1) {
      this.entities[index].container.zIndex = index;
    }
  }

  private destroyEmitterEntities(emitterId: string): void {
    for (let index = this.entities.length - 1; index >= 0; index -= 1) {
      const entity = this.entities[index];

      if (entity.emitterId !== emitterId) {
        continue;
      }

      this.entities.splice(index, 1);
      entity.container.destroy({ children: true });
    }
  }

  private random(entity: SettlementNpcEntity): number {
    const value = nextRandom(entity.seed);
    entity.seed = advanceSeed(entity.seed);
    return value;
  }

  private getBuildKey(
    state: GameState,
    mapLayout: VillageLayoutDefinition,
    sceneLayout: SceneLayout,
  ): string {
    const active = isSettlementActivityVisible(state);
    const plotKey = state.village.plots.map((plot) => `${plot.id}:${plot.buildingId ?? "-"}`).join("|");
    const buildingKey = Object.entries(state.buildings)
      .filter(([buildingId]) => Boolean(settlementNpcByBuildingId[buildingId as BuildingId]))
      .map(([buildingId, building]) => `${buildingId}:${building.level}:${building.workers}`)
      .join("|");
    const resourceSiteStateKey = state.resourceSites
      .map((site) => `${site.id}:${site.captured ? 1 : 0}:${site.assignedWorkers}`)
      .join("|");
    const resourceSiteLayoutKey = mapLayout.resourceSites.map((site) => [
      site.id,
      site.x.toFixed(2),
      site.y.toFixed(2),
      site.width.toFixed(2),
      site.height.toFixed(2),
    ].join(":")).join("|");

    return [
      active ? "active" : "sleeping",
      state.workMode,
      state.survivors.troops,
      sceneLayout.scale.toFixed(4),
      sceneLayout.originX.toFixed(2),
      sceneLayout.originY.toFixed(2),
      mapLayout.plots.map((plot) => [
        plot.id,
        plot.x.toFixed(2),
        plot.y.toFixed(2),
        plot.width.toFixed(2),
        plot.height.toFixed(2),
      ].join(":")).join("|"),
      resourceSiteLayoutKey,
      plotKey,
      buildingKey,
      resourceSiteStateKey,
    ].join("/");
  }
}

function isSettlementActivityVisible(state: GameState): boolean {
  return state.workMode === "continuous" || isDaylightHour(state.elapsedSeconds);
}

function getSettlementNpcBounds(
  mapLayout: VillageLayoutDefinition,
  sceneLayout: SceneLayout,
  plot: { x: number; y: number; width: number; height: number },
  settlementDefinition: SettlementNpcEmitterDefinition,
): Bounds {
  const plotBounds = mapRectToSceneBounds(mapLayout, sceneLayout, plot);
  const radius = settlementDefinition.wanderRadius * sceneLayout.scale;
  const width = Math.max(plotBounds.width * 1.1, radius * 1.45);
  const height = Math.max(plotBounds.height * 0.9, radius);
  const centerX = plotBounds.x + plotBounds.width / 2;
  const centerY = plotBounds.y + plotBounds.height * 0.74;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function advanceSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function nextRandom(seed: number): number {
  return advanceSeed(seed) / 0x100000000;
}

function randomRange(min: number, max: number, randomValue: number): number {
  return min + (max - min) * randomValue;
}

function boundsIntersect(left: Bounds, right: Bounds): boolean {
  return left.x <= right.x + right.width &&
    left.x + left.width >= right.x &&
    left.y <= right.y + right.height &&
    left.y + left.height >= right.y;
}

function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}
