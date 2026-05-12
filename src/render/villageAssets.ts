import {
  Assets,
  Rectangle,
  Texture,
  type FrameObject,
} from "pixi.js";
import constructionSiteTextureUrl from "../assets/buildings/construction-site.png";
import {
  buildingVisualDefinitions,
  type BuildingVisualDefinition,
} from "../data/buildingVisuals";
import { villageLayoutDefinitions } from "../data/villageLayouts";
import type { BuildingId } from "../game/types";

const terrainTextureCache = new Map<string, Texture>();
const terrainAnimationCache = new Map<string, FrameObject[] | null>();

export class VillageAssets {
  private readonly buildingTextures = new Map<string, Texture>();
  private constructionSiteTexture: Texture | null = null;
  private readonly terrainAtlases = new Map<string, Texture>();
  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadTextures();
    }

    return this.loadPromise;
  }

  getBuildingTexture(buildingId: BuildingId, _level: number, built: boolean): Texture {
    if (!built) {
      return this.constructionSiteTexture ?? Texture.WHITE;
    }

    const visual = this.getBuildingVisual(buildingId);
    const texture = visual ? this.buildingTextures.get(visual.textureUrl) : null;

    return texture ?? Texture.WHITE;
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

  getTerrainTileAnimationFrames(textureKey: string): FrameObject[] | null {
    const cacheKey = `terrain:animation:${textureKey}`;
    const cached = terrainAnimationCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const tile = this.getTerrainTextureDefinition(textureKey);

    if (!tile?.animation || tile.animation.length <= 1) {
      terrainAnimationCache.set(cacheKey, null);
      return null;
    }

    const frames = tile.animation.flatMap((frame): FrameObject[] => {
      const texture = this.getTerrainTileTexture(frame.textureKey);
      return texture
        ? [{ texture, time: frame.durationMs }]
        : [];
    });

    const animationFrames = frames.length > 1 ? frames : null;
    terrainAnimationCache.set(cacheKey, animationFrames);
    return animationFrames;
  }

  private async loadTextures(): Promise<void> {
    await Promise.all([
      this.loadBuildingTextures(),
      this.loadTerrainAtlases(),
    ]);
  }

  private async loadBuildingTextures(): Promise<void> {
    const uniqueTextureUrls = new Set<string>();

    for (const visual of Object.values(buildingVisualDefinitions)) {
      if (visual?.kind === "texture") {
        uniqueTextureUrls.add(visual.textureUrl);
      }
    }

    await Promise.all([
      ...Array.from(uniqueTextureUrls).map(async (textureUrl) => {
        const texture = await Assets.load<Texture>(textureUrl);
        this.buildingTextures.set(textureUrl, texture);
      }),
      Assets.load<Texture>(constructionSiteTextureUrl).then((texture) => {
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

  private getBuildingVisual(buildingId: BuildingId): BuildingVisualDefinition | null {
    const visual = buildingVisualDefinitions[buildingId];
    return visual?.kind === "texture" ? visual : null;
  }
}
