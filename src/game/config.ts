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
  market: {
    tradeCooldownHours: 4,
  },
  barracks: {
    troopTraining: {
      footman: {
        seconds: 60,
        cost: {
          food: 30,
          water: 18,
          material: 10,
        },
      },
      archer: {
        seconds: 90,
        cost: {
          food: 52,
          water: 32,
          material: 34,
        },
      },
      bulwark: {
        seconds: 120,
        cost: {
          food: 70,
          water: 46,
          material: 72,
        },
      },
    },
  },
  combat: {
    stackSize: 5,
    stackDamageScaling: 0.65,
  },
  audio: {
    uiVolume: 0.45,
    decisionAlertVolume: 0.86,
    ambientCrossfadeMs: 900,
    ambientLoopVolume: {
      day: 0.24,
      night: 0.28,
      rain: 0.3,
    },
  },
} as const;
