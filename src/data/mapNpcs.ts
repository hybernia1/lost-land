import deerFleaAtlasUrl from "../assets/npcs/deer-flea-atlas.png";
import enemyFleaAtlasUrl from "../assets/npcs/enemy-flea-atlas.png";
import peonFleaAtlasUrl from "../assets/npcs/peon-flea-atlas.png";
import soldierFleaAtlasUrl from "../assets/npcs/soldier-flea-atlas.png";

export type MapNpcKindId = "deerFlea" | "peonFlea" | "soldierFlea" | "enemyFlea";

export type MapNpcDefinition = {
  id: MapNpcKindId;
  atlasUrl: string;
  frameWidth: number;
  frameHeight: number;
  frames: {
    west: number[];
    east: number[];
  };
  renderWidth: number;
  renderHeight: number;
  speedPixelsPerSecond: number;
  idleChance: number;
  idleSeconds: {
    min: number;
    max: number;
  };
  animationFrameSeconds: number;
};

export const mapNpcDefinitions: Record<MapNpcKindId, MapNpcDefinition> = {
  deerFlea: {
    id: "deerFlea",
    atlasUrl: deerFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 24,
    renderHeight: 24,
    speedPixelsPerSecond: 18,
    idleChance: 0.26,
    idleSeconds: {
      min: 0.7,
      max: 2.2,
    },
    animationFrameSeconds: 0.24,
  },
  peonFlea: {
    id: "peonFlea",
    atlasUrl: peonFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 22,
    renderHeight: 27,
    speedPixelsPerSecond: 13,
    idleChance: 0.34,
    idleSeconds: {
      min: 0.8,
      max: 2.8,
    },
    animationFrameSeconds: 0.14,
  },
  soldierFlea: {
    id: "soldierFlea",
    atlasUrl: soldierFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 24,
    renderHeight: 29,
    speedPixelsPerSecond: 15,
    idleChance: 0.42,
    idleSeconds: {
      min: 1.0,
      max: 3.2,
    },
    animationFrameSeconds: 0.13,
  },
  enemyFlea: {
    id: "enemyFlea",
    atlasUrl: enemyFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 24,
    renderHeight: 29,
    speedPixelsPerSecond: 16,
    idleChance: 0.34,
    idleSeconds: {
      min: 0.7,
      max: 2.4,
    },
    animationFrameSeconds: 0.13,
  },
};

export function isMapNpcKindId(value: string): value is MapNpcKindId {
  return Object.prototype.hasOwnProperty.call(mapNpcDefinitions, value);
}
