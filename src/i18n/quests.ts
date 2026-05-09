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
      logDecisionAppeared: "Nastala situace, která vyžaduje rozhodnutí.",
    },
    objectives: {
      buildStorage: {
        title: "Postav sklad",
        description: "Zajisti místo pro zásoby, než začne tlak na produkci.",
        reward: "+45 materiál, +10 jídlo",
      },
      buildGenerator: {
        title: "Postav uhelný důl",
        description: "Zajisti palivo dřív, než ho spolknou vytápěné a technické budovy.",
        reward: "+50 materiál, +20 uhlí",
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
          answer: "Odpověď spálila uhlí v nouzovém napájení rádia, ale podařilo se zachytit souřadnice malého skladu materiálu.",
          listen: "Posádka poslouchala do tmy. Stálo to trochu uhlí, ale lidé získali pocit, že venku nejsou sami.",
          silence: "Rádio umlklo. Tábor zůstal skrytý a noc pokračovala bez dalších změn.",
        },
      },
      bittenStranger: {
        title: "Pokousaný cizinec",
        body:
          "Hlídka přivedla ke vchodu muže s obvázaným předloktím. Tvrdí, že ho poranilo sklo, ale jeden z obvazů prosakuje tmavou krví.",
        options: {
          isolate: "Izolovat a ošetřit",
          turnAway: "Vyhnat ho od brány",
          execute: "Zastřelit ho",
        },
        results: {
          isolate: "Cizinec skončil v izolaci mezi zraněnými. Lidé viděli opatrnost i špetku slitování.",
          turnAway: "Muž zmizel ve tmě. Osada je bezpečnější, ale někteří si budou pamatovat jeho prosby.",
          execute: "Výstřel ukončil spor okamžitě. Ticho po něm bylo těžší než samotné riziko.",
        },
      },
      traderAtDusk: {
        title: "Obchodník za soumraku",
        body:
          "K bráně dorazil samotář s taškou náhradních dílů a baterií. Chce rychle směnit zásoby a odejít dřív, než se setmí úplně.",
        options: {
          tradeFood: "Vyměnit jídlo za materiál",
          tradeWater: "Vyměnit vodu za uhlí",
          refuse: "Obchod odmítnout",
        },
        results: {
          tradeFood: "Jídlo změnilo majitele a sklad získal slušnou hromádku použitelného materiálu.",
          tradeWater: "Část vody padla na výměnu za nabité články. Generátor má na chvíli z čeho brát.",
          refuse: "Obchodník pokrčil rameny a zmizel v šeru. Zásoby zůstaly přesně tam, kde byly.",
        },
      },
      nightScreams: {
        title: "Křik v noci",
        body:
          "Z ruin za palisádou se ozval dlouhý křik. Někdo venku možná ještě žije, nebo vás něco chce vytáhnout z bezpečí.",
        options: {
          sendPatrol: "Poslat opatrnou hlídku",
          signal: "Zablikat světly",
          stayQuiet: "Zůstat potichu",
        },
        results: {
          sendPatrol: "Hlídka se nevrátila. Křik utichl a ráno zůstala u brány jen tři prázdná místa ve směnách.",
          signal: "Světla krátce prořízla tmu. Nikdo nepřišel, ale lidé ocenili, že osada neignoruje volání o pomoc.",
          stayQuiet: "Křik po chvíli utichl. Nikdo nezemřel za branou, ale ráno se o rozhodnutí mluvilo šeptem.",
        },
      },
      waterTheft: {
        title: "Ukradená voda",
        body:
          "U nádrží chybí několik kanistrů. Stráž našla viníka: mladou ženu, která tvrdí, že brala vodu pro nemocné dítě.",
        options: {
          amnesty: "Vyhlásit amnestii",
          punish: "Tvrdě potrestat",
          rationLock: "Zabezpečit příděly",
        },
        results: {
          amnesty: "Část vody je pryč, ale otevřená amnestie uklidnila lidi, kteří se báli trestu za zoufalství.",
          punish: "Trest odradil další krádeže. Stejně rychle ale ochladil náladu v osadě.",
          rationLock: "Nové zámky a značení spotřebovaly materiál, ale další výdej půjde lépe hlídat.",
        },
      },
      generatorSpareParts: {
        title: "Díly pro důl",
        body:
          "Mechanik našel krabici součástek z rozebrané čerpací stanice. Mohou okamžitě pomoct důlní technice, nebo skončit ve skladu.",
        options: {
          install: "Namontovat díly",
          store: "Rozebrat na materiál",
          trade: "Dobít články a směnit je za jídlo",
        },
        results: {
          install: "Díly sedly lépe, než kdo čekal. Důl vydal krátký, ale užitečný přebytek uhlí.",
          store: "Mechanik všechno roztřídil. Ze šuplíků a cívek zbyl praktický materiál pro stavby.",
          trade: "Část uhlí padla na nouzovou výměnu za jídlo.",
        },
      },
      provenTheft: {
        title: "Prokázaná krádež",
        body:
          "Stráž přivedla zloděje i s ukradenými zásobami. Nejde o pomluvu ani omyl: svědci i nález mluví jasně. Okradený žádá spravedlnost.",
        options: {
          exile: "Vyhostit zloděje",
          maim: "Zmrzačit ho",
          forgive: "Odpustit a odškodnit okradeného",
        },
        results: {
          exile: "Zloděj byl vyveden za bránu a už se nevrátí. Osada přišla o jednoho člověka.",
          maim: "Trest byl vykonán. Zloděj přežil, ale skončil mezi zraněnými a tábor ztichl.",
          forgive: "Okradený dostal náhradu ze společných zásob. Rozhodnutí uklidnilo část lidí a rozzuřilo jinou.",
        },
      },
      collapsedUnderpass: {
        title: "Zavalený podchod",
        body:
          "Průzkumník hlásí čerstvě zavalený podchod. Zpod betonu se ozývá klepání, ale místo je nestabilní a přitahuje hluk.",
        options: {
          digOut: "Pokusit se je vyprostit",
          markDanger: "Označit místo a odejít",
          leaveIt: "Nechat to být",
        },
        results: {
          digOut: "Záchrana stála síly a jídlo, ale pod sutinami byl i batoh s použitelným materiálem.",
          markDanger: "Hlídka místo označila pro příště. Nikdo neriskoval život, ale klepání utichlo až po chvíli.",
          leaveIt: "Rozkaz byl jasný: nezastavovat. Někteří lidé se mu od té chvíle vyhýbají pohledem.",
        },
      },
      brokenWaterFilter: {
        title: "Prasklý vodní filtr",
        body:
          "Jeden z filtrů praskl a část vody smrdí kovem a řasou. Dá se opravit, přídělovat, nebo risknout nouzové použití.",
        options: {
          repair: "Opravit filtr materiálem",
          ration: "Zavést příděly vody",
          riskDirtyWater: "Risknout špinavou vodu",
        },
        results: {
          repair: "Materiál padl na rychlou opravu a filtr vrátil část vody do bezpečných zásob.",
          ration: "Příděly udržely kontrolu, ale nálada u nádrží prudce zhoustla.",
          riskDirtyWater: "Voda prošla jen provizorně. Jeden člověk skončil nemocný a lidé začali o velení pochybovat.",
        },
      },
    },
    sudden: {
      cropSpoilage: {
        title: "Zkažení úrody",
        result: "Část úrody se zkazila ve vlhkém skladu. Zásoby jídla klesly.",
      },
      scarcityTheft: {
        title: "Krádež ze zoufalství",
        result: "Nedostatek rozkládá disciplínu. Ze skladu zmizelo {amount} {resource}.",
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
      logDecisionAppeared: "A situation requires a decision.",
    },
    objectives: {
      buildStorage: {
        title: "Build storage",
        description: "Create room for supplies before production pressure rises.",
        reward: "+45 material, +10 food",
      },
      buildGenerator: {
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
          tradeWater: "Some water was exchanged for charged cells. The generator has a little more to draw from.",
          refuse: "The trader shrugged and disappeared into the dusk. The stockpiles stayed exactly where they were.",
        },
      },
      nightScreams: {
        title: "Screams in the night",
        body:
          "A long scream rises from the ruins beyond the palisade. Someone may still be alive, or something may be trying to pull you out.",
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
      generatorSpareParts: {
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
  },
};
