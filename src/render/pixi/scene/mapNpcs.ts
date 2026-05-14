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
import type {
  VillageLayoutDefinition,
  VillageNpcSpawnDefinition,
} from "../../../data/villageLayouts";
import type { MapNpcTextureSet } from "../../villageAssets";
import type { Bounds, SceneLayout } from "../core/types";
import { mapRectToSceneBounds } from "./mapGeometry";

type MapNpcDirection = keyof MapNpcTextureSet;

type MapNpcEntity = {
  id: string;
  spawnId: string;
  definition: MapNpcDefinition;
  textures: MapNpcTextureSet;
  container: Container;
  sprite: Sprite;
  shadow: Graphics;
  bounds: Bounds;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  direction: MapNpcDirection;
  frameIndex: number;
  frameElapsedSeconds: number;
  idleUntilMs: number;
  seed: number;
};

type MapNpcSpawnRuntime = {
  spawn: VillageNpcSpawnDefinition;
  definition: MapNpcDefinition;
  textures: MapNpcTextureSet;
  bounds: Bounds;
  sceneLayout: SceneLayout;
  active: boolean;
};

const MAP_NPC_UPDATE_MIN_MS = 100;
const MAP_NPC_MAX_TOTAL_COUNT = 24;
const MAP_NPC_TARGET_EPSILON = 1.8;
const MAP_NPC_VIEWPORT_PADDING = 160;

export class MapNpcController {
  private readonly entities: MapNpcEntity[] = [];
  private readonly spawns: MapNpcSpawnRuntime[] = [];
  private lastBuildKey: string | null = null;
  private lastUpdateAtMs = 0;
  private paused = false;
  private parent: Container | null = null;
  private sceneScale = 1;

  sync(
    parent: Container,
    mapLayout: VillageLayoutDefinition,
    sceneLayout: SceneLayout,
    getTextures: (kindId: MapNpcKindId) => MapNpcTextureSet | null,
    paused: boolean,
    visibleBounds: Bounds | null,
  ): void {
    this.paused = paused;
    this.parent = parent;
    const buildKey = this.getBuildKey(mapLayout, sceneLayout);

    if (buildKey !== this.lastBuildKey) {
      this.clear();
      parent.removeChildren();
      this.parent = parent;
      this.sceneScale = sceneLayout.scale;
      this.lastBuildKey = buildKey;
      this.buildSpawnRuntimes(mapLayout, sceneLayout, getTextures);
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
      timestampMs - this.lastUpdateAtMs < MAP_NPC_UPDATE_MIN_MS
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
    this.spawns.length = 0;
    this.lastBuildKey = null;
    this.lastUpdateAtMs = 0;
    this.parent = null;
  }

  private buildSpawnRuntimes(
    mapLayout: VillageLayoutDefinition,
    sceneLayout: SceneLayout,
    getTextures: (kindId: MapNpcKindId) => MapNpcTextureSet | null,
  ): void {
    for (const spawn of mapLayout.npcSpawns) {
      const textures = getTextures(spawn.npcKindId);

      if (!textures) {
        continue;
      }

      this.spawns.push({
        spawn,
        definition: mapNpcDefinitions[spawn.npcKindId],
        textures,
        bounds: mapRectToSceneBounds(mapLayout, sceneLayout, spawn),
        sceneLayout,
        active: false,
      });
    }
  }

  private refreshMaterializedEntities(visibleBounds: Bounds | null): void {
    const parent = this.parent;

    if (!parent) {
      return;
    }

    const paddedBounds = visibleBounds
      ? padBounds(visibleBounds, MAP_NPC_VIEWPORT_PADDING * this.sceneScale)
      : null;

    for (const runtime of this.spawns) {
      const shouldBeActive = !paddedBounds || boundsIntersect(runtime.bounds, paddedBounds);

      if (!shouldBeActive && runtime.active) {
        this.destroySpawnEntities(runtime.spawn.id);
        runtime.active = false;
        continue;
      }

      if (shouldBeActive && !runtime.active) {
        const remaining = Math.max(0, MAP_NPC_MAX_TOTAL_COUNT - this.entities.length);
        const spawnCount = Math.min(runtime.spawn.count, remaining);

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
    runtime: MapNpcSpawnRuntime,
    index: number,
  ): MapNpcEntity {
    const { spawn, definition, textures, bounds, sceneLayout } = runtime;
    let seed = hashString(`${spawn.id}:${index}:${definition.id}`);
    const x = randomRange(bounds.x, bounds.x + bounds.width, nextRandom(seed));
    seed = advanceSeed(seed);
    const y = randomRange(bounds.y, bounds.y + bounds.height, nextRandom(seed));
    seed = advanceSeed(seed);
    const direction: MapNpcDirection = nextRandom(seed) > 0.5 ? "east" : "west";
    seed = advanceSeed(seed);
    const sprite = new Sprite(textures[direction][0]);
    sprite.anchor.set(0.5, 0.86);
    sprite.width = definition.renderWidth * sceneLayout.scale;
    sprite.height = definition.renderHeight * sceneLayout.scale;
    sprite.roundPixels = true;

    const shadow = new Graphics();
    const shadowWidth = Math.max(4, definition.renderWidth * sceneLayout.scale * 0.45);
    const shadowHeight = Math.max(2, definition.renderHeight * sceneLayout.scale * 0.13);
    shadow.ellipse(0, 0, shadowWidth, shadowHeight).fill({ color: 0x050604, alpha: 0.34 });
    shadow.y = -shadowHeight * 0.3;

    const container = new Container();
    container.eventMode = "none";
    container.cullable = true;
    container.addChild(shadow, sprite);

    const entity: MapNpcEntity = {
      id: `${spawn.id}:${index}`,
      spawnId: spawn.id,
      definition,
      textures,
      container,
      sprite,
      shadow,
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

  private updateEntity(entity: MapNpcEntity, timestampMs: number, deltaSeconds: number): void {
    if (timestampMs < entity.idleUntilMs) {
      return;
    }

    const distanceX = entity.targetX - entity.x;
    const distanceY = entity.targetY - entity.y;
    const distance = Math.hypot(distanceX, distanceY);

    if (distance <= MAP_NPC_TARGET_EPSILON) {
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

  private pickNextTarget(entity: MapNpcEntity, timestampMs: number, forceMove = false): void {
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

  private updateAnimationFrame(entity: MapNpcEntity, deltaSeconds: number): void {
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

  private placeEntity(entity: MapNpcEntity): void {
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

  private destroySpawnEntities(spawnId: string): void {
    for (let index = this.entities.length - 1; index >= 0; index -= 1) {
      const entity = this.entities[index];

      if (entity.spawnId !== spawnId) {
        continue;
      }

      this.entities.splice(index, 1);
      entity.container.destroy({ children: true });
    }
  }

  private random(entity: MapNpcEntity): number {
    const value = nextRandom(entity.seed);
    entity.seed = advanceSeed(entity.seed);
    return value;
  }

  private getBuildKey(mapLayout: VillageLayoutDefinition, sceneLayout: SceneLayout): string {
    return [
      sceneLayout.scale.toFixed(4),
      sceneLayout.originX.toFixed(2),
      sceneLayout.originY.toFixed(2),
      mapLayout.npcSpawns.map((spawn) => [
        spawn.id,
        spawn.npcKindId,
        spawn.count,
        spawn.x.toFixed(2),
        spawn.y.toFixed(2),
        spawn.width.toFixed(2),
        spawn.height.toFixed(2),
      ].join(":")).join("|"),
    ].join("/");
  }
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
