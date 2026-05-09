import type { QuestTranslationPack } from "../types";

export const quests: QuestTranslationPack = {
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
  };
