import {
  Assets,
  Rectangle,
  Texture,
  type FrameObject,
} from "pixi.js";
import constructionSiteAtlasUrl from "../assets/buildings/construction-site-atlas.png";
import {
  buildingVisualDefinitions,
  getBuildingVisualFrameKey,
  getBuildingVisualLevel,
  type BuildingAtlasVisualDefinition,
} from "../data/buildingVisuals";
import { villageLayoutDefinitions } from "../data/villageLayouts";
import type { BuildingId } from "../game/types";

const buildingTextureCache = new Map<string, Texture>();
const terrainTextureCache = new Map<string, Texture>();

export class VillageAssets {
  private readonly buildingAtlases = new Map<string, Texture>();
  private constructionSiteTexture: Texture | null = null;
  private readonly terrainAtlases = new Map<string, Texture>();
  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadTextures();
    }

    return this.loadPromise;
  }

  getBuildingTexture(buildingId: BuildingId, level: number, built: boolean): Texture {
    const atlasTexture = this.getAtlasBuildingTexture(buildingId, level, built);

    if (atlasTexture) {
      return atlasTexture;
    }

    return built ? Texture.WHITE : this.constructionSiteTexture ?? Texture.WHITE;
  }

  getBuildingAnimationFrames(buildingId: BuildingId, level: number, built: boolean): FrameObject[] | null {
    if (!built) {
      return null;
    }

    const visual = buildingVisualDefinitions[buildingId];

    if (!visual || visual.kind !== "atlas") {
      return null;
    }

    const frameKey = getBuildingVisualFrameKey(buildingId, level);
    const animation = visual.animations?.[frameKey];

    if (!animation || animation.length <= 1) {
      return null;
    }

    const frames = animation.flatMap((frame): FrameObject[] => {
      const texture = this.getAtlasFrameTexture(buildingId, visual, getBuildingVisualLevel(level), frame.frameKey);
      return texture
        ? [{ texture, time: frame.durationMs }]
        : [];
    });

    return frames.length > 1 ? frames : null;
  }

  getTerrainTileTexture(textureKey: string): Texture | null {
    const tile = this.getTerrainTextureDefinition(textureKey);
    const atlas = tile ? this.terrainAtlases.get(tile.atlasUrl) : null;

    if (!atlas || !tile) {
      return null;
    }

    const key = `terrain:${textureKey}`;
    const cached = terrainTextureCache.get(key);

    if (cached) {
      return cached;
    }

    const texture = new Texture({
      source: atlas.source,
      frame: new Rectangle(
        tile.frame.x,
        tile.frame.y,
        tile.frame.width,
        tile.frame.height,
      ),
    });

    terrainTextureCache.set(key, texture);
    return texture;
  }

  private async loadTextures(): Promise<void> {
    await Promise.all([
      this.loadBuildingAtlases(),
      this.loadTerrainAtlases(),
    ]);
  }

  private async loadBuildingAtlases(): Promise<void> {
    const atlasDefinitions = Object.values(buildingVisualDefinitions)
      .filter((visual): visual is BuildingAtlasVisualDefinition => visual?.kind === "atlas");
    const uniqueAtlasUrls = new Map<string, string>();

    for (const visual of atlasDefinitions) {
      uniqueAtlasUrls.set(visual.atlasId, visual.atlasUrl);
    }

    await Promise.all([
      ...Array.from(uniqueAtlasUrls).map(async ([atlasId, atlasUrl]) => {
        const texture = await Assets.load<Texture>(atlasUrl);
        this.buildingAtlases.set(atlasId, texture);
      }),
      Assets.load<Texture>(constructionSiteAtlasUrl).then((texture) => {
        this.constructionSiteTexture = texture;
      }),
    ]);
  }

  private async loadTerrainAtlases(): Promise<void> {
    const atlasUrls = new Set<string>();

    for (const layout of villageLayoutDefinitions) {
      for (const tile of Object.values(layout.tileTextures)) {
        atlasUrls.add(tile.atlasUrl);
      }
    }

    await Promise.all(
      Array.from(atlasUrls).map(async (atlasUrl) => {
        const texture = await Assets.load<Texture>(atlasUrl);
        this.terrainAtlases.set(atlasUrl, texture);
      }),
    );
  }

  private getTerrainTextureDefinition(textureKey: string) {
    for (const layout of villageLayoutDefinitions) {
      const tile = layout.tileTextures[textureKey];

      if (tile) {
        return tile;
      }
    }

    return null;
  }

  private getAtlasBuildingTexture(
    buildingId: BuildingId,
    level: number,
    built: boolean,
  ): Texture | null {
    if (!built) {
      return null;
    }

    const visual = buildingVisualDefinitions[buildingId];

    if (!visual || visual.kind !== "atlas") {
      return null;
    }

    const atlas = this.buildingAtlases.get(visual.atlasId);

    if (!atlas) {
      return null;
    }

    const visualLevel = getBuildingVisualLevel(level);
    const frameKey = getBuildingVisualFrameKey(buildingId, level);
    return this.getAtlasFrameTexture(buildingId, visual, visualLevel, frameKey);
  }

  private getAtlasFrameTexture(
    buildingId: BuildingId,
    visual: BuildingAtlasVisualDefinition,
    visualLevel: number,
    frameKey: string,
  ): Texture | null {
    const atlas = this.buildingAtlases.get(visual.atlasId);

    if (!atlas) {
      return null;
    }

    const frame = visual.frames?.[frameKey] ?? this.getGridFrame(visual, visualLevel);

    if (!frame) {
      return null;
    }

    const key = `${buildingId}:atlas:${frameKey}`;
    const cached = buildingTextureCache.get(key);

    if (cached) {
      return cached;
    }

    const texture = new Texture({
      source: atlas.source,
      frame: new Rectangle(
        frame.x,
        frame.y,
        frame.width,
        frame.height,
      ),
    });

    buildingTextureCache.set(key, texture);
    return texture;
  }

  private getGridFrame(visual: BuildingAtlasVisualDefinition, visualLevel: number) {
    const frameIndex = visualLevel - 1;
    const frameCount = visual.columns * visual.rows;

    if (frameIndex < 0 || frameIndex >= frameCount) {
      return null;
    }

    return {
      x: (frameIndex % visual.columns) * visual.frameWidth,
      y: Math.floor(frameIndex / visual.columns) * visual.frameHeight,
      width: visual.frameWidth,
      height: visual.frameHeight,
    };
  }
}
