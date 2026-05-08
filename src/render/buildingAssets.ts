import type { BuildingId } from "../game/types";

type BuildingAssetOptions = {
  id: BuildingId;
  width: number;
  height: number;
  level: number;
  built: boolean;
  scale: number;
};

type Palette = {
  base: string;
  roof: string;
  detail: string;
  light: string;
};

const assetUrlCache = new Map<string, string>();

const palettes: Record<Exclude<BuildingId, "palisade">, Palette> = {
  mainBuilding: {
    base: "#575145",
    roof: "#7a705a",
    detail: "#2a211a",
    light: "#d6a85b",
  },
  storage: {
    base: "#6d614d",
    roof: "#8a744e",
    detail: "#2b261f",
    light: "#d9b46c",
  },
  dormitory: {
    base: "#59615b",
    roof: "#7b6f55",
    detail: "#252820",
    light: "#f0d07a",
  },
  hydroponics: {
    base: "#456351",
    roof: "#6c8a68",
    detail: "#23362d",
    light: "#9edc8d",
  },
  waterStill: {
    base: "#4d6670",
    roof: "#6f8790",
    detail: "#213039",
    light: "#9bd2e5",
  },
  workshop: {
    base: "#645849",
    roof: "#80694c",
    detail: "#29231d",
    light: "#d7a75f",
  },
  scrapyard: {
    base: "#5e6158",
    roof: "#83765d",
    detail: "#272b28",
    light: "#d6b36b",
  },
  generator: {
    base: "#675f45",
    roof: "#8e7a45",
    detail: "#242219",
    light: "#f0d371",
  },
  watchtower: {
    base: "#6d5641",
    roof: "#8c6747",
    detail: "#2d2219",
    light: "#efbd68",
  },
  barracks: {
    base: "#615442",
    roof: "#8b6845",
    detail: "#2e241b",
    light: "#d8a85b",
  },
  clinic: {
    base: "#61767c",
    roof: "#8aa0a3",
    detail: "#26363a",
    light: "#eadfc8",
  },
};

export function drawBuildingAsset(
  context: CanvasRenderingContext2D,
  options: BuildingAssetOptions,
): void {
  if (options.id === "palisade") {
    context.save();
    context.globalAlpha = options.built ? 1 : 0.62;
    drawPalisadeAsset(context, options);
    drawLevelAccents(context, options);
    context.restore();
    return;
  }

  const palette = options.built ? palettes[options.id] : makeGhostPalette(palettes[options.id]);

  context.save();
  context.globalAlpha = options.built ? 1 : 0.62;

  if (options.id === "mainBuilding") {
    drawMainBuilding(context, options, palette);
  } else if (options.id === "storage") {
    drawStorage(context, options, palette);
  } else if (options.id === "dormitory") {
    drawDormitory(context, options, palette);
  } else if (options.id === "hydroponics") {
    drawHydroponics(context, options, palette);
  } else if (options.id === "waterStill") {
    drawWaterStill(context, options, palette);
  } else if (options.id === "workshop") {
    drawWorkshop(context, options, palette);
  } else if (options.id === "scrapyard") {
    drawScrapyard(context, options, palette);
  } else if (options.id === "generator") {
    drawGenerator(context, options, palette);
  } else if (options.id === "watchtower") {
    drawWatchtower(context, options, palette);
  } else if (options.id === "barracks") {
    drawBarracks(context, options, palette);
  } else if (options.id === "clinic") {
    drawClinic(context, options, palette);
  }

  drawLevelAccents(context, options);
  context.restore();
}

export function getBuildingAssetDataUrl(
  id: BuildingId,
  level = 1,
  built = true,
): string {
  const cacheKey = `${id}:${level}:${built ? "built" : "ghost"}`;
  const cached = assetUrlCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 96;

  const context = canvas.getContext("2d");

  if (!context) {
    return "";
  }

  context.translate(canvas.width / 2, canvas.height * 0.52);
  drawBuildingAsset(context, {
    id,
    width: 104,
    height: 74,
    level,
    built,
    scale: 1,
  });

  const dataUrl = canvas.toDataURL("image/png");
  assetUrlCache.set(cacheKey, dataUrl);
  return dataUrl;
}

function drawMainBuilding(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  const radius = Math.min(width, height) * 0.43;

  context.fillStyle = palette.detail;
  context.beginPath();
  context.ellipse(0, height * 0.12, radius * 1.14, radius * 0.58, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = palette.base;
  drawPolygon(context, 10, radius, radius * 0.78, -Math.PI / 2);
  context.fill();

  context.strokeStyle = "rgba(246, 229, 141, 0.32)";
  context.lineWidth = 2 * scale;
  context.stroke();

  context.fillStyle = palette.roof;
  context.beginPath();
  context.ellipse(0, -height * 0.02, radius * 0.62, radius * 0.4, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = palette.detail;
  roundRect(context, -width * 0.13, height * 0.11, width * 0.26, height * 0.27, 4 * scale);
  context.fill();

  context.fillStyle = palette.light;
  context.fillRect(-width * 0.035, height * 0.2, width * 0.07, height * 0.17);
}

function drawStorage(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  drawBlock(context, width, height, scale, palette);
  drawRoof(context, width, height, palette.roof);
  drawPlanks(context, width, height, scale, 4);
  drawDoor(context, width, height, scale, palette.detail);
}

function drawDormitory(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  drawBlock(context, width, height, scale, palette, 1.08);
  drawRoof(context, width, height, palette.roof);
  drawDoor(context, width, height, scale, palette.detail);

  context.fillStyle = "rgba(240, 208, 122, 0.72)";
  for (let index = 0; index < 3; index += 1) {
    roundRect(
      context,
      -width * 0.32 + index * width * 0.23,
      -height * 0.11,
      width * 0.11,
      height * 0.13,
      2 * scale,
    );
    context.fill();
  }

  context.strokeStyle = "rgba(23, 26, 21, 0.34)";
  context.lineWidth = 1.5 * scale;
  context.beginPath();
  context.moveTo(-width * 0.42, height * 0.28);
  context.lineTo(width * 0.42, height * 0.28);
  context.stroke();
}

function drawHydroponics(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  drawBlock(context, width, height, scale, palette, 0.9);
  context.fillStyle = "rgba(166, 222, 155, 0.36)";
  roundRect(context, -width * 0.36, -height * 0.3, width * 0.72, height * 0.34, 5 * scale);
  context.fill();
  context.strokeStyle = "rgba(231, 247, 211, 0.28)";
  context.lineWidth = 1 * scale;
  for (let index = -1; index <= 1; index += 1) {
    context.beginPath();
    context.moveTo(index * width * 0.18, -height * 0.28);
    context.lineTo(index * width * 0.18, height * 0.02);
    context.stroke();
  }
  drawSmallLight(context, width * 0.23, height * 0.18, palette.light, scale);
}

function drawWaterStill(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  drawBlock(context, width, height, scale, palette);
  drawRoof(context, width, height, palette.roof);
  context.fillStyle = palette.detail;
  context.fillRect(width * 0.16, -height * 0.52, width * 0.11, height * 0.34);
  context.fillStyle = "rgba(158, 210, 229, 0.7)";
  context.beginPath();
  context.arc(-width * 0.18, height * 0.04, width * 0.16, 0, Math.PI * 2);
  context.fill();
  drawSmallLight(context, width * 0.21, height * 0.13, palette.light, scale);
}

function drawWorkshop(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  drawBlock(context, width, height, scale, palette);
  drawRoof(context, width, height, palette.roof);
  drawDoor(context, width, height, scale, palette.detail);
  context.strokeStyle = "rgba(230, 196, 124, 0.46)";
  context.lineWidth = 2 * scale;
  context.beginPath();
  context.moveTo(width * 0.16, height * 0.13);
  context.lineTo(width * 0.32, -height * 0.09);
  context.moveTo(width * 0.32, height * 0.13);
  context.lineTo(width * 0.16, -height * 0.09);
  context.stroke();
}

function drawScrapyard(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  drawBlock(context, width, height, scale, palette, 0.9);
  context.fillStyle = palette.roof;
  roundRect(context, -width * 0.4, -height * 0.28, width * 0.8, height * 0.16, 4 * scale);
  context.fill();

  context.fillStyle = "rgba(39, 43, 40, 0.82)";
  roundRect(context, -width * 0.38, height * 0.06, width * 0.76, height * 0.22, 3 * scale);
  context.fill();

  context.fillStyle = "rgba(199, 201, 189, 0.82)";
  for (let index = 0; index < 4; index += 1) {
    const scrapWidth = width * (0.11 + index * 0.01);
    const scrapHeight = height * (0.1 + (index % 2) * 0.04);
    roundRect(
      context,
      -width * 0.32 + index * width * 0.18,
      height * (0.12 - index * 0.035),
      scrapWidth,
      scrapHeight,
      2 * scale,
    );
    context.fill();
  }

  context.strokeStyle = "rgba(214, 179, 107, 0.52)";
  context.lineWidth = 2 * scale;
  context.beginPath();
  context.moveTo(-width * 0.28, -height * 0.04);
  context.lineTo(width * 0.28, -height * 0.04);
  context.moveTo(-width * 0.18, -height * 0.18);
  context.lineTo(width * 0.12, height * 0.2);
  context.stroke();
  drawSmallLight(context, width * 0.25, height * 0.02, palette.light, scale);
}

function drawGenerator(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  drawBlock(context, width, height, scale, palette, 0.82);
  context.fillStyle = palette.roof;
  roundRect(context, -width * 0.38, -height * 0.32, width * 0.76, height * 0.18, 4 * scale);
  context.fill();
  context.strokeStyle = "rgba(241, 211, 113, 0.55)";
  context.lineWidth = 2 * scale;
  context.beginPath();
  context.moveTo(-width * 0.08, -height * 0.02);
  context.lineTo(width * 0.04, -height * 0.02);
  context.lineTo(-width * 0.04, height * 0.2);
  context.lineTo(width * 0.1, height * 0.2);
  context.stroke();
  drawSmallLight(context, width * 0.25, height * 0.08, palette.light, scale);
}

function drawWatchtower(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  context.fillStyle = palette.detail;
  context.fillRect(-width * 0.23, -height * 0.2, width * 0.09, height * 0.66);
  context.fillRect(width * 0.14, -height * 0.2, width * 0.09, height * 0.66);
  drawBlock(context, width * 0.82, height * 0.72, scale, palette, 0.8, -height * 0.22);
  drawRoof(context, width * 0.86, height * 0.8, palette.roof, -height * 0.22);
  context.fillStyle = palette.light;
  context.beginPath();
  context.arc(0, -height * 0.14, 4 * scale, 0, Math.PI * 2);
  context.fill();
}

function drawBarracks(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  drawBlock(context, width, height, scale, palette, 1.08);
  drawRoof(context, width, height, palette.roof);
  drawDoor(context, width, height, scale, palette.detail);

  context.strokeStyle = "rgba(231, 190, 112, 0.48)";
  context.lineWidth = 2 * scale;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(width * 0.16, height * 0.16);
  context.lineTo(width * 0.32, -height * 0.14);
  context.moveTo(width * 0.32, height * 0.16);
  context.lineTo(width * 0.16, -height * 0.14);
  context.stroke();

  context.fillStyle = palette.detail;
  roundRect(context, -width * 0.34, -height * 0.12, width * 0.16, height * 0.2, 2 * scale);
  context.fill();
  drawSmallLight(context, -width * 0.25, height * 0.13, palette.light, scale);
}

function drawClinic(
  context: CanvasRenderingContext2D,
  { width, height, scale }: BuildingAssetOptions,
  palette: Palette,
): void {
  drawBlock(context, width, height, scale, palette);
  drawRoof(context, width, height, palette.roof);
  context.fillStyle = palette.light;
  context.fillRect(-width * 0.06, -height * 0.14, width * 0.12, height * 0.38);
  context.fillRect(-width * 0.18, -height * 0.02, width * 0.36, height * 0.13);
  drawSmallLight(context, width * 0.25, height * 0.17, palette.light, scale);
}

function drawPalisadeAsset(
  context: CanvasRenderingContext2D,
  { width, height, built, scale }: BuildingAssetOptions,
): void {
  context.strokeStyle = built ? "#8a6540" : "#56615a";
  context.lineWidth = 5 * scale;
  context.beginPath();
  context.moveTo(-width * 0.38, height * 0.2);
  context.quadraticCurveTo(0, -height * 0.26, width * 0.38, height * 0.2);
  context.stroke();

  context.fillStyle = built ? "#5c3d2c" : "#39413d";

  for (let index = 0; index < 7; index += 1) {
    const x = -width * 0.34 + index * width * 0.113;
    const postHeight = height * (index % 2 === 0 ? 0.58 : 0.48);
    context.fillRect(x, -postHeight * 0.36, 6 * scale, postHeight);
  }

  context.fillStyle = built ? "#c19152" : "#8e978e";
  context.beginPath();
  context.arc(0, height * 0.18, 4 * scale, 0, Math.PI * 2);
  context.fill();
}

function drawBlock(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  palette: Palette,
  widthFactor = 1,
  yOffset = 0,
): void {
  const blockWidth = width * 0.74 * widthFactor;
  const blockHeight = height * 0.55;

  context.fillStyle = palette.base;
  roundRect(
    context,
    -blockWidth / 2,
    -blockHeight / 2 + yOffset,
    blockWidth,
    blockHeight,
    5 * scale,
  );
  context.fill();

  context.strokeStyle = "rgba(255, 255, 255, 0.12)";
  context.lineWidth = 1 * scale;
  context.stroke();
}

function drawRoof(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
  yOffset = 0,
): void {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(-width * 0.44, -height * 0.28 + yOffset);
  context.lineTo(0, -height * 0.56 + yOffset);
  context.lineTo(width * 0.44, -height * 0.28 + yOffset);
  context.closePath();
  context.fill();
}

function drawDoor(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  color: string,
): void {
  context.fillStyle = color;
  roundRect(context, -width * 0.09, height * 0.05, width * 0.18, height * 0.24, 3 * scale);
  context.fill();
}

function drawPlanks(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  count: number,
): void {
  context.strokeStyle = "rgba(34, 29, 24, 0.42)";
  context.lineWidth = 1 * scale;

  for (let index = 1; index < count; index += 1) {
    const x = -width * 0.3 + (width * 0.6 * index) / count;
    context.beginPath();
    context.moveTo(x, -height * 0.18);
    context.lineTo(x, height * 0.26);
    context.stroke();
  }
}

function drawSmallLight(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  scale: number,
): void {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 3.5 * scale, 0, Math.PI * 2);
  context.fill();
}

function drawLevelAccents(
  context: CanvasRenderingContext2D,
  { width, height, level, built, scale }: BuildingAssetOptions,
): void {
  if (!built || level <= 1) {
    return;
  }

  const count = Math.min(4, Math.floor(level / 2));
  context.fillStyle = "rgba(238, 210, 132, 0.72)";

  for (let index = 0; index < count; index += 1) {
    context.fillRect(
      -width * 0.34 + index * width * 0.08,
      -height * 0.42,
      3 * scale,
      9 * scale,
    );
  }
}

function drawPolygon(
  context: CanvasRenderingContext2D,
  points: number,
  radiusX: number,
  radiusY: number,
  startAngle: number,
): void {
  context.beginPath();

  for (let index = 0; index < points; index += 1) {
    const angle = startAngle + (Math.PI * 2 * index) / points;
    const radiusScale = index % 2 === 0 ? 1 : 0.82;
    const x = Math.cos(angle) * radiusX * radiusScale;
    const y = Math.sin(angle) * radiusY * radiusScale;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height,
  );
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function makeGhostPalette(palette: Palette): Palette {
  void palette;
  return {
    base: "#39413d",
    roof: "#56615a",
    detail: "#202824",
    light: "#8e978e",
  };
}
