import type { TextStyleFontWeight } from "pixi.js";
import type { BuildingCategory, ResourceId } from "../../../game/types";
import type { DecisionProfileKind } from "../../../systems/quests";
import type { ActiveEnvironmentConditionId, BrandAlertTone } from "./types";

export const decisionProfileIconByKind: Record<DecisionProfileKind, string> = {
  noData: "profile-no-data",
  balanced: "profile-balanced",
  communalAuthority: "profile-principled",
  marketAuthority: "profile-security",
  communalAutonomy: "profile-merciful",
  marketAutonomy: "profile-open",
};

export const decisionProfileLabelKeyByKind: Record<DecisionProfileKind, string> = {
  noData: "profileNoData",
  balanced: "profileBalanced",
  communalAuthority: "profileCommunalAuthority",
  marketAuthority: "profileMarketAuthority",
  communalAutonomy: "profileCommunalAutonomy",
  marketAutonomy: "profileMarketAutonomy",
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

export const uiTheme = {
  background: 0x061928,
  backgroundLower: 0x03111d,
  surface: 0x12324c,
  surfaceMuted: 0x0c263b,
  surfaceSunken: 0x061725,
  modalContent: 0x0a2a42,
  modalContentPanel: 0x0f3552,
  modalHeader: 0x082338,
  hudChrome: 0x061b2b,
  sidePanel: 0x061b2b,
  topStrip: 0x061b2b,
  border: 0x2c5f7f,
  borderStrong: 0x80bddf,
  text: 0xf0dfbd,
  textMuted: 0x9ebbd0,
  textSoft: 0x6f93aa,
  accent: 0x6da9cc,
  accentStrong: 0xf0c96f,
  accentSurface: 0x1a587f,
  actionSurface: 0x4a8c32,
  actionSurfaceDark: 0x2f641f,
  actionBorder: 0x93d05f,
  rewardSurface: 0x123d5a,
  row: 0x0b2b43,
  rowActive: 0x164d72,
  barTrack: 0x04111c,
  barMarker: 0x6da9cc,
  barFill: 0xf0c96f,
  positive: 0x8fca78,
  positiveSurface: 0x245f43,
  negative: 0xe9857c,
  negativeSurface: 0x653235,
  warning: 0xe8b75c,
  cold: 0x8bc9e7,
  overlay: 0x020811,
  tooltip: 0x061725,
  shadow: 0x020811,
};

export const VILLAGE_BUILDING_RENDER_SCALE = 2;
export const buildCategoryOrder: BuildingCategory[] = ["resource", "housing", "support"];

export const HUD_DESIGN_SCALE = 1;
export const HUD_CHROME_ALPHA = 1;
export const UI_PANEL_RADIUS = 8;
export const UI_CONTROL_RADIUS = 0;
export const UI_BADGE_RADIUS = 4;
export const HUD_TOP_STRIP_HEIGHT = 82;
export const HUD_LEFT_PANEL_WIDTH = 366;
export const HUD_SIDE_PANEL_MARGIN = 20;
export const HUD_SIDE_PANEL_CONTENT_WIDTH = HUD_LEFT_PANEL_WIDTH - HUD_SIDE_PANEL_MARGIN * 2;
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
export const HUD_FONT_FAMILY = "Georgia, Cambria, \"Times New Roman\", serif";
export const HUD_FONT_WEIGHT_NORMAL: TextStyleFontWeight = "400";
export const HUD_FONT_WEIGHT_BOLD: TextStyleFontWeight = "600";

export const uiTextSize = {
  tiny: 9,
  micro: 10,
  caption: 11,
  small: 12,
  body: 13,
  bodyLarge: 14,
  emphasis: 15,
  control: 16,
  value: 17,
  actionValue: 18,
  sectionTitle: 20,
  screenTitle: 21,
  overlayTitle: 22,
  resultTitle: 24,
  brandTitle: 25,
  modalTitle: 30,
  frontTitle: 48,
} as const;

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
