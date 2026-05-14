import {
  Container,
  Graphics,
  Sprite,
} from "pixi.js";
import {
  mapBirdDefinitions,
  mapBirdKindIds,
  type MapBirdDefinition,
  type MapBirdKindId,
} from "../../../data/mapBirds";
import type { VillageLayoutDefinition } from "../../../data/villageLayouts";
import type { MapBirdTextureSet } from "../../villageAssets";
import type { Bounds, SceneLayout } from "../core/types";
import { getMapRenderBounds } from "./mapGeometry";

type MapBirdDirection = keyof MapBirdTextureSet;

type MapBirdEntity = {
  id: string;
  definition: MapBirdDefinition;
  textures: MapBirdTextureSet;
  container: Container;
  sprite: Sprite;
  shadow: Graphics;
  x: number;
  y: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  altitude: number;
  speed: number;
  direction: MapBirdDirection;
  frameIndex: number;
  frameElapsedSeconds: number;
  phaseOffset: number;
};

type MapBirdFlightPath = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  direction: MapBirdDirection;
};

const MAP_BIRD_UPDATE_MIN_MS = 100;
const MAP_BIRD_EDGE_PADDING = 180;
const MAP_BIRD_VIEWPORT_PADDING = 220;
const MAP_BIRD_SHADOW_MIN_ALPHA = 0.08;
const MAP_BIRD_SHADOW_MAX_ALPHA = 0.22;

export class MapBirdController {
  private readonly entities: MapBirdEntity[] = [];
  private lastBuildKey: string | null = null;
  private lastUpdateAtMs = 0;
  private nextSpawnAtMs = 0;
  private paused = false;
  private parent: Container | null = null;
  private mapBounds: Bounds | null = null;
  private sceneScale = 1;
  private readonly texturesByKind = new Map<MapBirdKindId, MapBirdTextureSet>();
  private seed = hashString("lost-land-map-birds");
  private entityCounter = 0;

  sync(
    parent: Container,
    mapLayout: VillageLayoutDefinition,
    sceneLayout: SceneLayout,
    getTextures: (kindId: MapBirdKindId) => MapBirdTextureSet | null,
    paused: boolean,
    visibleBounds: Bounds | null,
  ): void {
    this.paused = paused;
    this.parent = parent;
    this.texturesByKind.clear();
    for (const kindId of mapBirdKindIds) {
      const textures = getTextures(kindId);
      if (textures) {
        this.texturesByKind.set(kindId, textures);
      }
    }
    const buildKey = this.getBuildKey(sceneLayout);

    if (buildKey === this.lastBuildKey) {
      this.updateVisibility(visibleBounds);
      return;
    }

    this.clear();
    parent.removeChildren();
    this.parent = parent;
    this.mapBounds = getMapRenderBounds(mapLayout, sceneLayout);
    this.sceneScale = sceneLayout.scale;
    this.lastBuildKey = buildKey;
    this.nextSpawnAtMs = 0;
    this.updateVisibility(visibleBounds);
  }

  shouldAnimate(): boolean {
    return !this.paused && Boolean(this.parent && this.mapBounds && this.texturesByKind.size > 0);
  }

  update(timestampMs: number, visibleBounds: Bounds | null = null): void {
    this.updateVisibility(visibleBounds);

    if (!this.shouldAnimate()) {
      this.lastUpdateAtMs = timestampMs;
      return;
    }

    if (
      this.lastUpdateAtMs > 0 &&
      timestampMs - this.lastUpdateAtMs < MAP_BIRD_UPDATE_MIN_MS
    ) {
      return;
    }

    const deltaSeconds = this.lastUpdateAtMs > 0
      ? Math.min(0.25, (timestampMs - this.lastUpdateAtMs) / 1000)
      : 0;
    this.lastUpdateAtMs = timestampMs;

    this.maybeSpawnFlock(timestampMs, visibleBounds);

    for (const entity of [...this.entities]) {
      if (!entity.container.visible && !this.flightIntersectsVisibleBounds(entity, visibleBounds)) {
        this.removeEntity(entity);
        continue;
      }

      this.updateEntity(entity, timestampMs, deltaSeconds);
    }
  }

  clear(): void {
    for (const entity of this.entities) {
      entity.container.destroy({ children: true });
    }

    this.entities.length = 0;
    this.lastBuildKey = null;
    this.lastUpdateAtMs = 0;
    this.nextSpawnAtMs = 0;
    this.parent = null;
    this.mapBounds = null;
    this.texturesByKind.clear();
  }

  private maybeSpawnFlock(timestampMs: number, visibleBounds: Bounds | null): void {
    const parent = this.parent;
    const mapBounds = this.mapBounds;
    const birdKindId = this.pickBirdKindId();
    const definition = mapBirdDefinitions[birdKindId];
    const textures = this.texturesByKind.get(birdKindId);

    if (!parent || !mapBounds || !textures || timestampMs < this.nextSpawnAtMs) {
      return;
    }

    const availableSlots = Math.max(0, this.getMaxActiveBirds() - this.entities.length);

    if (availableSlots > 0) {
      const flockSize = Math.min(
        availableSlots,
        randomInt(definition.flockSize.min, definition.flockSize.max, this.random()),
      );
      const flight = this.createFlightPath(this.getFlightSpawnBounds(mapBounds, visibleBounds));

      for (let index = 0; index < flockSize; index += 1) {
        const entity = this.createEntity(definition, textures, flight, index);
        this.entities.push(entity);
        parent.addChild(entity.container);
      }
    }

    this.nextSpawnAtMs = timestampMs + randomRange(
      definition.spawnDelaySeconds.min,
      definition.spawnDelaySeconds.max,
      this.random(),
    ) * 1000;
  }

  private createEntity(
    definition: MapBirdDefinition,
    textures: MapBirdTextureSet,
    flight: MapBirdFlightPath,
    flockIndex: number,
  ): MapBirdEntity {
    const offsetX = flockIndex === 0 ? 0 : randomRange(-34, 34, this.random()) * this.sceneScale;
    const offsetY = flockIndex === 0 ? 0 : randomRange(-18, 18, this.random()) * this.sceneScale;
    const altitude = randomRange(
      definition.altitudePixels.min,
      definition.altitudePixels.max,
      this.random(),
    ) * this.sceneScale;
    const speed = randomRange(
      definition.speedPixelsPerSecond.min,
      definition.speedPixelsPerSecond.max,
      this.random(),
    ) * this.sceneScale;
    const sprite = new Sprite(textures[flight.direction][0]);
    sprite.anchor.set(0.5);
    sprite.width = definition.renderWidth * this.sceneScale;
    sprite.height = definition.renderHeight * this.sceneScale;
    sprite.roundPixels = true;

    const shadow = new Graphics();
    const shadowWidth = Math.max(6, definition.renderWidth * this.sceneScale * 0.42);
    const shadowHeight = Math.max(2, definition.renderHeight * this.sceneScale * 0.16);
    const altitudeRatio = Math.max(0, Math.min(1, (altitude / this.sceneScale - definition.altitudePixels.min) /
      Math.max(1, definition.altitudePixels.max - definition.altitudePixels.min)));
    const shadowAlpha = MAP_BIRD_SHADOW_MAX_ALPHA -
      (MAP_BIRD_SHADOW_MAX_ALPHA - MAP_BIRD_SHADOW_MIN_ALPHA) * altitudeRatio;
    shadow.ellipse(0, 0, shadowWidth, shadowHeight).fill({ color: 0x050604, alpha: shadowAlpha });

    const container = new Container();
    container.eventMode = "none";
    container.visible = false;
    container.addChild(shadow, sprite);

    const x = flight.startX + offsetX;
    const y = flight.startY + offsetY;
    const entity: MapBirdEntity = {
      id: `bird:${this.entityCounter++}`,
      definition,
      textures,
      container,
      sprite,
      shadow,
      x,
      y,
      startX: x,
      startY: y,
      endX: flight.endX + offsetX,
      endY: flight.endY + offsetY,
      altitude,
      speed,
      direction: flight.direction,
      frameIndex: Math.floor(this.random() * textures[flight.direction].length),
      frameElapsedSeconds: 0,
      phaseOffset: this.random() * Math.PI * 2,
    };
    this.placeEntity(entity, 0);
    return entity;
  }

  private createFlightPath(mapBounds: Bounds): MapBirdFlightPath {
    const padding = MAP_BIRD_EDGE_PADDING * this.sceneScale;
    const fromWest = this.random() > 0.5;
    const startX = fromWest
      ? mapBounds.x - padding
      : mapBounds.x + mapBounds.width + padding;
    const endX = fromWest
      ? mapBounds.x + mapBounds.width + padding
      : mapBounds.x - padding;
    const startY = randomRange(mapBounds.y + mapBounds.height * 0.08, mapBounds.y + mapBounds.height * 0.72, this.random());
    const endY = randomRange(mapBounds.y + mapBounds.height * 0.08, mapBounds.y + mapBounds.height * 0.72, this.random());

    return {
      startX,
      startY,
      endX,
      endY,
      direction: fromWest ? "east" : "west",
    };
  }

  private getFlightSpawnBounds(mapBounds: Bounds, visibleBounds: Bounds | null): Bounds {
    if (!visibleBounds) {
      return mapBounds;
    }

    const padding = MAP_BIRD_VIEWPORT_PADDING * this.sceneScale;
    const visible = padBounds(visibleBounds, padding);
    const x = Math.max(mapBounds.x, visible.x);
    const y = Math.max(mapBounds.y, visible.y);
    const right = Math.min(mapBounds.x + mapBounds.width, visible.x + visible.width);
    const bottom = Math.min(mapBounds.y + mapBounds.height, visible.y + visible.height);

    if (right <= x || bottom <= y) {
      return mapBounds;
    }

    return {
      x,
      y,
      width: right - x,
      height: bottom - y,
    };
  }

  private updateEntity(entity: MapBirdEntity, timestampMs: number, deltaSeconds: number): void {
    const distanceX = entity.endX - entity.x;
    const distanceY = entity.endY - entity.y;
    const distance = Math.hypot(distanceX, distanceY);

    if (distance <= Math.max(2, entity.speed * deltaSeconds)) {
      this.removeEntity(entity);
      return;
    }

    const ratio = Math.min(1, entity.speed * deltaSeconds / distance);
    entity.x += distanceX * ratio;
    entity.y += distanceY * ratio;
    this.updateAnimationFrame(entity, deltaSeconds);
    this.placeEntity(entity, timestampMs / 1000);
  }

  private updateAnimationFrame(entity: MapBirdEntity, deltaSeconds: number): void {
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

  private placeEntity(entity: MapBirdEntity, visualTime: number): void {
    const drift = Math.sin(visualTime * 2.4 + entity.phaseOffset) * 5 * this.sceneScale;
    entity.shadow.x = entity.x;
    entity.shadow.y = entity.y;
    entity.sprite.x = entity.x;
    entity.sprite.y = entity.y - entity.altitude + drift;
  }

  private removeEntity(entity: MapBirdEntity): void {
    const index = this.entities.indexOf(entity);

    if (index >= 0) {
      this.entities.splice(index, 1);
    }

    entity.container.destroy({ children: true });
  }

  private pickBirdKindId(): MapBirdKindId {
    const available = mapBirdKindIds.filter((kindId) => this.texturesByKind.has(kindId));
    return available[Math.floor(this.random() * available.length)] ?? "smallBird";
  }

  private getMaxActiveBirds(): number {
    return mapBirdKindIds.reduce((maxActive, kindId) => {
      if (!this.texturesByKind.has(kindId)) {
        return maxActive;
      }

      return Math.max(maxActive, mapBirdDefinitions[kindId].maxActive);
    }, 0);
  }

  private updateVisibility(visibleBounds: Bounds | null): void {
    if (!visibleBounds) {
      for (const entity of this.entities) {
        entity.container.visible = true;
      }
      return;
    }

    const paddedBounds = padBounds(visibleBounds, MAP_BIRD_VIEWPORT_PADDING * this.sceneScale);

    for (const entity of this.entities) {
      entity.container.visible = pointInBounds(entity.x, entity.y, paddedBounds) ||
        pointInBounds(entity.sprite.x, entity.sprite.y, paddedBounds);
    }
  }

  private flightIntersectsVisibleBounds(entity: MapBirdEntity, visibleBounds: Bounds | null): boolean {
    if (!visibleBounds) {
      return true;
    }

    const paddedBounds = padBounds(visibleBounds, MAP_BIRD_VIEWPORT_PADDING * this.sceneScale);
    const minX = Math.min(entity.x, entity.endX);
    const maxX = Math.max(entity.x, entity.endX);
    const minY = Math.min(entity.y, entity.endY) - entity.altitude;
    const maxY = Math.max(entity.y, entity.endY);

    return boundsIntersect(
      {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      paddedBounds,
    );
  }

  private random(): number {
    const value = nextRandom(this.seed);
    this.seed = advanceSeed(this.seed);
    return value;
  }

  private getBuildKey(sceneLayout: SceneLayout): string {
    return [
      sceneLayout.scale.toFixed(4),
      sceneLayout.originX.toFixed(2),
      sceneLayout.originY.toFixed(2),
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

function randomInt(min: number, max: number, randomValue: number): number {
  return Math.floor(randomRange(min, max + 1, randomValue));
}

function pointInBounds(x: number, y: number, bounds: Bounds): boolean {
  return x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height;
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
