import {
  Assets,
  Rectangle,
  Texture,
  type FrameObject,
} from "pixi.js";
import constructionSiteTextureUrl from "../assets/buildings/construction-site.png";
import settlementPalisadeTextureUrl from "../assets/sites/settlement-palisade.png";
import {
  mapBirdDefinitions,
  type MapBirdKindId,
} from "../data/mapBirds";
import {
  mapNpcDefinitions,
  type MapNpcKindId,
} from "../data/mapNpcs";
import {
  settlementBattleMap,
  type SettlementBattleTileId,
} from "../data/settlementBattleMap";
import type { VillageResourceSitePalisadeType } from "../data/villagePlots";
import {
  buildingVisualDefinitions,
  type BuildingVisualDefinition,
} from "../data/buildingVisuals";
import type { TerrainTextureDefinition } from "../data/terrainTiles";
import { villageLayoutDefinitions } from "../data/villageLayouts";
import type { BuildingId } from "../game/types";
import settlementPalisadeStoneTextureUrl from "../assets/sites/settlement-palisade-stone.png";
import settlementPalisadeScrapTextureUrl from "../assets/sites/settlement-palisade-scrap.png";

const terrainTextureCache = new Map<string, Texture>();
const terrainAnimationCache = new Map<string, FrameObject[] | null>();
const terrainTextureDefinitionByKey = new Map<string, TerrainTextureDefinition>();
const terrainTextureKeysByAtlasUrl = new Map<string, string[]>();

export type MapNpcTextureSet = {
  west: Texture[];
  east: Texture[];
};

export type MapBirdTextureSet = {
  west: Texture[];
  east: Texture[];
};

for (const layout of villageLayoutDefinitions) {
  for (const [textureKey, definition] of Object.entries(layout.tileTextures)) {
    if (!terrainTextureDefinitionByKey.has(textureKey)) {
      terrainTextureDefinitionByKey.set(textureKey, definition);
    }

    const keys = terrainTextureKeysByAtlasUrl.get(definition.atlasUrl);
    if (keys) {
      keys.push(textureKey);
    } else {
      terrainTextureKeysByAtlasUrl.set(definition.atlasUrl, [textureKey]);
    }
  }
}

export class VillageAssets {
  private readonly buildingTextures = new Map<string, Texture>();
  private constructionSiteTexture: Texture | null = null;
  private readonly terrainAtlases = new Map<string, Texture>();
  private readonly mapBirdAtlases = new Map<string, Texture>();
  private readonly mapBirdTextures = new Map<MapBirdKindId, MapBirdTextureSet>();
  private readonly mapNpcAtlases = new Map<string, Texture>();
  private readonly mapNpcTextures = new Map<MapNpcKindId, MapNpcTextureSet>();
  private battleTileAtlas: Texture | null = null;
  private readonly battleTileTextures = new Map<SettlementBattleTileId, Texture>();
  private readonly settlementPalisadeTextures = new Map<VillageResourceSitePalisadeType, Texture>();
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

  hasTerrainTileAnimation(textureKey: string): boolean {
    const tile = this.getTerrainTextureDefinition(textureKey);
    return Boolean(tile?.animation && tile.animation.length > 1);
  }

  getMapNpcTextures(kindId: MapNpcKindId): MapNpcTextureSet | null {
    return this.mapNpcTextures.get(kindId) ?? null;
  }

  getMapBirdTextures(kindId: MapBirdKindId): MapBirdTextureSet | null {
    return this.mapBirdTextures.get(kindId) ?? null;
  }

  getSettlementBattleTileTexture(tileId: SettlementBattleTileId): Texture | null {
    return this.battleTileTextures.get(tileId) ?? null;
  }

  getSettlementPalisadeTexture(type: VillageResourceSitePalisadeType): Texture | null {
    return this.settlementPalisadeTextures.get(type) ??
      this.settlementPalisadeTextures.get("wood") ??
      null;
  }

  private async loadTextures(): Promise<void> {
    await Promise.all([
      this.loadBuildingTextures(),
      this.loadTerrainAtlases(),
      this.loadMapBirdAtlases(),
      this.loadMapNpcAtlases(),
      this.loadBattleTileAtlas(),
      this.loadSettlementPalisadeTexture(),
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
        texture.source.scaleMode = "nearest";
        this.buildingTextures.set(textureUrl, texture);
      }),
      Assets.load<Texture>(constructionSiteTextureUrl).then((texture) => {
        texture.source.scaleMode = "nearest";
        this.constructionSiteTexture = texture;
      }),
    ]);
  }

  private async loadTerrainAtlases(): Promise<void> {
    await Promise.all(
      Array.from(terrainTextureKeysByAtlasUrl.keys()).map(async (atlasUrl) => {
        const texture = await Assets.load<Texture>(atlasUrl);
        texture.source.scaleMode = "nearest";
        this.terrainAtlases.set(atlasUrl, texture);
      }),
    );

    this.prewarmTerrainTileTextures();
  }

  private prewarmTerrainTileTextures(): void {
    for (const textureKey of terrainTextureDefinitionByKey.keys()) {
      this.getTerrainTileTexture(textureKey);
    }
  }

  private async loadMapNpcAtlases(): Promise<void> {
    const atlasUrls = new Set(Object.values(mapNpcDefinitions).map((definition) => definition.atlasUrl));

    await Promise.all(
      Array.from(atlasUrls).map(async (atlasUrl) => {
        const texture = await Assets.load<Texture>(atlasUrl);
        texture.source.scaleMode = "nearest";
        this.mapNpcAtlases.set(atlasUrl, texture);
      }),
    );

    for (const definition of Object.values(mapNpcDefinitions)) {
      const atlas = this.mapNpcAtlases.get(definition.atlasUrl);

      if (!atlas) {
        continue;
      }

      this.mapNpcTextures.set(definition.id, {
        west: definition.frames.west.map((frameIndex) => this.createAtlasFrame(atlas, frameIndex, definition.frameWidth, definition.frameHeight)),
        east: definition.frames.east.map((frameIndex) => this.createAtlasFrame(atlas, frameIndex, definition.frameWidth, definition.frameHeight)),
      });
    }
  }

  private async loadMapBirdAtlases(): Promise<void> {
    const atlasUrls = new Set(Object.values(mapBirdDefinitions).map((definition) => definition.atlasUrl));

    await Promise.all(
      Array.from(atlasUrls).map(async (atlasUrl) => {
        const texture = await Assets.load<Texture>(atlasUrl);
        texture.source.scaleMode = "nearest";
        this.mapBirdAtlases.set(atlasUrl, texture);
      }),
    );

    for (const definition of Object.values(mapBirdDefinitions)) {
      const atlas = this.mapBirdAtlases.get(definition.atlasUrl);

      if (!atlas) {
        continue;
      }

      this.mapBirdTextures.set(definition.id, {
        west: definition.frames.west.map((frameIndex) => this.createAtlasFrame(atlas, frameIndex, definition.frameWidth, definition.frameHeight)),
        east: definition.frames.east.map((frameIndex) => this.createAtlasFrame(atlas, frameIndex, definition.frameWidth, definition.frameHeight)),
      });
    }
  }

  private async loadBattleTileAtlas(): Promise<void> {
    const atlas = await Assets.load<Texture>(settlementBattleMap.tileset.atlasUrl);
    atlas.source.scaleMode = "nearest";
    this.battleTileAtlas = atlas;

    for (const [tileId, definition] of Object.entries(settlementBattleMap.tileset.tiles) as Array<[SettlementBattleTileId, typeof settlementBattleMap.tileset.tiles[SettlementBattleTileId]]>) {
      this.battleTileTextures.set(tileId, new Texture({
        source: atlas.source,
        frame: new Rectangle(
          definition.frame.x,
          definition.frame.y,
          definition.frame.width,
          definition.frame.height,
        ),
      }));
    }
  }

  private async loadSettlementPalisadeTexture(): Promise<void> {
    await Promise.all(
      ([
        ["wood", settlementPalisadeTextureUrl],
        ["stone", settlementPalisadeStoneTextureUrl],
        ["scrap", settlementPalisadeScrapTextureUrl],
      ] as Array<[VillageResourceSitePalisadeType, string]>).map(async ([type, textureUrl]) => {
        const texture = await Assets.load<Texture>(textureUrl);
        texture.source.scaleMode = "nearest";
        this.settlementPalisadeTextures.set(type, texture);
      }),
    );
  }

  private createAtlasFrame(
    atlas: Texture,
    frameIndex: number,
    frameWidth: number,
    frameHeight: number,
  ): Texture {
    return new Texture({
      source: atlas.source,
      frame: new Rectangle(
        (frameIndex % Math.max(1, Math.floor(atlas.width / frameWidth))) * frameWidth,
        Math.floor(frameIndex / Math.max(1, Math.floor(atlas.width / frameWidth))) * frameHeight,
        frameWidth,
        frameHeight,
      ),
    });
  }

  private getTerrainTextureDefinition(textureKey: string) {
    return terrainTextureDefinitionByKey.get(textureKey) ?? null;
  }

  private getBuildingVisual(buildingId: BuildingId): BuildingVisualDefinition | null {
    const visual = buildingVisualDefinitions[buildingId];
    return visual?.kind === "texture" ? visual : null;
  }
}
