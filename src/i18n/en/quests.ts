import type { QuestTranslationPack } from "../types";

export const quests: QuestTranslationPack = {
    ui: {
      title: "Tasks",
      activeObjectives: "Active tasks",
      objectivesEmpty: "No active tasks.",
      decision: "Decision",
      notEnoughSupplies: "Not enough supplies",
      logObjectiveCompleted: "Task completed: {quest}.",
      logObjectiveRewardClaimed: "Reward claimed: {quest}.",
      logDecisionAppeared: "A situation requires a decision.",
    },
    objectives: {
      buildStorage: {
        title: "Build storage",
        description: "Create room for supplies before production pressure rises.",
        reward: "+45 material, +10 food",
      },
      buildCoalMine: {
        title: "Build a coal mine",
        description: "Secure fuel before heated and technical buildings drain the reserve.",
        reward: "+50 material, +20 coal",
      },
      buildWaterStill: {
        title: "Build a water still",
        description: "Stable water will decide the first week.",
        reward: "+45 material, +12 water",
      },
      buildHydroponics: {
        title: "Build hydroponics",
        description: "Indoor food reduces dependence on outside finds.",
        reward: "+50 material, +18 food",
      },
      buildDormitory: {
        title: "Build a dormitory",
        description: "Once water and food are running, give people safe beds.",
        reward: "+65 material, +10 food",
      },
    },
    decisions: {
      survivorsAtGate: {
        title: "Survivors at the gate",
        body:
          "A group of three survivors appears beyond the gate. They look hungry and desperate. One of them is injured.",
        options: {
          accept: "Accept the survivors",
          refuse: "Refuse the survivors",
          execute: "Kill them",
        },
        results: {
          accept: "The group was accepted. Two can work, one is moved among the injured.",
          refuse: "The gate stayed closed. After a while the group vanished into the ruins.",
          execute: "The order was carried out. Someone in the village saw it, and morale fell.",
        },
      },
      rationDispute: {
        title: "Ration dispute",
        body:
          "An argument breaks out by storage. Two families claim their ration was recorded wrong, and the crowd is getting tense.",
        options: {
          share: "Redistribute the rations",
          guards: "Let the guards decide",
          ignore: "Ignore it",
        },
        results: {
          share: "Some food was spent calming the dispute. People saw the command act fairly.",
          guards: "The guards ended the dispute hard. The line grew quiet, but fearful.",
          ignore: "The dispute dissolved into quiet resentment. Nothing else happened today.",
        },
      },
      radioCall: {
        title: "Strange radio call",
        body:
          "A stranger's voice cuts through the night static. It mentions a warehouse north of the interchange, then the signal breaks.",
        options: {
          answer: "Answer the frequency",
          listen: "Keep listening",
          silence: "Shut the radio off",
        },
        results: {
          answer: "The answer burned coal in the emergency radio rig, but the camp caught coordinates for a small material cache.",
          listen: "The crew listened into the dark. It cost some coal, but people felt less alone outside.",
          silence: "The radio went quiet. The camp stayed hidden and the night moved on.",
        },
      },
      bittenStranger: {
        title: "Bitten stranger",
        body:
          "The watch brings a man to the entrance with a bandaged forearm. He says it was broken glass, but one wrap is leaking dark blood.",
        options: {
          isolate: "Isolate and treat him",
          turnAway: "Drive him from the gate",
          execute: "Shoot him",
        },
        results: {
          isolate: "The stranger was isolated with the injured. People saw caution, and a little mercy.",
          turnAway: "The man vanished into the dark. The settlement is safer, but some will remember his pleading.",
          execute: "The shot ended the argument at once. The silence after it felt heavier than the risk.",
        },
      },
      traderAtDusk: {
        title: "Trader at dusk",
        body:
          "A lone trader reaches the gate with spare parts and batteries. He wants a quick exchange before the light is gone.",
        options: {
          tradeFood: "Trade food for material",
          tradeWater: "Trade water for coal",
          refuse: "Refuse the trade",
        },
        results: {
          tradeFood: "Food changed hands and storage gained a useful pile of workable material.",
          tradeWater: "Some water was exchanged for charged cells. The camp has a little more coal to draw from.",
          refuse: "The trader shrugged and disappeared into the dusk. The stockpiles stayed exactly where they were.",
        },
      },
      nightScreams: {
        title: "Screams in the night",
        body:
          "A long scream rises from the ruins beyond the perimeter wall. Someone may still be alive, or something may be trying to pull you out.",
        options: {
          sendPatrol: "Send a careful patrol",
          signal: "Flash the lights",
          stayQuiet: "Stay quiet",
        },
        results: {
          sendPatrol: "The patrol did not return. The screaming stopped, and morning left three empty places in the work shifts.",
          signal: "The lights cut through the dark. No one came, but people valued that the settlement did not ignore a call for help.",
          stayQuiet: "The screaming stopped after a while. No one died beyond the gate, but people spoke of the decision in whispers.",
        },
      },
      waterTheft: {
        title: "Stolen water",
        body:
          "Several canisters are missing from the tanks. The guard found the thief: a young woman who says she took water for a sick child.",
        options: {
          amnesty: "Declare an amnesty",
          punish: "Punish her hard",
          rationLock: "Secure the ration stores",
        },
        results: {
          amnesty: "Some water is gone, but an open amnesty calmed people who feared punishment for desperation.",
          punish: "The punishment discouraged more theft. It also chilled the settlement's mood just as quickly.",
          rationLock: "New locks and markings cost material, but future rationing will be easier to watch.",
        },
      },
      coalMineSpareParts: {
        title: "Mine spare parts",
        body:
          "The mechanic found a box of parts from a stripped fuel station. They could help the mine gear now, or be broken down for storage.",
        options: {
          install: "Install the parts",
          store: "Break them into material",
          trade: "Charge cells and trade for food",
        },
        results: {
          install: "The parts fit better than expected. The mine produced a short but useful coal surplus.",
          store: "The mechanic sorted everything. Coils, brackets, and scraps became practical building material.",
          trade: "Some coal was pushed through a quick emergency trade for food.",
        },
      },
      provenTheft: {
        title: "Proven theft",
        body:
          "The guard brings in the thief with the stolen supplies. This is not rumor or one word against another: witnesses and evidence are clear. The victim demands justice.",
        options: {
          exile: "Exile the thief",
          maim: "Maim him",
          forgive: "Forgive and compensate the victim",
        },
        results: {
          exile: "The thief was escorted beyond the gate and will not return. The settlement lost one person.",
          maim: "The sentence was carried out. The thief survived, but moved among the injured, and the camp went quiet.",
          forgive: "The victim was compensated from common stores. The decision calmed some people and angered others.",
        },
      },
      collapsedUnderpass: {
        title: "Collapsed underpass",
        body:
          "A scout reports a freshly collapsed underpass. Knocking comes from under the concrete, but the site is unstable and noise carries.",
        options: {
          digOut: "Try to dig them out",
          markDanger: "Mark the danger and leave",
          leaveIt: "Leave it alone",
        },
        results: {
          digOut: "The rescue cost strength and food, but there was a pack of usable material under the rubble.",
          markDanger: "The patrol marked the site for later. No one risked their life, but the knocking took a while to stop.",
          leaveIt: "The order was clear: do not stop. Some people have avoided looking at command since then.",
        },
      },
      brokenWaterFilter: {
        title: "Broken water filter",
        body:
          "One filter cracked, and some water smells of metal and algae. You can repair it, ration around it, or risk emergency use.",
        options: {
          repair: "Repair it with material",
          ration: "Start water rationing",
          riskDirtyWater: "Risk the dirty water",
        },
        results: {
          repair: "Material went into a quick repair, and the filter returned some water to safe storage.",
          ration: "Rationing kept control, but the mood around the tanks turned tense fast.",
          riskDirtyWater: "The water was only roughly treated. One person became ill, and people began doubting command.",
        },
      },
    },
    sudden: {
      cropSpoilage: {
        title: "Crop spoilage",
        result: "Part of the harvest spoiled in damp storage. Food stocks fell.",
      },
      scarcityTheft: {
        title: "Desperate theft",
        result: "Scarcity is wearing discipline thin. {amount} {resource} disappeared from storage.",
      },
    },
  };
