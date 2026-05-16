import deerFleaAtlasUrl from "../assets/npcs/deer-flea-atlas.png";
import archerFleaAtlasUrl from "../assets/npcs/archer-flea-atlas.png";
import banditFleaAtlasUrl from "../assets/npcs/bandit-flea-atlas.png";
import berserkerZombieFleaAtlasUrl from "../assets/npcs/berserker-zombie-flea-atlas.png";
import bulwarkFleaAtlasUrl from "../assets/npcs/bulwark-flea-atlas.png";
import footmanFleaAtlasUrl from "../assets/npcs/footman-flea-atlas.png";
import peonFleaAtlasUrl from "../assets/npcs/peon-flea-atlas.png";
import ratFleaAtlasUrl from "../assets/npcs/rat-flea-atlas.png";
import soldierFleaAtlasUrl from "../assets/npcs/soldier-flea-atlas.png";
import snakeFleaAtlasUrl from "../assets/npcs/snake-flea-atlas.png";
import spiderFleaAtlasUrl from "../assets/npcs/spider-flea-atlas.png";
import wolfFleaAtlasUrl from "../assets/npcs/wolf-flea-atlas.png";
import zombieFleaAtlasUrl from "../assets/npcs/zombie-flea-atlas.png";

export type MapNpcKindId =
  | "archerFlea"
  | "banditFlea"
  | "berserkerZombieFlea"
  | "bulwarkFlea"
  | "deerFlea"
  | "footmanFlea"
  | "peonFlea"
  | "ratFlea"
  | "soldierFlea"
  | "snakeFlea"
  | "spiderFlea"
  | "wolfFlea"
  | "zombieFlea";

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
  footmanFlea: {
    id: "footmanFlea",
    atlasUrl: footmanFleaAtlasUrl,
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
  archerFlea: {
    id: "archerFlea",
    atlasUrl: archerFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 24,
    renderHeight: 29,
    speedPixelsPerSecond: 14,
    idleChance: 0.44,
    idleSeconds: {
      min: 1.0,
      max: 3.4,
    },
    animationFrameSeconds: 0.14,
  },
  bulwarkFlea: {
    id: "bulwarkFlea",
    atlasUrl: bulwarkFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 27,
    renderHeight: 31,
    speedPixelsPerSecond: 11,
    idleChance: 0.48,
    idleSeconds: {
      min: 1.1,
      max: 3.6,
    },
    animationFrameSeconds: 0.16,
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
  ratFlea: {
    id: "ratFlea",
    atlasUrl: ratFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 24,
    renderHeight: 22,
    speedPixelsPerSecond: 22,
    idleChance: 0.28,
    idleSeconds: {
      min: 0.5,
      max: 1.8,
    },
    animationFrameSeconds: 0.12,
  },
  spiderFlea: {
    id: "spiderFlea",
    atlasUrl: spiderFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 28,
    renderHeight: 24,
    speedPixelsPerSecond: 17,
    idleChance: 0.36,
    idleSeconds: {
      min: 0.7,
      max: 2.2,
    },
    animationFrameSeconds: 0.14,
  },
  snakeFlea: {
    id: "snakeFlea",
    atlasUrl: snakeFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 27,
    renderHeight: 18,
    speedPixelsPerSecond: 24,
    idleChance: 0.24,
    idleSeconds: {
      min: 0.4,
      max: 1.5,
    },
    animationFrameSeconds: 0.12,
  },
  wolfFlea: {
    id: "wolfFlea",
    atlasUrl: wolfFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 29,
    renderHeight: 23,
    speedPixelsPerSecond: 23,
    idleChance: 0.3,
    idleSeconds: {
      min: 0.5,
      max: 1.8,
    },
    animationFrameSeconds: 0.12,
  },
  zombieFlea: {
    id: "zombieFlea",
    atlasUrl: zombieFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 25,
    renderHeight: 31,
    speedPixelsPerSecond: 10,
    idleChance: 0.46,
    idleSeconds: {
      min: 1.0,
      max: 3.4,
    },
    animationFrameSeconds: 0.17,
  },
  banditFlea: {
    id: "banditFlea",
    atlasUrl: banditFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 25,
    renderHeight: 30,
    speedPixelsPerSecond: 15,
    idleChance: 0.4,
    idleSeconds: {
      min: 0.9,
      max: 2.8,
    },
    animationFrameSeconds: 0.14,
  },
  berserkerZombieFlea: {
    id: "berserkerZombieFlea",
    atlasUrl: berserkerZombieFleaAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 31,
    renderHeight: 34,
    speedPixelsPerSecond: 12,
    idleChance: 0.42,
    idleSeconds: {
      min: 1.0,
      max: 3.2,
    },
    animationFrameSeconds: 0.16,
  },
};

export function isMapNpcKindId(value: string): value is MapNpcKindId {
  return Object.prototype.hasOwnProperty.call(mapNpcDefinitions, value);
}
