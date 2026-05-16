import { resourceIds } from "../data/resources";
import type { GameState, ResourceBag, ResourceId } from "../game/types";

export function addResources(
  target: Record<ResourceId, number>,
  delta: ResourceBag,
  capacities: Record<ResourceId, number>,
): void {
  for (const resourceId of resourceIds) {
    const value = delta[resourceId] ?? 0;

    if (value === 0) {
      continue;
    }

    const nextValue = target[resourceId] + value;
    target[resourceId] = clampResource(resourceId, nextValue, capacities);
  }
}

export function addRewardResources(state: GameState, delta: ResourceBag): void {
  for (const resourceId of resourceIds) {
    const value = delta[resourceId] ?? 0;

    if (value === 0) {
      continue;
    }

    if (value < 0 || resourceId === "morale") {
      state.resources[resourceId] = clampResource(resourceId, state.resources[resourceId] + value, state.capacities);
      continue;
    }

    const capacity = Math.max(0, state.capacities[resourceId]);
    const freeSpace = Math.max(0, capacity - state.resources[resourceId]);
    const stored = Math.min(value, freeSpace);
    const overflow = value - stored;

    state.resources[resourceId] += stored;
    state.heroInventory[resourceId] += overflow;
  }
}

export function transferHeroInventoryToStorage(
  state: GameState,
  resourceId: ResourceId,
  amount: number,
): number {
  if (resourceId === "morale") {
    return 0;
  }

  const requested = Math.max(0, Math.floor(amount));
  const available = Math.max(0, Math.floor(state.heroInventory[resourceId] ?? 0));
  const freeSpace = Math.max(0, Math.floor(state.capacities[resourceId] - state.resources[resourceId]));
  const moved = Math.min(requested, available, freeSpace);

  if (moved <= 0) {
    return 0;
  }

  state.heroInventory[resourceId] -= moved;
  state.resources[resourceId] += moved;
  return moved;
}

export function canAfford(
  resources: Record<ResourceId, number>,
  cost: ResourceBag,
): boolean {
  return resourceIds.every((resourceId) => {
    const required = cost[resourceId] ?? 0;
    return resources[resourceId] >= required;
  });
}

export function spendResources(
  resources: Record<ResourceId, number>,
  cost: ResourceBag,
): void {
  for (const resourceId of resourceIds) {
    resources[resourceId] -= cost[resourceId] ?? 0;
  }
}

export function scaleResourceBag(bag: ResourceBag, multiplier: number): ResourceBag {
  const scaled: ResourceBag = {};

  for (const resourceId of resourceIds) {
    const value = bag[resourceId];

    if (value !== undefined) {
      scaled[resourceId] = Math.ceil(value * multiplier);
    }
  }

  return scaled;
}

function clampResource(
  resourceId: ResourceId,
  value: number,
  capacities: Record<ResourceId, number>,
): number {
  if (resourceId === "morale") {
    return Math.max(0, Math.min(100, value));
  }

  return Math.max(0, Math.min(capacities[resourceId], value));
}
