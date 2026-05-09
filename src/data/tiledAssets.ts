const tiledTilesetSources = import.meta.glob("../maps/tilesets/*.tsj", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const tileAssetUrls = import.meta.glob([
  "../assets/tiles/*.{png,jpg,jpeg}",
  "!../assets/tiles/*-source.png",
], {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const buildingAssetUrls = import.meta.glob("../assets/buildings/*.{png,jpg,jpeg}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

export function getTiledTilesetSource(source: string): string {
  const filename = getFilename(source);
  const match = Object.entries(tiledTilesetSources).find(([path]) => getFilename(path) === filename);

  if (!match) {
    throw new Error(`Missing Tiled tileset source "${source}".`);
  }

  return match[1];
}

export function getTileAssetUrl(imagePath: string): string {
  const filename = getFilename(imagePath);
  const match = Object.entries(tileAssetUrls).find(([path]) => getFilename(path) === filename);

  if (!match) {
    throw new Error(`Missing tile atlas asset "${imagePath}".`);
  }

  return match[1];
}

export function getBuildingAssetUrl(imagePath: string): string {
  const filename = getFilename(imagePath);
  const match = Object.entries(buildingAssetUrls).find(([path]) => getFilename(path) === filename);

  if (!match) {
    throw new Error(`Missing building atlas asset "${imagePath}".`);
  }

  return match[1];
}

function getFilename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}
