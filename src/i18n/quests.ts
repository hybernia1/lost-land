import type { Locale } from "./types";

export type QuestTranslationPack = {
  ui: Record<string, string>;
  objectives: Record<string, {
    title: string;
    description: string;
    reward: string;
  }>;
  decisions: Record<string, {
    title: string;
    body: string;
    options: Record<string, string>;
    results: Record<string, string>;
  }>;
  sudden: Record<string, {
    title: string;
    result: string;
  }>;
};

export const questTranslations: Record<Locale, QuestTranslationPack> = {
  cs: {
    ui: {
      title: "Úkoly",
      activeObjectives: "Aktivní úkoly",
      objectivesEmpty: "Žádné aktivní úkoly.",
      decision: "Rozhodnutí",
      decisionRequired: "Bezodkladné rozhodnutí",
      hiddenConsequences: "Následky možností nejsou předem známé.",
      notEnoughSupplies: "Nedostatek zásob",
      logObjectiveCompleted: "Úkol splněn: {quest}.",
      logDecisionAppeared: "U brány nastala situace, která vyžaduje rozhodnutí.",
    },
    objectives: {
      buildStorage: {
        title: "Postav sklad",
        description: "Zajisti místo pro zásoby, než začne tlak na produkci.",
        reward: "+45 materiál, +10 jídlo",
      },
      buildGenerator: {
        title: "Postav generátor",
        description: "Zajisti vlastní energii dřív, než ji spolknou provozní budovy.",
        reward: "+50 materiál, +20 energie",
      },
      buildWaterStill: {
        title: "Postav čističku vody",
        description: "Stabilní voda rozhodne první týden.",
        reward: "+45 materiál, +12 voda",
      },
      buildHydroponics: {
        title: "Postav hydroponii",
        description: "Vnitřní jídlo sníží závislost na nálezech venku.",
        reward: "+50 materiál, +18 jídlo",
      },
      buildDormitory: {
        title: "Postav ubytovnu",
        description: "Až běží voda a jídlo, dej lidem bezpečná lůžka.",
        reward: "+65 materiál, +10 jídlo",
      },
      buildPalisade: {
        title: "Postav palisádu",
        description: "Brána potřebuje skutečný perimetr, ne jen hlídku.",
        reward: "+60 materiál, +2 morálka",
      },
    },
    decisions: {
      survivorsAtGate: {
        title: "Přeživší za branou",
        body:
          "Za branami osady se objevila skupina tří přeživších. Vypadají hladově a zoufale. Jeden z nich je zraněný.",
        options: {
          accept: "Přijmout přeživší",
          refuse: "Odmítnout přeživší",
          execute: "Zabít je",
        },
        results: {
          accept: "Skupina byla přijata. Dva lidé jsou schopní pracovat, jeden míří mezi zraněné.",
          refuse: "Brána zůstala zavřená. Skupina po chvíli zmizela v ruinách.",
          execute: "Rozkaz byl vykonán. Někdo z vesnice to viděl a morálka klesla.",
        },
      },
      rationDispute: {
        title: "Spor o příděly",
        body:
          "U skladu se strhla hádka. Dvě rodiny tvrdí, že jejich příděl byl zapsán špatně, a dav začíná houstnout.",
        options: {
          share: "Rozdělit příděly znovu",
          guards: "Nechat rozhodnout stráže",
          ignore: "Nevšímat si toho",
        },
        results: {
          share: "Část zásob padla na uklidnění sporu. Lidé ale viděli, že velení jedná spravedlivě.",
          guards: "Stráže spor rázně ukončily. Ve frontě zůstalo ticho, ale i strach.",
          ignore: "Spor se rozpadl do tichých křivd. Dnes se nic dalšího nestalo.",
        },
      },
      radioCall: {
        title: "Cizí volání",
        body:
          "Noční šum rádia na chvíli prořízl cizí hlas. Zmiňuje skladiště za severní spojkou, ale signál se rozpadá.",
        options: {
          answer: "Odpovědět na frekvenci",
          listen: "Jen poslouchat dál",
          silence: "Rádio vypnout",
        },
        results: {
          answer: "Odpověď spálila energii, ale podařilo se zachytit souřadnice malého skladu materiálu.",
          listen: "Posádka poslouchala do tmy. Stálo to trochu energie, ale lidé získali pocit, že venku nejsou sami.",
          silence: "Rádio umlklo. Tábor zůstal skrytý a noc pokračovala bez dalších změn.",
        },
      },
    },
    sudden: {
      cropSpoilage: {
        title: "Zkažení úrody",
        result: "Část úrody se zkazila ve vlhkém skladu. Zásoby jídla klesly.",
      },
    },
  },
  en: {
    ui: {
      title: "Tasks",
      activeObjectives: "Active tasks",
      objectivesEmpty: "No active tasks.",
      decision: "Decision",
      decisionRequired: "Immediate decision",
      hiddenConsequences: "The consequences are not shown in advance.",
      notEnoughSupplies: "Not enough supplies",
      logObjectiveCompleted: "Task completed: {quest}.",
      logDecisionAppeared: "A situation at the gate requires a decision.",
    },
    objectives: {
      buildStorage: {
        title: "Build storage",
        description: "Create room for supplies before production pressure rises.",
        reward: "+45 material, +10 food",
      },
      buildGenerator: {
        title: "Build a generator",
        description: "Secure your own power before operating buildings drain the reserve.",
        reward: "+50 material, +20 energy",
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
      buildPalisade: {
        title: "Build the palisade",
        description: "The gate needs a real perimeter, not just a watch.",
        reward: "+60 material, +2 morale",
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
          answer: "The answer burned power, but the camp caught coordinates for a small material cache.",
          listen: "The crew listened into the dark. It cost some power, but people felt less alone outside.",
          silence: "The radio went quiet. The camp stayed hidden and the night moved on.",
        },
      },
    },
    sudden: {
      cropSpoilage: {
        title: "Crop spoilage",
        result: "Part of the harvest spoiled in damp storage. Food stocks fell.",
      },
    },
  },
};
