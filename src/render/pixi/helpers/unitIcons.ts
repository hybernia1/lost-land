import type { UnitId } from "../../../game/types";

export function getUnitIconId(unitId: UnitId): string {
  if (unitId === "archer") {
    return "archer";
  }

  if (unitId === "bulwark") {
    return "shield";
  }

  return "troop";
}
