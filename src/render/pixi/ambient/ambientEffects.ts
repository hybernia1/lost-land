import {
  type Application,
  Container,
  Graphics,
  Sprite,
  type FrameObject,
} from "pixi.js";
import { DAYLIGHT_DARKNESS_BUCKET_STEP, DAYLIGHT_TRANSITION_FRAME_MIN_MS, RADIATION_MOTE_MAX_COUNT, RADIATION_MOTE_MIN_COUNT, RAIN_LAYER_A_MAX_COUNT, RAIN_LAYER_A_MIN_COUNT, RAIN_LAYER_B_MAX_COUNT, RAIN_LAYER_B_MIN_COUNT, TEXTURE_ANIMATION_FRAME_MIN_MS, VISUAL_FRAME_MIN_MS, WEATHER_OVERLAY_FRAME_MIN_MS } from "../core/constants";
import type { TextureAnimationBinding, TextureAnimationFrame } from "../core/types";
import { ENVIRONMENT_MAX_INTENSITY } from "../../../data/environment";
import { getDaylightState } from "../../../game/time";
import type { EnvironmentConditionId, GameSpeed, GameState } from "../../../game/types";

const LOW_PRIORITY_VISUAL_FRAME_MIN_MS = TEXTURE_ANIMATION_FRAME_MIN_MS;

type AmbientEffectsHost = {
  host: HTMLElement;
  getApp: () => Application | null;
  environmentOverlayGraphic: Graphics;
  daylightOverlayGraphic: Graphics;
  shouldAnimateCamera: () => boolean;
  refreshCameraTransform: () => void;
  shouldAnimateMapBirds: () => boolean;
  refreshMapBirds: (timestampMs: number) => void;
  shouldAnimateMapNpcs: () => boolean;
  refreshMapNpcs: (timestampMs: number) => void;
};

export class AmbientEffectsController {
  private ambientAnimationFrameId: number | null = null;
  private ambientCondition: EnvironmentConditionId = "stable";
  private ambientIntensity = 1;
  private ambientElapsedSeconds = 0;
  private ambientSpeed: GameSpeed = 1;
  private ambientPaused = false;
  private ambientSyncAtMs = 0;
  private lastVisualFrameAtMs = 0;
  private lastEnvironmentOverlayFrameAtMs = 0;
  private lastDaylightOverlayFrameAtMs = 0;
  private lastEnvironmentOverlayKey = "";
  private lastDaylightOverlayKey = "";
  private lastTextureAnimationFrameAtMs = 0;
  private textureAnimationBindingCounter = 0;
  private readonly noiseSeedCache: number[] = [];
  private readonly textureAnimationBindings = new Set<TextureAnimationBinding>();
  private readonly handleAmbientAnimationFrame = (timestamp: number) => this.animateFrame(timestamp);

  constructor(private readonly hostState: AmbientEffectsHost) {}

  syncState(state: GameState): void {
    this.ambientCondition = state.environment.condition;
    this.ambientIntensity = state.environment.intensity;
    this.ambientElapsedSeconds = state.elapsedSeconds;
    this.ambientSpeed = state.speed;
    this.ambientPaused = state.paused;
    this.ambientSyncAtMs = performance.now();
  }

  refreshOverlays(nowMs: number, force = false): void {
    const app = this.hostState.getApp();
    const width = app?.screen.width ?? this.hostState.host.clientWidth;
    const height = app?.screen.height ?? this.hostState.host.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    const visualTime = nowMs / 1000;
    const elapsedSeconds = this.getAmbientElapsedSeconds(nowMs);
    this.refreshEnvironmentOverlay(width, height, visualTime, nowMs, force);
    this.refreshDaylightOverlay(width, height, elapsedSeconds, nowMs, force);
  }

  updateAnimationLoop(): void {
    if (this.shouldAnimateVisuals()) {
      this.startAnimation();
      return;
    }

    this.stopAnimation();
  }

  stopAnimation(): void {
    if (this.ambientAnimationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.ambientAnimationFrameId);
    this.ambientAnimationFrameId = null;
  }

  createTerrainSprite(
    textureKey: string,
    getAnimationFrames: (key: string) => FrameObject[] | null,
    getTexture: (key: string) => FrameObject["texture"] | null,
  ): Sprite | null {
    const animationFrames = getAnimationFrames(textureKey);

    if (animationFrames) {
      const sprite = new Sprite();
      this.registerTextureAnimation(sprite, animationFrames);
      return sprite;
    }

    const texture = getTexture(textureKey);
    return texture ? new Sprite(texture) : null;
  }

  resolveAnimationTexture(
    animationFrames: FrameObject[],
    nowMs: number,
  ): FrameObject["texture"] | null {
    const frames = animationFrames.flatMap((frame): TextureAnimationFrame[] => {
      const durationMs = typeof frame.time === "number" ? frame.time : 100;
      return durationMs > 0
        ? [{ texture: frame.texture, durationMs }]
        : [];
    });

    if (frames.length === 0) {
      return null;
    }

    if (frames.length === 1) {
      return frames[0].texture;
    }

    const totalDurationMs = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
    if (totalDurationMs <= 0) {
      return frames[0].texture;
    }

    const frameIndex = this.getTextureAnimationFrameIndex(
      frames,
      totalDurationMs,
      nowMs,
    );
    return frames[frameIndex]?.texture ?? frames[0].texture;
  }

  unregisterTextureAnimationsForNode(node: Container): void {
    for (const binding of Array.from(this.textureAnimationBindings)) {
      if (binding.sprite === node) {
        this.textureAnimationBindings.delete(binding);
      }
    }

    for (const child of node.children) {
      this.unregisterTextureAnimationsForNode(child as Container);
    }
  }

  private shouldAnimateVisuals(): boolean {
    return this.shouldAnimateAmbientOverlays() ||
      this.textureAnimationBindings.size > 0 ||
      this.hostState.shouldAnimateCamera() ||
      this.hostState.shouldAnimateMapBirds() ||
      this.hostState.shouldAnimateMapNpcs();
  }

  private startAnimation(): void {
    if (this.ambientAnimationFrameId !== null) {
      return;
    }

    this.ambientAnimationFrameId = window.requestAnimationFrame(this.handleAmbientAnimationFrame);
  }

  private animateFrame(timestamp: number): void {
    this.ambientAnimationFrameId = null;

    const app = this.hostState.getApp();
    if (!app) {
      return;
    }

    if (
      this.lastVisualFrameAtMs > 0 &&
      timestamp - this.lastVisualFrameAtMs < this.getVisualFrameMinMs()
    ) {
      if (this.shouldAnimateVisuals()) {
        this.ambientAnimationFrameId = window.requestAnimationFrame(this.handleAmbientAnimationFrame);
      }
      return;
    }
    this.lastVisualFrameAtMs = timestamp;

    if (this.shouldAnimateAmbientOverlays()) {
      this.refreshOverlays(timestamp);
    }

    this.refreshTextureAnimations(timestamp);
    this.hostState.refreshMapBirds(timestamp);
    this.hostState.refreshMapNpcs(timestamp);
    this.hostState.refreshCameraTransform();
    app.render();

    if (this.shouldAnimateVisuals()) {
      this.ambientAnimationFrameId = window.requestAnimationFrame(this.handleAmbientAnimationFrame);
    }
  }

  private getVisualFrameMinMs(): number {
    if (this.shouldAnimateAmbientOverlays() || this.hostState.shouldAnimateCamera()) {
      return VISUAL_FRAME_MIN_MS;
    }

    return LOW_PRIORITY_VISUAL_FRAME_MIN_MS;
  }

  private redrawEnvironmentOverlay(
    graphic: Graphics,
    condition: EnvironmentConditionId,
    intensityRaw: number,
    width: number,
    height: number,
    visualTime: number,
  ): void {
    graphic.clear();

    if (condition === "stable") {
      return;
    }

    const intensity = Math.max(1, Math.min(ENVIRONMENT_MAX_INTENSITY, intensityRaw));
    const hazeColor = condition === "radiation"
      ? 0x98cf6a
      : condition === "snowFront"
        ? 0xd9e6f2
        : 0x4d7694;
    const hazeAlpha = condition === "radiation"
      ? 0.07 + intensity * 0.03
      : condition === "snowFront"
        ? 0.06 + intensity * 0.022
        : 0.055 + intensity * 0.018;

    graphic.rect(0, 0, width, height).fill({ color: hazeColor, alpha: hazeAlpha });

    if (condition === "rain") {
      const area = width * height;
      const laneACount = Math.max(
        RAIN_LAYER_A_MIN_COUNT,
        Math.min(
          RAIN_LAYER_A_MAX_COUNT,
          Math.round((area / 4200) * (0.9 + intensity * 0.22)),
        ),
      );
      const laneBCount = Math.max(
        RAIN_LAYER_B_MIN_COUNT,
        Math.min(
          RAIN_LAYER_B_MAX_COUNT,
          Math.round((area / 6000) * (0.85 + intensity * 0.18)),
        ),
      );
      const travelA = height + 120;
      const travelB = height + 110;
      const dropLenA = 8 + intensity * 2.1;
      const dropLenB = 6 + intensity * 1.7;

      for (let index = 0; index < laneACount; index += 1) {
        const seedX = this.getNoiseSeed(index * 5 + 11);
        const seedY = this.getNoiseSeed(index * 5 + 17);
        const seedWind = this.getNoiseSeed(index * 5 + 23);
        const speed = 210 + intensity * 30 + seedY * 90;
        const y = ((seedY * travelA) + visualTime * speed) % travelA - 54;
        const xBase = seedX * (width + 80) - 40;
        const windWave = this.triangleWave(visualTime * (0.46 + seedWind * 0.34) + seedX * 5.4);
        const wind = windWave * (1.8 + intensity * 0.48);
        const x = xBase + wind;
        graphic.moveTo(x, y - dropLenA * 0.42);
        graphic.lineTo(x + wind * 0.16, y + dropLenA);
      }
      graphic.stroke({ color: 0xbdddef, alpha: 0.2 + intensity * 0.04, width: 1.08 });

      for (let index = 0; index < laneBCount; index += 1) {
        const seedX = this.getNoiseSeed(index * 7 + 401);
        const seedY = this.getNoiseSeed(index * 7 + 409);
        const seedWind = this.getNoiseSeed(index * 7 + 421);
        const speed = 170 + intensity * 24 + seedY * 70;
        const y = ((seedY * travelB) + visualTime * speed) % travelB - 50;
        const xBase = seedX * (width + 60) - 30;
        const windWave = this.triangleWave(visualTime * (0.38 + seedWind * 0.29) + seedX * 4.2);
        const wind = windWave * (1.3 + intensity * 0.35);
        const x = xBase + wind;
        graphic.moveTo(x, y - dropLenB * 0.35);
        graphic.lineTo(x + wind * 0.1, y + dropLenB);

        if (
          y > height * 0.84 &&
          this.triangleWave(visualTime * (2.4 + seedWind * 1.6) + seedX * 9.5) > 0.72
        ) {
          graphic.circle(x + wind * 0.2, y + dropLenB + 1.3, 0.78 + intensity * 0.12)
            .fill({ color: 0xd8ecf7, alpha: 0.08 + intensity * 0.02 });
        }
      }
      graphic.stroke({ color: 0xd8eef8, alpha: 0.12 + intensity * 0.03, width: 0.76 });
    }

    if (condition === "snowFront") {
      const area = width * height;
      const layerACount = Math.max(120, Math.round((area / 9000) * (0.9 + intensity * 0.18)));
      const layerBCount = Math.max(90, Math.round((area / 14000) * (0.9 + intensity * 0.15)));
      const travel = height + 88;
      const windDrift = visualTime * (7 + intensity * 1.2);
      const fallA = visualTime * (30 + intensity * 5.5);
      const fallB = visualTime * (22 + intensity * 4.2);

      for (let index = 0; index < layerACount; index += 1) {
        const seedX = this.seededUnit(index + 11);
        const seedY = this.seededUnit(index + 137);
        const seedPhase = this.seededUnit(index + 307);
        const x = ((seedX * width) + windDrift * (0.7 + seedY * 0.8)) % (width + 32) - 16;
        const y = ((seedY * travel) + fallA * (0.9 + seedX * 0.6)) % travel - 44;
        const flutter = Math.sin(visualTime * (1.3 + seedPhase * 0.8) + seedX * 8) * (1 + intensity * 0.18);
        const radius = 1.25 + seedPhase * 0.9 + intensity * 0.16;
        graphic.circle(x + flutter, y, radius).fill({
          color: 0xffffff,
          alpha: 0.16 + intensity * 0.04,
        });
      }

      for (let index = 0; index < layerBCount; index += 1) {
        const seedX = this.seededUnit(index + 503);
        const seedY = this.seededUnit(index + 911);
        const seedPhase = this.seededUnit(index + 1237);
        const x = ((seedX * width) + windDrift * 1.25 * (0.7 + seedY * 0.6)) % (width + 24) - 12;
        const y = ((seedY * travel) + fallB * (0.85 + seedX * 0.55)) % travel - 40;
        const flutter = Math.sin(visualTime * (1.9 + seedPhase * 0.7) + seedY * 10) * (0.8 + intensity * 0.12);
        const radius = 0.9 + seedPhase * 0.55 + intensity * 0.1;
        graphic.circle(x + flutter, y, radius).fill({
          color: 0xeef6ff,
          alpha: 0.1 + intensity * 0.028,
        });
      }
    }

    if (condition === "radiation") {
      const bandSpacing = Math.max(20, 34 - intensity * 3);
      const scanOffset = (visualTime * (24 + intensity * 5)) % bandSpacing;
      for (let y = scanOffset; y < height + bandSpacing; y += bandSpacing) {
        const bend = this.triangleWave(y * 0.01 + visualTime * 0.48) * (3.6 + intensity);
        graphic.moveTo(-6, y);
        graphic.lineTo(width + 6, y + bend);
      }
      graphic.stroke({ color: 0xc9f187, alpha: 0.09 + intensity * 0.035, width: 1 });

      const area = width * height;
      const moteCount = Math.max(
        RADIATION_MOTE_MIN_COUNT,
        Math.min(
          RADIATION_MOTE_MAX_COUNT,
          Math.round((area / 5600) * (0.88 + intensity * 0.2)),
        ),
      );
      for (let index = 0; index < moteCount; index += 1) {
        const seedX = this.getNoiseSeed(index * 3 + 1801);
        const seedY = this.getNoiseSeed(index * 3 + 1811);
        const seedPhase = this.getNoiseSeed(index * 3 + 1831);
        const x = seedX * width;
        const y = seedY * height;
        const jitterX = this.triangleWave(visualTime * (1.18 + seedPhase * 0.8) + seedX * 8.2) * 5.5;
        const jitterY = this.triangleWave(visualTime * (0.96 + seedPhase * 0.7) + seedY * 7.4) * 4.8;
        graphic.circle(x + jitterX, y + jitterY, 1 + intensity * 0.2).fill({
          color: 0xd8f8a6,
          alpha: 0.06 + intensity * 0.025,
        });
      }
    }
  }

  private redrawDaylightOverlay(
    graphic: Graphics,
    elapsedSeconds: number,
    width: number,
    height: number,
  ): void {
    graphic.clear();

    const daylight = getDaylightState(elapsedSeconds);

    if (daylight.darkness <= 0) {
      return;
    }

    const tint = daylight.phase === "dusk"
      ? 0x231621
      : daylight.phase === "dawn"
        ? 0x152233
        : 0x071322;
    const skyAlpha = Math.min(0.72, daylight.darkness * 1.05);
    const screenX = -1;
    const screenY = -1;
    const screenWidth = Math.ceil(width) + 2;
    const screenHeight = Math.ceil(height) + 2;

    graphic.rect(screenX, screenY, screenWidth, screenHeight)
      .fill({ color: tint, alpha: skyAlpha });

    const horizonAlpha = Math.min(0.14, daylight.darkness * 0.32);
    const horizonColor = daylight.phase === "dusk" ? 0x7b452d : 0x37576f;
    const horizonStart = Math.floor(height * 0.48);
    const horizonEnd = Math.ceil(height + 1);
    const horizonBands = 18;
    const horizonBandHeight = Math.max(2, Math.ceil((horizonEnd - horizonStart) / horizonBands));

    for (let bandIndex = 0; bandIndex < horizonBands; bandIndex += 1) {
      const progress = (bandIndex + 1) / horizonBands;
      const eased = progress * progress;
      const y = horizonStart + bandIndex * horizonBandHeight;
      const bandAlpha = horizonAlpha * eased;
      graphic.rect(screenX, y, screenWidth, horizonBandHeight + 1)
        .fill({ color: horizonColor, alpha: bandAlpha });
    }

    if (daylight.phase === "night") {
      const topShadeAlpha = Math.min(0.18, daylight.darkness * 0.24);
      const topShadeHeight = Math.max(2, Math.ceil(height * 0.36) + 1);
      const topShadeBands = 18;
      const topShadeBandHeight = Math.max(2, Math.ceil(topShadeHeight / topShadeBands));

      for (let bandIndex = 0; bandIndex < topShadeBands; bandIndex += 1) {
        const progress = bandIndex / Math.max(1, topShadeBands - 1);
        const falloff = 1 - progress;
        const bandAlpha = topShadeAlpha * falloff * falloff;
        const y = screenY + bandIndex * topShadeBandHeight;
        const remainingHeight = topShadeHeight - bandIndex * topShadeBandHeight;

        if (remainingHeight <= 0 || bandAlpha <= 0.001) {
          break;
        }

        graphic.rect(screenX, y, screenWidth, Math.min(topShadeBandHeight + 1, remainingHeight + 1))
          .fill({ color: 0x040b14, alpha: bandAlpha });
      }
    }
  }

  private refreshEnvironmentOverlay(
    width: number,
    height: number,
    visualTime: number,
    nowMs: number,
    force: boolean,
  ): void {
    const overlayKey = `${this.ambientCondition}|${this.ambientIntensity}|${Math.round(width)}|${Math.round(height)}`;
    const needsKeyRefresh = overlayKey !== this.lastEnvironmentOverlayKey;
    const isAnimatedWeather = this.ambientCondition !== "stable";

    if (
      !force &&
      !needsKeyRefresh &&
      isAnimatedWeather &&
      this.lastEnvironmentOverlayFrameAtMs > 0 &&
      nowMs - this.lastEnvironmentOverlayFrameAtMs < WEATHER_OVERLAY_FRAME_MIN_MS
    ) {
      return;
    }

    this.redrawEnvironmentOverlay(
      this.hostState.environmentOverlayGraphic,
      this.ambientCondition,
      this.ambientIntensity,
      width,
      height,
      visualTime,
    );
    this.lastEnvironmentOverlayKey = overlayKey;
    this.lastEnvironmentOverlayFrameAtMs = nowMs;
  }

  private refreshDaylightOverlay(
    width: number,
    height: number,
    elapsedSeconds: number,
    nowMs: number,
    force: boolean,
  ): void {
    const daylight = getDaylightState(elapsedSeconds);
    const isDaylightTransition = daylight.phase === "dusk" || daylight.phase === "dawn";
    const darknessBucket = Math.round(daylight.darkness / DAYLIGHT_DARKNESS_BUCKET_STEP);
    const key = `${daylight.phase}|${darknessBucket}|${Math.round(width)}|${Math.round(height)}`;
    const needsKeyRefresh = key !== this.lastDaylightOverlayKey;

    if (!force && !needsKeyRefresh) {
      if (!isDaylightTransition) {
        return;
      }

      if (
        this.lastDaylightOverlayFrameAtMs > 0 &&
        nowMs - this.lastDaylightOverlayFrameAtMs < DAYLIGHT_TRANSITION_FRAME_MIN_MS
      ) {
        return;
      }
    }

    this.redrawDaylightOverlay(this.hostState.daylightOverlayGraphic, elapsedSeconds, width, height);
    this.lastDaylightOverlayKey = key;
    this.lastDaylightOverlayFrameAtMs = nowMs;
  }

  private getAmbientElapsedSeconds(nowMs: number): number {
    if (this.ambientPaused) {
      return this.ambientElapsedSeconds;
    }

    return this.ambientElapsedSeconds + ((nowMs - this.ambientSyncAtMs) / 1000) * this.ambientSpeed;
  }

  private shouldAnimateAmbientOverlays(): boolean {
    const isEnvironmentAnimated = this.ambientCondition !== "stable";
    const daylightPhase = getDaylightState(this.ambientElapsedSeconds).phase;
    const isDaylightAnimated = daylightPhase === "dusk" || daylightPhase === "dawn";
    return isEnvironmentAnimated || isDaylightAnimated;
  }

  private registerTextureAnimation(
    sprite: Sprite,
    animationFrames: FrameObject[],
  ): void {
    const frames = animationFrames.flatMap((frame): TextureAnimationFrame[] => {
      const durationMs = typeof frame.time === "number" ? frame.time : 100;
      return durationMs > 0
        ? [{ texture: frame.texture, durationMs }]
        : [];
    });

    if (frames.length <= 1) {
      if (frames[0]) {
        sprite.texture = frames[0].texture;
      }
      return;
    }

    const totalDurationMs = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
    if (totalDurationMs <= 0) {
      sprite.texture = frames[0].texture;
      return;
    }

    const binding: TextureAnimationBinding = {
      sprite,
      frames,
      totalDurationMs,
      currentFrameIndex: -1,
      phaseOffsetMs: this.getNoiseSeed(this.textureAnimationBindingCounter++) * totalDurationMs,
    };

    this.textureAnimationBindings.add(binding);
    this.applyTextureAnimationFrame(binding, performance.now());
    this.updateAnimationLoop();
  }

  private refreshTextureAnimations(nowMs: number): void {
    if (this.textureAnimationBindings.size === 0) {
      return;
    }

    if (
      this.lastTextureAnimationFrameAtMs > 0 &&
      nowMs - this.lastTextureAnimationFrameAtMs < TEXTURE_ANIMATION_FRAME_MIN_MS
    ) {
      return;
    }
    this.lastTextureAnimationFrameAtMs = nowMs;

    for (const binding of Array.from(this.textureAnimationBindings)) {
      if (binding.sprite.destroyed || !binding.sprite.parent) {
        this.textureAnimationBindings.delete(binding);
        continue;
      }

      this.applyTextureAnimationFrame(binding, nowMs);
    }
  }

  private applyTextureAnimationFrame(binding: TextureAnimationBinding, nowMs: number): void {
    const frameIndex = this.getTextureAnimationFrameIndex(
      binding.frames,
      binding.totalDurationMs,
      nowMs + binding.phaseOffsetMs,
    );

    if (frameIndex === binding.currentFrameIndex) {
      return;
    }

    binding.currentFrameIndex = frameIndex;
    binding.sprite.texture = binding.frames[frameIndex].texture;
  }

  private getTextureAnimationFrameIndex(
    frames: TextureAnimationFrame[],
    totalDurationMs: number,
    nowMs: number,
  ): number {
    const loopPositionMs = nowMs % totalDurationMs;
    let elapsed = 0;

    for (let index = 0; index < frames.length; index += 1) {
      elapsed += frames[index].durationMs;
      if (loopPositionMs < elapsed) {
        return index;
      }
    }

    return frames.length - 1;
  }

  private seededUnit(seed: number): number {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  private getNoiseSeed(index: number): number {
    const normalizedIndex = Math.max(0, Math.floor(index));
    const cached = this.noiseSeedCache[normalizedIndex];

    if (cached !== undefined) {
      return cached;
    }

    const value = this.seededUnit(normalizedIndex + 1);
    this.noiseSeedCache[normalizedIndex] = value;
    return value;
  }

  private triangleWave(value: number): number {
    const fractional = value - Math.floor(value);
    return (1 - Math.abs(fractional * 2 - 1)) * 2 - 1;
  }
}
