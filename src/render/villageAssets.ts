import {
  Assets,
  Rectangle,
  Texture,
} from "pixi.js";
import villageBackgroundUrl from "../assets/village-bg.webp";
import {
  buildingVisualDefinitions,
  getBuildingVisualFrameKey,
  getBuildingVisualLevel,
  type BuildingAtlasVisualDefinition,
} from "../data/buildingVisuals";
import { villageLayoutDefinitions } from "../data/villageLayouts";
import type { BuildingId, EnvironmentConditionId } from "../game/types";
import { drawBuildingAsset } from "./buildingAssets";

const fallbackBackgroundUrls: Record<EnvironmentConditionId, string> = {
  stable: villageBackgroundUrl,
  rain: villageBackgroundUrl,
  snowFront: villageBackgroundUrl,
  radiation: villageBackgroundUrl,
};

const buildingTextureCache = new Map<string, Texture>();
const terrainTextureCache = new Map<string, Texture>();

export class VillageAssets {
  private readonly backgroundTextures = new Map<EnvironmentConditionId, Texture>();
  private readonly buildingAtlases = new Map<string, Texture>();
  private readonly terrainAtlases = new Map<string, Texture>();
  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadTextures();
    }

    return this.loadPromise;
  }

  getBackgroundTexture(condition: EnvironmentConditionId): Texture | null {
    return this.backgroundTextures.get(condition) ??
      this.backgroundTextures.get("stable") ??
      null;
  }

  getBuildingTexture(buildingId: BuildingId, level: number, built: boolean): Texture {
    const atlasTexture = this.getAtlasBuildingTexture(buildingId, level, built);

    if (atlasTexture) {
      return atlasTexture;
    }

    const key = `${buildingId}:${level}:${built ? "built" : "ghost"}`;
    const cached = buildingTextureCache.get(key);

    if (cached) {
      return cached;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const context = canvas.getContext("2d");

    if (!context) {
      return Texture.WHITE;
    }

    context.translate(canvas.width / 2, canvas.height * 0.52);
    drawBuildingAsset(context, {
      id: buildingId,
      width: 130,
      height: 92,
      level,
      built,
      scale: 1.25,
    });

    const texture = Texture.from(canvas);
    buildingTextureCache.set(key, texture);
    return texture;
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
      this.loadBackgroundTextures(),
      this.loadBuildingAtlases(),
      this.loadTerrainAtlases(),
    ]);
  }

  private async loadBackgroundTextures(): Promise<void> {
    await Promise.all(
      Object.entries(fallbackBackgroundUrls).map(async ([condition, url]) => {
        const texture = await Assets.load<Texture>(url);
        this.backgroundTextures.set(condition as EnvironmentConditionId, texture);
      }),
    );
  }

  private async loadBuildingAtlases(): Promise<void> {
    const atlasDefinitions = Object.values(buildingVisualDefinitions)
      .filter((visual): visual is BuildingAtlasVisualDefinition => visual?.kind === "atlas");
    const uniqueAtlasUrls = new Map<string, string>();

    for (const visual of atlasDefinitions) {
      uniqueAtlasUrls.set(visual.atlasId, visual.atlasUrl);
    }

    await Promise.all(
      Array.from(uniqueAtlasUrls).map(async ([atlasId, atlasUrl]) => {
        const texture = await Assets.load<Texture>(atlasUrl);
        this.buildingAtlases.set(atlasId, texture);
      }),
    );
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
    const frameIndex = visualLevel - 1;
    const frameCount = visual.columns * visual.rows;

    if (frameIndex < 0 || frameIndex >= frameCount) {
      return null;
    }

    const atlas = this.buildingAtlases.get(visual.atlasId);

    if (!atlas) {
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
        (frameIndex % visual.columns) * visual.frameWidth,
        Math.floor(frameIndex / visual.columns) * visual.frameHeight,
        visual.frameWidth,
        visual.frameHeight,
      ),
    });

    buildingTextureCache.set(key, texture);
    return texture;
  }
}
