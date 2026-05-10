export const gameConfig = {
  simulation: {
    tickSeconds: 1,
    autosaveRealSeconds: 10,
    startingStockRatio: 1,
  },
  time: {
    dayRealSeconds: 45 * 60,
    clockStartHour: 8,
    dayStartHour: 8,
    duskStartHour: 20,
    nightStartHour: 22,
    dawnStartHour: 6,
  },
  environment: {
    minIntensity: 1,
    maxIntensity: 2,
    initialDelayHours: 8,
    cooldownHours: 9,
    shelterWarningLeadHours: 2,
    shelterRepeatDeadlineHours: 4,
    devConditionDurationHours: 8,
  },
  scouting: {
    durationHours: 12,
    carryPerTroop: 25,
  },
  market: {
    tradeCooldownHours: 4,
  },
} as const;
