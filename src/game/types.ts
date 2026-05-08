export type ResourceId =
  | "food"
  | "water"
  | "material"
  | "energy"
  | "morale";

export type BuildingId =
  | "mainBuilding"
  | "storage"
  | "dormitory"
  | "hydroponics"
  | "waterStill"
  | "workshop"
  | "generator"
  | "watchtower"
  | "barracks"
  | "clinic"
  | "palisade";

export type TileKind =
  | "base"
  | "ruins"
  | "forest"
  | "highway"
  | "hospital"
  | "warehouse"
  | "infested";

export type ResourceBag = Partial<Record<ResourceId, number>>;

export type BuildingLevelRequirement = {
  level: number;
  cost: ResourceBag;
  buildSeconds: number;
  constructionWorkers: number;
};

export type BuildingDefinition = {
  id: BuildingId;
  name: string;
  description: string;
  maxLevel: number;
  buildSeconds: number;
  baseConstructionWorkers: number;
  baseCost: ResourceBag;
  levelRequirements: BuildingLevelRequirement[];
  produces?: ResourceBag;
  consumes?: ResourceBag;
  alwaysConsumes?: ResourceBag;
  storageBonus?: ResourceBag;
  housing?: number;
  defense?: number;
};

export type BuildingState = {
  id: BuildingId;
  level: number;
  upgradingRemaining: number;
  workers: number;
  constructionWorkers: number;
};

export type VillagePlotState = {
  id: string;
  buildingId: BuildingId | null;
};

export type ResourceDefinition = {
  id: ResourceId;
  name: string;
  softCap?: number;
};

export type SurvivorRoles = {
  workers: number;
  troops: number;
};

export type HealthState = {
  injured: number;
  treatmentProgress: number;
  nextIncidentAt: number;
  starvationProgress: number;
  dehydrationProgress: number;
};

export type MapSector = {
  id: string;
  x: number;
  y: number;
  kind: TileKind;
  revealed: boolean;
  scouted: boolean;
  threat: number;
  loot: ResourceBag;
};

export type GameSpeed = 1 | 24;

export type WorkMode = "day" | "continuous";

export type GameState = {
  saveVersion: number;
  saveId: string;
  communityName: string;
  startedAt: string;
  elapsedSeconds: number;
  paused: boolean;
  speed: GameSpeed;
  workMode: WorkMode;
  resources: Record<ResourceId, number>;
  capacities: Record<ResourceId, number>;
  survivors: SurvivorRoles;
  health: HealthState;
  buildings: Record<BuildingId, BuildingState>;
  village: {
    selectedPlotId: string;
    plots: VillagePlotState[];
  };
  map: {
    width: number;
    height: number;
    sectors: MapSector[];
  };
  log: string[];
};

export type GameListener = (state: GameState) => void;
