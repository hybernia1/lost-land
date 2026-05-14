import smallBirdAtlasUrl from "../assets/npcs/small-bird-atlas.png";
import whiteBirdAtlasUrl from "../assets/npcs/white-bird-atlas.png";

export type MapBirdKindId = "smallBird" | "whiteBird";

export type MapBirdDefinition = {
  id: MapBirdKindId;
  atlasUrl: string;
  frameWidth: number;
  frameHeight: number;
  frames: {
    west: number[];
    east: number[];
  };
  renderWidth: number;
  renderHeight: number;
  speedPixelsPerSecond: {
    min: number;
    max: number;
  };
  altitudePixels: {
    min: number;
    max: number;
  };
  spawnDelaySeconds: {
    min: number;
    max: number;
  };
  flockSize: {
    min: number;
    max: number;
  };
  maxActive: number;
  animationFrameSeconds: number;
};

export const mapBirdDefinitions: Record<MapBirdKindId, MapBirdDefinition> = {
  smallBird: {
    id: "smallBird",
    atlasUrl: smallBirdAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 25,
    renderHeight: 16,
    speedPixelsPerSecond: {
      min: 78,
      max: 122,
    },
    altitudePixels: {
      min: 72,
      max: 150,
    },
    spawnDelaySeconds: {
      min: 1.8,
      max: 4.8,
    },
    flockSize: {
      min: 2,
      max: 5,
    },
    maxActive: 12,
    animationFrameSeconds: 0.14,
  },
  whiteBird: {
    id: "whiteBird",
    atlasUrl: whiteBirdAtlasUrl,
    frameWidth: 32,
    frameHeight: 32,
    frames: {
      west: [0, 1, 2, 3],
      east: [4, 5, 6, 7],
    },
    renderWidth: 27,
    renderHeight: 17,
    speedPixelsPerSecond: {
      min: 74,
      max: 118,
    },
    altitudePixels: {
      min: 82,
      max: 164,
    },
    spawnDelaySeconds: {
      min: 1.8,
      max: 4.8,
    },
    flockSize: {
      min: 2,
      max: 4,
    },
    maxActive: 12,
    animationFrameSeconds: 0.14,
  },
};

export const mapBirdKindIds = Object.keys(mapBirdDefinitions) as MapBirdKindId[];
