import type { GameState } from "../../../game/types";
import { getLogEntrySeverity } from "../../../systems/log";

export function getLogEntryFillColor(entry: GameState["log"][number], latest: boolean): number {
  const severity = getLogEntrySeverity(entry);

  if (severity === "critical") {
    return 0xff707a;
  }

  if (severity === "warning") {
    return 0xf1c17f;
  }

  if (severity === "positive") {
    return 0x9ed99b;
  }

  return latest ? 0xf1df9a : 0xc8cabb;
}

export function getLogEntryIconId(entry: GameState["log"][number]): string {
  const key = entry.key;

  if (key === "logStarvationDeath" || key === "logDehydrationDeath") {
    return "death";
  }

  if (
    key === "logConstructionInjury" ||
    key === "logScarcityInjury" ||
    key === "logIllness" ||
    key === "logClinicTreated" ||
    key === "logShelterExposureInjury"
  ) {
    return "crisis-injured";
  }

  if (key === "logConstructionStarted" || key === "logUpgradeStarted" || key === "logReachedLevel") {
    return "build";
  }

  if (key === "logSurvivorJoined" || key === "logSurvivorsJoined") {
    return "people";
  }

  if (key === "logScoutingStarted" || key === "logScoutingReturned") {
    return "scout";
  }

  if (
    key === "logResourceSiteAssaultStarted" ||
    key === "logResourceSiteAssaultFailed" ||
    key === "logResourceSiteAssaultOverrun" ||
    key === "logResourceSiteCaptured"
  ) {
    return "shield";
  }

  if (key === "logMarketTrade") {
    return "material";
  }

  if (key === "logEnvironmentRainStarted" || key === "logEnvironmentRainEnded") {
    return "crisis-rain";
  }

  if (key === "logEnvironmentSnowStarted" || key === "logEnvironmentSnowEnded") {
    return "crisis-snow";
  }

  if (key === "logEnvironmentRadiationStarted" || key === "logEnvironmentRadiationEnded") {
    return "crisis-radiation";
  }

  if (
    key === "logShelterCrisisStarted" ||
    key === "logShelterCrisisWarning" ||
    key === "logShelterCrisisResolved"
  ) {
    return "crisis-shelter";
  }

  if (key === "logShelterExposure") {
    return "crisis-countdown";
  }

  if (key === "logDecisionAppeared") {
    return "archive";
  }

  const severity = getLogEntrySeverity(entry);
  if (severity === "critical") {
    return "death";
  }
  if (severity === "warning") {
    return "crisis-countdown";
  }
  if (severity === "positive") {
    return "people";
  }

  return "clock";
}
