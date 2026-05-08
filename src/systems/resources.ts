import { resourceIds } from "../data/resources";
import type { ResourceBag, ResourceId } from "../game/types";

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
