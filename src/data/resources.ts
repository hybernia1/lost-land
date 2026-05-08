import type { ResourceDefinition, ResourceId } from "../game/types";

export const resourceDefinitions: ResourceDefinition[] = [
  { id: "food", name: "Food" },
  { id: "water", name: "Water" },
  { id: "material", name: "Material" },
  { id: "energy", name: "Energy" },
  { id: "morale", name: "Morale", softCap: 100 },
];

export const resourceIds = resourceDefinitions.map((resource) => resource.id);

export function emptyResourceRecord(value = 0): Record<ResourceId, number> {
  return Object.fromEntries(
    resourceIds.map((resourceId) => [resourceId, value]),
  ) as Record<ResourceId, number>;
}
