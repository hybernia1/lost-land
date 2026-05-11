import type {
  Container,
  FrameObject,
  Graphics,
  Sprite,
  Text,
  TextStyleFontWeight,
} from "pixi.js";
import type {
  BuildingCategory,
  BuildingId,
  DecisionHistoryEntry,
  DecisionOptionId,
  EnvironmentConditionId,
  GameSpeed,
  GameState,
  MarketResourceId,
  ResourceBag,
  ResourceId,
} from "../../../game/types";

export type SceneLayout = {
  originX: number;
  originY: number;
  width: number;
  height: number;
  scale: number;
};

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HudTextOptions = {
  fill: number;
  fontSize: number;
  fontWeight?: TextStyleFontWeight;
  alpha?: number;
  align?: "left" | "center" | "right";
  wordWrap?: boolean;
  wordWrapWidth?: number;
  lineHeight?: number;
};

export type DrawTextFn = (
  parent: Container,
  text: string,
  x: number,
  y: number,
  options: HudTextOptions,
) => Text;

export type DrawCenteredTextFn = DrawTextFn;

export type DrawPanelFn = (
  parent: Container,
  x: number,
  y: number,
  width: number,
  height: number,
  fillAlpha?: number,
  cornerRadius?: number,
) => Graphics;

export type DrawIconFn = (
  parent: Container,
  iconId: string,
  x: number,
  y: number,
  size: number,
) => Container;

export type OverlayHeaderOptions = {
  iconId: string;
  title: string;
  closeAction?: PixiActionDetail;
  kicker?: string;
  subtitle?: string;
  rightText?: string;
};

export type DrawOverlayHeaderFn = (
  parent: Container,
  panelWidth: number,
  translations: import("../../../i18n/types").TranslationPack,
  options: OverlayHeaderOptions,
) => number;

export type MeasureWrappedTextHeightFn = (
  text: string,
  fontSize: number,
  fontWeight: TextStyleFontWeight,
  maxWidth: number,
) => number;

export type TextureAnimationFrame = {
  texture: FrameObject["texture"];
  durationMs: number;
};

export type TextureAnimationBinding = {
  sprite: Sprite;
  frames: TextureAnimationFrame[];
  totalDurationMs: number;
  currentFrameIndex: number;
  phaseOffsetMs: number;
};

export type PixiActionDetail = {
  action?: string;
  building?: BuildingId;
  plot?: string;
  resourceSiteId?: string;
  resourceSiteTroops?: number;
  delta?: number;
  troopCount?: number;
  questOption?: DecisionOptionId;
  resourceId?: ResourceId;
  marketFromResource?: ResourceId;
  marketToResource?: ResourceId;
  marketAmount?: number;
  speed?: GameSpeed;
  continuousShifts?: boolean;
};

export type ConquestResultPreview = {
  outcome: "victory" | "failed" | "overrun";
  resourceId: "food" | "water" | "material" | "coal";
  sentTroops: number;
  returnedTroops: number;
  deaths: number;
  requiredTroops?: number;
  resolvedAt: number;
};

export type GameOverPreview = {
  communityName: string;
  endedAt: number;
};

export type VillageInfoPanel = ResourceId | "survivors" | "decisionArchive" | "weather";

export type EffectLine = {
  iconId: string;
  value: string;
  tooltip: string;
  negative?: boolean;
};

export type BrandAlertTone = "cold" | "danger" | "warning" | "neutral";

export type BrandAlert = {
  iconId: string;
  label?: string;
  tooltip?: string;
  action?: PixiActionDetail;
  tone: BrandAlertTone;
};

export type ActiveEnvironmentConditionId = Exclude<EnvironmentConditionId, "stable">;

export type DecisionHistoryRow = {
  entry: DecisionHistoryEntry;
  originalIndex: number;
};

export type CostLinePart = {
  text: string;
  iconId: string;
  missing: boolean;
  tooltip: string;
};

export type BuildingMetric = {
  iconId: string;
  label: string;
  value: string;
  fill?: number;
  tooltip?: string;
};

export type FormattedLogEntry = {
  text: string;
  fill: number;
  iconId: string;
};

export type ResourceBreakdownTab = "production" | "consumption";
export type RectButtonTone = "primary" | "secondary" | "toolbar";

export type RectButtonOptions = {
  label?: string;
  iconId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  detail?: PixiActionDetail;
  onTap?: () => void;
  tooltip?: string;
  disabled?: boolean;
  active?: boolean;
  tone?: RectButtonTone;
  fontSize?: number;
  fontWeight?: TextStyleFontWeight;
};

export type CircleButtonOptions = {
  iconId: string;
  x: number;
  y: number;
  radius: number;
  detail: PixiActionDetail;
  tooltip: string;
  active?: boolean;
};

export type TabItem<T extends string> = {
  id: T;
  label: string;
};

export type TabOptions<T extends string> = {
  activeId: T;
  x: number;
  y: number;
  height: number;
  gap?: number;
  minWidth: number;
  maxWidth?: number;
  maxTabWidth?: number;
  onSelect: (id: T) => void;
};

export type BuildingEffectsContext = {
  resources: GameState["resources"];
  community: {
    workersLabel: string;
    populationLabel: string;
    treatmentLabel: string;
    housingCapacityLabel: string;
    defenseLabel: string;
    productionLabel: string;
    unlocksTroopTrainingLabel: string;
    marketTradeLimitLabel: string;
    marketTradesLabel: string;
  };
  resourceNames: Record<ResourceId, string>;
  resourceDescriptions: Record<ResourceId, string>;
};

export type BuildingEffectsArgs = {
  buildingId: BuildingId;
  level: number;
  maxLevel: number;
};
