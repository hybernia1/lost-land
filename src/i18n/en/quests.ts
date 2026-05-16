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
    logDecisionAppeared: "The council demands a decision.",
  },
  objectives: {
    buildStorage: {
      title: "Build storage",
      description: "Seal and sort supplies before damp rot and spores take them.",
      reward: "+45 material, +10 food",
    },
    buildCoalMine: {
      title: "Build a coal mine",
      description: "Coal keeps kilns, stills, and forge fires alive in a world without a grid.",
      reward: "+50 material, +20 coal",
    },
    buildWaterStill: {
      title: "Build a water still",
      description: "Untreated water is poison now. Stabilize clean water before the first real shortage.",
      reward: "+45 material, +12 water",
    },
    buildHydroponics: {
      title: "Build hydroponics",
      description: "Wild game looks healthy but cannot be eaten. Grow food under your own roof.",
      reward: "+50 material, +18 food",
    },
    buildDormitory: {
      title: "Build a dormitory",
      description: "If the camp should outlive this season, people need dry beds and walls that hold.",
      reward: "+65 material, +10 food",
    },
  },
  decisions: {
    foundingBriefing: {
      title: "Council at the ember pit",
      body:
        "Year 2143. More than a century after the collapse, no one alive remembers the old world. Moss has swallowed its machines, written history is mostly gone, and truth survives as rumor and myth. Water must be treated, wild meat is tainted, and twisted things move beyond the palisade. The elders ask how this community begins.",
      options: {
        fortify: "Fortify the gate and stock watchfires",
        scoutRumors: "Send runners to verify nearby rumors",
        emberOath: "Gather everyone for an ember oath",
      },
      results: {
        fortify: "The gate was reinforced and fire posts were stocked. The camp feels harder, stricter, and ready for first contact.",
        scoutRumors: "Runners returned with one new pair of hands and rough paths scratched onto bark maps.",
        emberOath: "People stood around the ember pit and swore to hold together. Morale rose before the first hard day.",
      },
    },
    survivorsAtGate: {
      title: "Survivors at the gate",
      body:
        "A group of three travelers appears beyond the palisade. Hungry, exhausted, and half-hidden by moss cloaks. One is injured.",
      options: {
        accept: "Accept the survivors",
        refuse: "Refuse the survivors",
        execute: "Kill them",
      },
      results: {
        accept: "The group was accepted. Two can work, one is moved among the injured.",
        refuse: "The gate stayed closed. After a while the group vanished into the overgrown ruins.",
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
      title: "Whispers in copper wire",
      body:
        "A salvage crew strung old copper line between two roof masts. In the night, the wire carries patterned taps and whistle tones from the north ridge, then falls silent.",
      options: {
        answer: "Reply with code taps and fire signals",
        listen: "Keep listening from the dark",
        silence: "Cut the line for the night",
      },
      results: {
        answer: "The reply consumed coal for signal braziers, but the crew extracted directions to a small cache of usable material.",
        listen: "The watch listened without answering. It cost a little coal to keep the line warm, but the camp felt less alone.",
        silence: "The line went dead. The settlement stayed hidden and the night moved on.",
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
        "A lone trader reaches the gate with scrap tools, dried herbs, and hand-cast filter cups. He wants a quick exchange before full dark.",
      options: {
        tradeFood: "Trade food for material",
        tradeWater: "Trade water for coal",
        refuse: "Refuse the trade",
      },
      results: {
        tradeFood: "Food changed hands and storage gained a useful pile of workable material.",
        tradeWater: "Some water was exchanged for coal bricks wrapped in canvas. The stoves can burn longer.",
        refuse: "The trader shrugged and disappeared into the dusk. The stockpiles stayed exactly where they were.",
      },
    },
    nightScreams: {
      title: "Screams in the night",
      body:
        "A long scream rises from the ruins beyond the perimeter wall. Someone may still be alive, or something may be trying to pull you out.",
      options: {
        sendPatrol: "Send a careful patrol",
        signal: "Raise high watchfires",
        stayQuiet: "Stay quiet",
      },
      results: {
        sendPatrol: "The patrol did not return. The screaming stopped, and morning left three empty places in the work shifts.",
        signal: "The watchfires burned bright against the dark. No one came, but people valued that the settlement did not ignore a cry for help.",
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
        "The mechanic found a box of parts from a stripped pump station. They could help the mine gear now, or be broken down for storage.",
      options: {
        install: "Install the parts",
        store: "Break them into material",
        trade: "Trade quickly for food",
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
