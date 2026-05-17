import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const publicDir = path.join(__dirname, "public");
const execFileAsync = promisify(execFile);

const QUEST_DATA_PATHS = {
  decisions: {
    opening: {
      filePath: path.join(repoRoot, "src", "data", "decisionDefs", "opening.ts"),
      exportName: "openingDecisionQuestDefinitions",
    },
    community: {
      filePath: path.join(repoRoot, "src", "data", "decisionDefs", "community.ts"),
      exportName: "communityDecisionQuestDefinitions",
    },
    infrastructure: {
      filePath: path.join(repoRoot, "src", "data", "decisionDefs", "infrastructure.ts"),
      exportName: "infrastructureDecisionQuestDefinitions",
    },
  },
  objectives: {
    tutorial: {
      filePath: path.join(repoRoot, "src", "data", "questDefs", "objectives", "tutorialChain.ts"),
      exportName: "tutorialObjectiveQuestDefinitions",
    },
  },
  sudden: {
    pressure: {
      filePath: path.join(repoRoot, "src", "data", "questDefs", "sudden", "resourcePressure.ts"),
      exportName: "resourcePressureSuddenQuestDefinitions",
    },
  },
};

const CONTENT_QUESTS_DIR = path.join(repoRoot, "src", "content", "quests");
const I18N_QUESTS_DIR = path.join(repoRoot, "src", "i18n", "quests");
const GAME_TYPES_PATH = path.join(repoRoot, "src", "game", "types.ts");
const OBJECTIVE_CHAIN_BUNDLES = [
  {
    bundleId: "lootSettlementChain",
    idPrefix: "lootSettlementChain",
  },
  {
    bundleId: "reachPopulationChain",
    idPrefix: "reachPopulationChain",
  },
  {
    bundleId: "upgradeStorageChain",
    idPrefix: "upgradeStorageLevel",
  },
  {
    bundleId: "upgradeCoalMineChain",
    idPrefix: "upgradeCoalMineLevel",
  },
  {
    bundleId: "upgradeHydroponicsChain",
    idPrefix: "upgradeHydroponicsLevel",
  },
];

const META = {
  decisionGroups: Object.keys(QUEST_DATA_PATHS.decisions),
  objectiveGroups: Object.keys(QUEST_DATA_PATHS.objectives),
  suddenGroups: Object.keys(QUEST_DATA_PATHS.sudden),
  resourceIds: ["food", "water", "material", "coal", "morale"],
  buildingIds: [
    "mainBuilding",
    "storage",
    "dormitory",
    "hydroponics",
    "waterStill",
    "workshop",
    "coalMine",
    "market",
    "watchtower",
    "barracks",
    "academy",
    "clinic",
  ],
  decisionProfileAxes: ["communityMarket", "authorityAutonomy"],
  objectiveChainGroups: OBJECTIVE_CHAIN_BUNDLES.map((bundle) => bundle.bundleId),
};

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function toTsLiteral(value, indentLevel = 0) {
  const indent = "  ".repeat(indentLevel);
  const nextIndent = "  ".repeat(indentLevel + 1);

  if (value === null) {
    return "null";
  }

  if (value === Number.MAX_SAFE_INTEGER) {
    return "Number.MAX_SAFE_INTEGER";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const lines = value.map((entry) => `${nextIndent}${toTsLiteral(entry, indentLevel + 1)}`);
    return `[\n${lines.join(",\n")}\n${indent}]`;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "{}";
  }

  const lines = entries.map(([key, entry]) => `${nextIndent}${JSON.stringify(key)}: ${toTsLiteral(entry, indentLevel + 1)}`);
  return `{\n${lines.join(",\n")}\n${indent}}`;
}

function extractAssignedExpression(source, exportName) {
  const marker = `export const ${exportName}`;
  const markerIndex = source.indexOf(marker);

  if (markerIndex < 0) {
    throw new Error(`Cannot find export ${exportName}`);
  }

  const equalsIndex = source.indexOf("=", markerIndex);
  if (equalsIndex < 0) {
    throw new Error(`Cannot find assignment for ${exportName}`);
  }

  let i = equalsIndex + 1;
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let inString = null;
  let escaped = false;

  while (i < source.length) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === inString) {
        inString = null;
      }
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      i += 1;
      continue;
    }

    if (ch === "(") {
      depthParen += 1;
    } else if (ch === ")") {
      depthParen -= 1;
    } else if (ch === "{") {
      depthBrace += 1;
    } else if (ch === "}") {
      depthBrace -= 1;
    } else if (ch === "[") {
      depthBracket += 1;
    } else if (ch === "]") {
      depthBracket -= 1;
    } else if (ch === ";" && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
      break;
    }

    i += 1;
  }

  if (i >= source.length) {
    throw new Error(`Cannot find statement end for ${exportName}`);
  }

  const expression = source.slice(equalsIndex + 1, i).trim().replace(/\s+as const\s*$/, "").trim();
  return expression;
}

function evaluateExpression(expression) {
  return vm.runInNewContext(`(${expression})`, { Number, Math });
}

function loadExportedValue(filePath, exportName) {
  const source = readFileSync(filePath, "utf8");
  const expression = extractAssignedExpression(source, exportName);
  return evaluateExpression(expression);
}

function writeDecisionGroupFile(group, definitions) {
  const cfg = QUEST_DATA_PATHS.decisions[group];
  const fileBody = [
    'import type { DecisionQuestDefinition } from "./types";',
    "",
    `export const ${cfg.exportName}: DecisionQuestDefinition[] = ${toTsLiteral(definitions)};`,
    "",
  ].join("\n");
  writeFileSync(cfg.filePath, fileBody, "utf8");
}

function writeObjectiveGroupFile(group, definitions) {
  const cfg = QUEST_DATA_PATHS.objectives[group];
  const fileBody = [
    'import type { ObjectiveQuestDefinition } from "../types";',
    "",
    `export const ${cfg.exportName}: ObjectiveQuestDefinition[] = ${toTsLiteral(definitions)};`,
    "",
  ].join("\n");
  writeFileSync(cfg.filePath, fileBody, "utf8");
}

function writeSuddenGroupFile(group, definitions) {
  const cfg = QUEST_DATA_PATHS.sudden[group];
  const fileBody = [
    'import type { SuddenQuestDefinition } from "../types";',
    "",
    `export const ${cfg.exportName}: SuddenQuestDefinition[] = ${toTsLiteral(definitions)};`,
    "",
  ].join("\n");
  writeFileSync(cfg.filePath, fileBody, "utf8");
}

function getQuestLocaleExportName(kind, locale) {
  const suffix = locale === "en" ? "En" : "Cs";

  if (kind === "decisions") {
    return `decisionLocale${suffix}`;
  }

  if (kind === "objectives") {
    return `objectiveLocale${suffix}`;
  }

  if (kind === "sudden") {
    return `suddenLocale${suffix}`;
  }

  return `questUi${suffix}`;
}

function getObjectiveChainLocaleExportName(locale) {
  return locale === "en" ? "objectiveChainLocaleEn" : "objectiveChainLocaleCs";
}

function getObjectiveChainBundleId(questId) {
  return OBJECTIVE_CHAIN_BUNDLES.find((bundle) => questId.startsWith(bundle.idPrefix))?.bundleId ?? null;
}

function getObjectiveChainFilePath(bundleId, locale) {
  return path.join(CONTENT_QUESTS_DIR, "objectives", bundleId, "i18n", `${locale}.ts`);
}

function normalizeObjectiveLocale(value) {
  return {
    title: typeof value?.title === "string" ? value.title : "",
    description: typeof value?.description === "string" ? value.description : "",
  };
}

function findObjectiveLocaleInAnyBundle(questId, locale) {
  for (const bundle of OBJECTIVE_CHAIN_BUNDLES) {
    const filePath = getObjectiveChainFilePath(bundle.bundleId, locale);
    if (!existsSync(filePath)) {
      continue;
    }

    const localesById = loadExportedValue(
      filePath,
      getObjectiveChainLocaleExportName(locale),
    );
    const localeValue = localesById?.[questId];
    if (localeValue && typeof localeValue === "object") {
      return localeValue;
    }
  }

  return null;
}

function writeQuestLocale(kind, questId, locale, value) {
  const exportName = getQuestLocaleExportName(kind, locale);
  const filePath = path.join(CONTENT_QUESTS_DIR, kind, questId, "i18n", `${locale}.ts`);
  ensureDir(path.dirname(filePath));
  const body = `export const ${exportName} = ${toTsLiteral(value)} as const;\n`;
  writeFileSync(filePath, body, "utf8");
}

function loadObjectiveLocale(questId, locale) {
  const bundleId = getObjectiveChainBundleId(questId);

  if (!bundleId) {
    const legacyPath = path.join(CONTENT_QUESTS_DIR, "objectives", questId, "i18n", `${locale}.ts`);
    if (existsSync(legacyPath)) {
      return normalizeObjectiveLocale(loadExportedValue(
        legacyPath,
        getQuestLocaleExportName("objectives", locale),
      ));
    }

    const chainLocale = findObjectiveLocaleInAnyBundle(questId, locale);
    if (chainLocale) {
      return normalizeObjectiveLocale(chainLocale);
    }

    throw new Error(`Missing objective locale file for "${questId}" (${locale}).`);
  }

  const localesById = loadExportedValue(
    getObjectiveChainFilePath(bundleId, locale),
    getObjectiveChainLocaleExportName(locale),
  );
  const localeValue = localesById?.[questId];

  if (!localeValue || typeof localeValue !== "object") {
    const chainLocale = findObjectiveLocaleInAnyBundle(questId, locale);
    if (chainLocale) {
      return normalizeObjectiveLocale(chainLocale);
    }

    throw new Error(`Missing objective locale "${questId}" in bundle "${bundleId}" (${locale}).`);
  }

  return normalizeObjectiveLocale(localeValue);
}

function writeObjectiveLocales(objectiveEntries) {
  const groupedByBundle = new Map();

  for (const entry of objectiveEntries) {
    const bundleId = getObjectiveChainBundleId(entry.id);
    if (!bundleId) {
      writeQuestLocale("objectives", entry.id, "en", entry.i18n.en);
      writeQuestLocale("objectives", entry.id, "cs", entry.i18n.cs);
      continue;
    }

    if (!groupedByBundle.has(bundleId)) {
      groupedByBundle.set(bundleId, []);
    }

    groupedByBundle.get(bundleId).push(entry);
  }

  for (const [bundleId, entries] of groupedByBundle.entries()) {
    const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
    const enValue = Object.fromEntries(sorted.map((entry) => [entry.id, entry.i18n.en]));
    const csValue = Object.fromEntries(sorted.map((entry) => [entry.id, entry.i18n.cs]));
    const enPath = getObjectiveChainFilePath(bundleId, "en");
    const csPath = getObjectiveChainFilePath(bundleId, "cs");

    ensureDir(path.dirname(enPath));
    ensureDir(path.dirname(csPath));
    writeFileSync(
      enPath,
      `export const ${getObjectiveChainLocaleExportName("en")} = ${toTsLiteral(enValue)} as const;\n`,
      "utf8",
    );
    writeFileSync(
      csPath,
      `export const ${getObjectiveChainLocaleExportName("cs")} = ${toTsLiteral(csValue)} as const;\n`,
      "utf8",
    );
  }
}

function writeQuestUiLocale(locale, value) {
  const exportName = getQuestLocaleExportName("ui", locale);
  const filePath = path.join(CONTENT_QUESTS_DIR, "ui", "i18n", `${locale}.ts`);
  ensureDir(path.dirname(filePath));
  const body = `export const ${exportName} = ${toTsLiteral(value)} as const;\n`;
  writeFileSync(filePath, body, "utf8");
}

function formatI18nAggregator(locale, objectives, decisions, sudden) {
  const localeUpper = locale === "en" ? "En" : "Cs";
  const lines = [];
  const importedObjectiveChainBundles = new Set();

  lines.push('import type { QuestTranslationPack } from "../types";');
  lines.push(`import { questUi${localeUpper} } from "../../content/quests/ui/i18n/${locale}";`);

  objectives.forEach((entry) => {
    const bundleId = getObjectiveChainBundleId(entry.id);
    if (bundleId) {
      if (importedObjectiveChainBundles.has(bundleId)) {
        return;
      }
      importedObjectiveChainBundles.add(bundleId);
      lines.push(
        `import { ${getObjectiveChainLocaleExportName(locale)} as objectiveChain_${bundleId}_${locale} } from "../../content/quests/objectives/${bundleId}/i18n/${locale}";`,
      );
      return;
    }

    lines.push(
      `import { objectiveLocale${localeUpper} as objective_${entry.id}_${locale} } from "../../content/quests/objectives/${entry.id}/i18n/${locale}";`,
    );
  });

  decisions.forEach((entry) => {
    lines.push(
      `import { decisionLocale${localeUpper} as decision_${entry.id}_${locale} } from "../../content/quests/decisions/${entry.id}/i18n/${locale}";`,
    );
  });

  sudden.forEach((entry) => {
    lines.push(
      `import { suddenLocale${localeUpper} as sudden_${entry.id}_${locale} } from "../../content/quests/sudden/${entry.id}/i18n/${locale}";`,
    );
  });

  lines.push("");
  lines.push(`export const quests${localeUpper}: QuestTranslationPack = {`);
  lines.push(`  ui: questUi${localeUpper},`);
  lines.push("  objectives: {");
  objectives.forEach((entry) => {
    const bundleId = getObjectiveChainBundleId(entry.id);
    if (bundleId) {
      lines.push(`    ${entry.id}: objectiveChain_${bundleId}_${locale}.${entry.id},`);
      return;
    }

    lines.push(`    ${entry.id}: objective_${entry.id}_${locale},`);
  });
  lines.push("  },");
  lines.push("  decisions: {");
  decisions.forEach((entry) => {
    lines.push(`    ${entry.id}: decision_${entry.id}_${locale},`);
  });
  lines.push("  },");
  lines.push("  sudden: {");
  sudden.forEach((entry) => {
    lines.push(`    ${entry.id}: sudden_${entry.id}_${locale},`);
  });
  lines.push("  },");
  lines.push("};");
  lines.push("");

  return lines.join("\n");
}

function updateQuestTypeUnion(typeName, ids, source) {
  const union = ids.map((id) => `  | ${JSON.stringify(id)}`).join("\n");
  const replacement = `export type ${typeName} =\n${union};`;
  const regex = new RegExp(`export type ${typeName} =([\\s\\S]*?);`);

  if (!regex.test(source)) {
    throw new Error(`Cannot update type union for ${typeName}`);
  }

  return source.replace(regex, replacement);
}

function validateModel(model) {
  const decisions = model?.quests?.decisions ?? [];
  const objectives = model?.quests?.objectives ?? [];
  const sudden = model?.quests?.sudden ?? [];

  const unique = (entries, label) => {
    const seen = new Set();
    for (const entry of entries) {
      if (!entry?.id || typeof entry.id !== "string") {
        throw new Error(`${label}: missing id`);
      }
      if (seen.has(entry.id)) {
        throw new Error(`${label}: duplicate id \"${entry.id}\"`);
      }
      seen.add(entry.id);
    }
  };

  unique(decisions, "decisions");
  unique(objectives, "objectives");
  unique(sudden, "sudden");

  for (const quest of decisions) {
    if (!META.decisionGroups.includes(quest.group)) {
      throw new Error(`decision ${quest.id}: invalid group`);
    }

    const optionIds = new Set();
    for (const option of quest.definition?.options ?? []) {
      if (!option?.id || typeof option.id !== "string") {
        throw new Error(`decision ${quest.id}: invalid option id`);
      }
      if (optionIds.has(option.id)) {
        throw new Error(`decision ${quest.id}: duplicate option id \"${option.id}\"`);
      }
      optionIds.add(option.id);
    }
  }

  for (const objective of objectives) {
    objective.i18n = objective.i18n ?? {};
    objective.i18n.en = normalizeObjectiveLocale(objective.i18n.en);
    objective.i18n.cs = normalizeObjectiveLocale(objective.i18n.cs);
  }
}

async function loadQuestStudioModel() {
  const decisionEntries = [];

  for (const [group, cfg] of Object.entries(QUEST_DATA_PATHS.decisions)) {
    const definitions = loadExportedValue(cfg.filePath, cfg.exportName);

    for (const definition of definitions) {
      const en = loadExportedValue(
        path.join(CONTENT_QUESTS_DIR, "decisions", definition.id, "i18n", "en.ts"),
        "decisionLocaleEn",
      );
      const cs = loadExportedValue(
        path.join(CONTENT_QUESTS_DIR, "decisions", definition.id, "i18n", "cs.ts"),
        "decisionLocaleCs",
      );

      decisionEntries.push({
        id: definition.id,
        kind: "decision",
        group,
        definition,
        i18n: { en, cs },
      });
    }
  }

  const objectiveEntries = [];

  for (const [group, cfg] of Object.entries(QUEST_DATA_PATHS.objectives)) {
    const definitions = loadExportedValue(cfg.filePath, cfg.exportName);

    for (const definition of definitions) {
      const en = loadObjectiveLocale(definition.id, "en");
      const cs = loadObjectiveLocale(definition.id, "cs");

      objectiveEntries.push({
        id: definition.id,
        kind: "objective",
        group,
        definition,
        chainGroup: getObjectiveChainBundleId(definition.id),
        i18n: { en, cs },
      });
    }
  }

  const suddenEntries = [];

  for (const [group, cfg] of Object.entries(QUEST_DATA_PATHS.sudden)) {
    const definitions = loadExportedValue(cfg.filePath, cfg.exportName);

    for (const definition of definitions) {
      const en = loadExportedValue(
        path.join(CONTENT_QUESTS_DIR, "sudden", definition.id, "i18n", "en.ts"),
        "suddenLocaleEn",
      );
      const cs = loadExportedValue(
        path.join(CONTENT_QUESTS_DIR, "sudden", definition.id, "i18n", "cs.ts"),
        "suddenLocaleCs",
      );

      suddenEntries.push({
        id: definition.id,
        kind: "sudden",
        group,
        definition,
        i18n: { en, cs },
      });
    }
  }

  const uiEn = loadExportedValue(path.join(CONTENT_QUESTS_DIR, "ui", "i18n", "en.ts"), "questUiEn");
  const uiCs = loadExportedValue(path.join(CONTENT_QUESTS_DIR, "ui", "i18n", "cs.ts"), "questUiCs");

  return {
    meta: META,
    ui: {
      en: uiEn,
      cs: uiCs,
    },
    quests: {
      decisions: decisionEntries,
      objectives: objectiveEntries,
      sudden: suddenEntries,
    },
  };
}

function saveQuestStudioModel(model) {
  validateModel(model);

  const decisions = model.quests.decisions;
  const objectives = model.quests.objectives;
  const sudden = model.quests.sudden;

  for (const group of META.decisionGroups) {
    const definitions = decisions
      .filter((entry) => entry.group === group)
      .map((entry) => entry.definition);
    writeDecisionGroupFile(group, definitions);
  }

  for (const group of META.objectiveGroups) {
    const definitions = objectives
      .filter((entry) => entry.group === group)
      .map((entry) => entry.definition);
    writeObjectiveGroupFile(group, definitions);
  }

  for (const group of META.suddenGroups) {
    const definitions = sudden
      .filter((entry) => entry.group === group)
      .map((entry) => entry.definition);
    writeSuddenGroupFile(group, definitions);
  }

  for (const entry of decisions) {
    writeQuestLocale("decisions", entry.id, "en", entry.i18n.en);
    writeQuestLocale("decisions", entry.id, "cs", entry.i18n.cs);
  }

  writeObjectiveLocales(objectives);

  for (const entry of sudden) {
    writeQuestLocale("sudden", entry.id, "en", entry.i18n.en);
    writeQuestLocale("sudden", entry.id, "cs", entry.i18n.cs);
  }

  writeQuestUiLocale("en", model.ui.en);
  writeQuestUiLocale("cs", model.ui.cs);

  const decisionIds = decisions.map((entry) => entry.id);
  const objectiveIds = objectives.map((entry) => entry.id);
  const suddenIds = sudden.map((entry) => entry.id);

  let typesSource = readFileSync(GAME_TYPES_PATH, "utf8");
  typesSource = updateQuestTypeUnion("DecisionQuestId", decisionIds, typesSource);
  typesSource = updateQuestTypeUnion("ObjectiveQuestId", objectiveIds, typesSource);
  typesSource = updateQuestTypeUnion("SuddenQuestId", suddenIds, typesSource);
  writeFileSync(GAME_TYPES_PATH, typesSource, "utf8");

  const enBody = formatI18nAggregator("en", objectives, decisions, sudden);
  const csBody = formatI18nAggregator("cs", objectives, decisions, sudden);
  writeFileSync(path.join(I18N_QUESTS_DIR, "en.ts"), enBody, "utf8");
  writeFileSync(path.join(I18N_QUESTS_DIR, "cs.ts"), csBody, "utf8");
}

async function runGitCommand(args) {
  const { stdout, stderr } = await execFileAsync("git", args, { cwd: repoRoot });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

async function hasStagedChanges() {
  try {
    await runGitCommand(["diff", "--cached", "--quiet"]);
    return false;
  } catch {
    return true;
  }
}

async function getGitStatusSummary() {
  const branch = (await runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"])).stdout || "unknown";
  const porcelain = (await runGitCommand(["status", "--porcelain"])).stdout;
  const dirtyCount = porcelain === "" ? 0 : porcelain.split(/\r?\n/).filter(Boolean).length;

  let aheadCount = 0;
  try {
    const ahead = await runGitCommand(["rev-list", "--count", "@{u}..HEAD"]);
    aheadCount = Number(ahead.stdout || "0");
  } catch {
    aheadCount = 0;
  }

  return { branch, dirtyCount, aheadCount };
}

async function commitAndPush({ commitMessage, remote = "origin", branch = null }) {
  if (!commitMessage || typeof commitMessage !== "string") {
    throw new Error("commitMessage is required.");
  }

  const currentBranch = (await runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"])).stdout;
  const targetBranch = branch || currentBranch;

  await runGitCommand(["add", "-A"]);

  if (await hasStagedChanges()) {
    await runGitCommand(["commit", "-m", commitMessage]);
  }

  await runGitCommand(["push", remote, targetBranch]);
  const head = (await runGitCommand(["rev-parse", "HEAD"])).stdout;
  return { branch: targetBranch, head };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, contentType, text) {
  response.writeHead(status, { "Content-Type": `${contentType}; charset=utf-8` });
  response.end(text);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function serveStatic(response, requestPath) {
  const normalized = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(publicDir, normalized);

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    sendText(response, 404, "text/plain", "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".html"
    ? "text/html"
    : ext === ".css"
      ? "text/css"
      : ext === ".js"
        ? "application/javascript"
        : "text/plain";

  sendText(response, 200, mime, readFileSync(filePath, "utf8"));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/quests") {
    try {
      const model = await loadQuestStudioModel();
      sendJson(response, 200, model);
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/quests/save") {
    try {
      const raw = await readBody(request);
      const payload = JSON.parse(raw);
      saveQuestStudioModel(payload);
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/git/status") {
    try {
      const status = await getGitStatusSummary();
      sendJson(response, 200, status);
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/git/push") {
    try {
      const raw = await readBody(request);
      const payload = JSON.parse(raw);
      const result = await commitAndPush({
        commitMessage: payload.commitMessage,
        remote: payload.remote ?? "origin",
        branch: payload.branch ?? null,
      });
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  serveStatic(response, url.pathname);
});

const port = Number(process.env.QUEST_STUDIO_PORT ?? 5180);
server.listen(port, () => {
  console.log(`Quest Studio running at http://127.0.0.1:${port}/`);
});
