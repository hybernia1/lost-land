import type { QuestTranslationPack } from "../types";

export const quests: QuestTranslationPack = {
  ui: {
    title: "Úkoly",
    activeObjectives: "Aktivní úkoly",
    objectivesEmpty: "Žádné aktivní úkoly.",
    decision: "Rozhodnutí",
    notEnoughSupplies: "Nedostatek zásob",
    logObjectiveCompleted: "Úkol splněn: {quest}.",
    logObjectiveRewardClaimed: "Odměna vyzvednuta: {quest}.",
    logDecisionAppeared: "Rada čeká na rozhodnutí.",
  },
  objectives: {
    buildStorage: {
      title: "Postav sklad",
      description: "Utřiď zásoby dřív, než je sežere vlhko, plíseň a spory.",
      reward: "+45 materiál, +10 jídlo",
    },
    buildCoalMine: {
      title: "Postav uhelný důl",
      description: "Bez rozvodné sítě drží osadu při životě jen uhlí pro pece, čističky a výhně.",
      reward: "+50 materiál, +20 uhlí",
    },
    buildWaterStill: {
      title: "Postav čističku vody",
      description: "Neošetřená voda je jed. Stabilní pitná voda rozhodne první těžké dny.",
      reward: "+45 materiál, +12 voda",
    },
    buildHydroponics: {
      title: "Postav hydroponii",
      description: "Zvěř venku vypadá zdravě, ale jíst se nedá. Vypěstuj jídlo pod vlastní střechou.",
      reward: "+50 materiál, +18 jídlo",
    },
    buildDormitory: {
      title: "Postav ubytovnu",
      description: "Jestli má osada přežít další sezónu, lidé potřebují suché postele a pevné stěny.",
      reward: "+65 materiál, +10 jídlo",
    },
  },
  decisions: {
    foundingBriefing: {
      title: "Rada u žhavého ohniště",
      body:
        "Rok 2143. Od globálního kolapsu uplynulo přes sto let a nikdo živý už starý svět nepamatuje. Stroje zarostly mechem, spisy se rozpadly a pravda přežila hlavně jako báje. Voda se musí čistit, zvěř je nepoživatelná a za palisádou se pohybují zmutované existence. Starší čekají, jakým směrem osadu povedeš.",
      options: {
        fortify: "Zesílit bránu a připravit strážní ohně",
        scoutRumors: "Vyslat běžce ověřit pověsti v okolí",
        emberOath: "Svolat lidi k přísaze u žhavých uhlíků",
      },
      results: {
        fortify: "Brána byla zpevněna a hlídky dostaly zásoby pro noční ohně. Osada působí tvrději a připraveněji.",
        scoutRumors: "Běžci se vrátili s jedním novým člověkem a hrubou mapou cest vyškrábanou do kůry.",
        emberOath: "Lidé složili přísahu kolem ohniště. Morálka stoupla ještě před prvním těžkým dnem.",
      },
    },
    survivorsAtGate: {
      title: "Přeživší za branou",
      body:
        "Za palisádou se objevila trojice poutníků. Hladoví, vyčerpaní, zarostlí mechem a blátem. Jeden z nich je zraněný.",
      options: {
        accept: "Přijmout přeživší",
        refuse: "Odmítnout přeživší",
        execute: "Zabít je",
      },
      results: {
        accept: "Skupina byla přijata. Dva lidé jsou schopní práce, jeden míří mezi zraněné.",
        refuse: "Brána zůstala zavřená. Po chvíli skupina zmizela v přerostlých ruinách.",
        execute: "Rozkaz byl vykonán. Někdo z osady to viděl a morálka klesla.",
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
      title: "Šepot ve starých drátech",
      body:
        "Sběrači natáhli mezi střechami staré měděné vedení. V noci se po něm ozvalo rytmické klepání a pískání ze severního hřebene, pak ticho.",
      options: {
        answer: "Odpovědět kódem a signálními ohni",
        listen: "Jen dál poslouchat",
        silence: "Na noc vedení odpojit",
      },
      results: {
        answer: "Odpověď spálila uhlí ve strážních ohništích, ale podařilo se získat směr k menší skrýši materiálu.",
        listen: "Hlídka naslouchala bez odpovědi. Stálo to trochu uhlí, ale osada měla pocit, že venku není sama.",
        silence: "Vedení umlklo. Osada zůstala skrytá a noc pokračovala bez dalších změn.",
      },
    },
    bittenStranger: {
      title: "Pokousaný cizinec",
      body:
        "Hlídka přivedla ke vchodu muže s obvázaným předloktím. Tvrdí, že ho pořezalo sklo, ale jeden z obvazů prosakuje tmavou krví.",
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
        "K bráně dorazil samotář se šrotem, sušenými bylinami a ručně odlévanými filtračními miskami. Chce rychle směnit a odejít před úplnou tmou.",
      options: {
        tradeFood: "Vyměnit jídlo za materiál",
        tradeWater: "Vyměnit vodu za uhlí",
        refuse: "Obchod odmítnout",
      },
      results: {
        tradeFood: "Jídlo změnilo majitele a sklad získal slušnou hromádku použitelného materiálu.",
        tradeWater: "Část vody padla na výměnu za lisované uhlí v plátěných vacích. Pece vydrží déle.",
        refuse: "Obchodník pokrčil rameny a zmizel v šeru. Zásoby zůstaly přesně tam, kde byly.",
      },
    },
    nightScreams: {
      title: "Křik v noci",
      body:
        "Z ruin za perimetrovou zdí se ozval dlouhý křik. Někdo venku možná ještě žije, nebo vás něco chce vytáhnout z bezpečí.",
      options: {
        sendPatrol: "Poslat opatrnou hlídku",
        signal: "Rozhořet vysoké strážní ohně",
        stayQuiet: "Zůstat potichu",
      },
      results: {
        sendPatrol: "Hlídka se nevrátila. Křik utichl a ráno zůstala u brány tři prázdná místa ve směnách.",
        signal: "Strážní ohně krátce prořízly tmu. Nikdo nepřišel, ale lidé ocenili, že osada neignoruje volání o pomoc.",
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
    coalMineSpareParts: {
      title: "Díly pro důl",
      body:
        "Mechanik našel krabici součástek z rozebrané čerpací stanice. Mohou okamžitě pomoct důlní technice, nebo skončit ve skladu.",
      options: {
        install: "Namontovat díly",
        store: "Rozebrat na materiál",
        trade: "Rychle směnit za jídlo",
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
        digOut: "Záchrana stála síly i jídlo, ale pod sutinami byl i batoh s použitelným materiálem.",
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
