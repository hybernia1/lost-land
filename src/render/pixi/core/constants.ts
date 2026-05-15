import type { TextStyleFontWeight } from "pixi.js";
import type { BuildingCategory, ResourceId } from "../../../game/types";
import type { DecisionProfileKind } from "../../../systems/quests";
import type { ActiveEnvironmentConditionId, BrandAlertTone } from "./types";

export const decisionProfileIconByKind: Record<DecisionProfileKind, string> = {
  noData: "profile-no-data",
  balanced: "profile-balanced",
  philanthropist: "profile-philanthropist",
  principled: "profile-principled",
  merciful: "profile-merciful",
  security: "profile-security",
  open: "profile-open",
  cautious: "profile-cautious",
};

export const decisionProfileLabelKeyByKind: Record<DecisionProfileKind, string> = {
  noData: "profileNoData",
  balanced: "profileBalanced",
  philanthropist: "profilePhilanthropist",
  principled: "profilePrincipled",
  merciful: "profileMerciful",
  security: "profileSecurity",
  open: "profileOpen",
  cautious: "profileCautious",
};

export const environmentAlertIconByCondition: Record<ActiveEnvironmentConditionId, string> = {
  rain: "crisis-rain",
  snowFront: "crisis-snow",
};

export const environmentAlertToneByCondition: Record<ActiveEnvironmentConditionId, BrandAlertTone> = {
  rain: "neutral",
  snowFront: "cold",
};

export const resourceColors: Record<ResourceId, number> = {
  food: 0xd8b66a,
  water: 0x66bde8,
  material: 0xc7c9bd,
  coal: 0x8f9589,
  morale: 0xe9a0a0,
};

export const VILLAGE_BUILDING_RENDER_SCALE = 2;
const BUILDING_PREVIEW_BASE_RENDER_SCALE = 1.3;
export const BUILDING_PREVIEW_RENDER_SCALE = Math.max(
  1,
  VILLAGE_BUILDING_RENDER_SCALE / BUILDING_PREVIEW_BASE_RENDER_SCALE,
);
export const buildCategoryOrder: BuildingCategory[] = ["resource", "housing", "defense", "support"];

export const HUD_DESIGN_SCALE = 1.2;
export const HUD_TOP_STRIP_HEIGHT = 68;
export const HUD_SIDE_PANEL_MARGIN = 0;
export const HUD_LEFT_PANEL_WIDTH = 366;
export const CAMERA_MIN_ZOOM = 0.72;
export const CAMERA_MAX_ZOOM = 1.35;
export const CAMERA_ZOOM_STEP = 0.0018;
export const CAMERA_SMOOTH_FACTOR = 0.2;
export const CAMERA_OFFSET_SNAP_EPSILON = 0.2;
export const CAMERA_ZOOM_SNAP_EPSILON = 0.001;
export const MAX_RENDER_RESOLUTION = 1.5;
const MAX_VISUAL_FPS = 30;
export const VISUAL_FRAME_MIN_MS = 1000 / MAX_VISUAL_FPS;
const MAX_TEXTURE_ANIMATION_FPS = 10;
export const TEXTURE_ANIMATION_FRAME_MIN_MS = 1000 / MAX_TEXTURE_ANIMATION_FPS;
const MAX_WEATHER_OVERLAY_FPS = 12;
export const WEATHER_OVERLAY_FRAME_MIN_MS = 1000 / MAX_WEATHER_OVERLAY_FPS;
const MAX_DAYLIGHT_TRANSITION_FPS = 4;
export const DAYLIGHT_TRANSITION_FRAME_MIN_MS = 1000 / MAX_DAYLIGHT_TRANSITION_FPS;
export const DAYLIGHT_DARKNESS_BUCKET_STEP = 0.015;
export const TOOLTIP_POSITION_EPSILON = 0.75;
export const MODAL_BACKDROP_ALPHA = 0.34;
export const RAIN_LAYER_A_MIN_COUNT = 540;
export const RAIN_LAYER_A_MAX_COUNT = 1300;
export const RAIN_LAYER_B_MIN_COUNT = 360;
export const RAIN_LAYER_B_MAX_COUNT = 880;
export const HUD_FONT_FAMILY = "\"Segoe UI\", \"Noto Sans\", Arial, sans-serif";
export const HUD_FONT_WEIGHT_NORMAL: TextStyleFontWeight = "400";
export const HUD_FONT_WEIGHT_BOLD: TextStyleFontWeight = "700";

export function getHudTextLineHeight(fontSize: number): number {
  return Math.max(1, Math.round(fontSize * 1.35));
}

export function normalizeHudFontWeight(fontWeight?: TextStyleFontWeight): TextStyleFontWeight {
  if (typeof fontWeight === "number") {
    return fontWeight >= 550 ? HUD_FONT_WEIGHT_BOLD : HUD_FONT_WEIGHT_NORMAL;
  }

  if (!fontWeight) {
    return HUD_FONT_WEIGHT_BOLD;
  }

  if (fontWeight === "bold" || fontWeight === "bolder") {
    return HUD_FONT_WEIGHT_BOLD;
  }

  if (fontWeight === "normal" || fontWeight === "lighter") {
    return HUD_FONT_WEIGHT_NORMAL;
  }

  const numericWeight = Number.parseInt(fontWeight, 10);
  if (!Number.isNaN(numericWeight)) {
    return numericWeight >= 550 ? HUD_FONT_WEIGHT_BOLD : HUD_FONT_WEIGHT_NORMAL;
  }

  return HUD_FONT_WEIGHT_BOLD;
}

export function upgradingTooltip(
  name: string,
  level: number,
  upgradingRemaining: number,
  levelLabel: string,
): string {
  const status = upgradingRemaining > 0
    ? `${Math.ceil(upgradingRemaining)}s`
    : `${levelLabel} ${level}`;
  return `${name} / ${status}`;
}

export function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
