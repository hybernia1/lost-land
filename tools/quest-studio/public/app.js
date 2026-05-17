const LIST_PAGE_SIZE = 40;

const QUEST_TEMPLATES = {
  decisions: {
    civicChoice3: {
      description: "3-option civic decision",
      build: (id) => ({
        definition: {
          id,
          minElapsedSeconds: 0,
          weight: 2,
          options: [
            { id: "support" },
            { id: "strict" },
            { id: "delay" },
          ],
        },
        i18n: {
          en: {
            title: "",
            body: "",
            options: { support: "", strict: "", delay: "" },
            results: { support: "", strict: "", delay: "" },
          },
          cs: {
            title: "",
            body: "",
            options: { support: "", strict: "", delay: "" },
            results: { support: "", strict: "", delay: "" },
          },
        },
      }),
    },
    resourceTrade3: {
      description: "resource trade-off decision",
      build: (id) => ({
        definition: {
          id,
          minElapsedSeconds: 0,
          weight: 2,
          options: [
            { id: "invest", resources: { material: -8, food: 12 } },
            { id: "stabilize", morale: 2 },
            { id: "reject" },
          ],
        },
        i18n: {
          en: {
            title: "",
            body: "",
            options: { invest: "", stabilize: "", reject: "" },
            results: { invest: "", stabilize: "", reject: "" },
          },
          cs: {
            title: "",
            body: "",
            options: { invest: "", stabilize: "", reject: "" },
            results: { invest: "", stabilize: "", reject: "" },
          },
        },
      }),
    },
  },
  objectives: {
    buildLevel1: {
      description: "build specific building to level 1",
      build: (id) => ({
        definition: {
          id,
          buildingId: "storage",
          requiredLevel: 1,
          reward: { material: 12 },
        },
        i18n: {
          en: { title: "", description: "", reward: "" },
          cs: { title: "", description: "", reward: "" },
        },
      }),
    },
    buildLevel2: {
      description: "upgrade building to level 2",
      build: (id) => ({
        definition: {
          id,
          buildingId: "workshop",
          requiredLevel: 2,
          reward: { material: 20, coal: 8 },
        },
        i18n: {
          en: { title: "", description: "", reward: "" },
          cs: { title: "", description: "", reward: "" },
        },
      }),
    },
  },
  sudden: {
    resourceLoss: {
      description: "resource percentage loss event",
      build: (id) => ({
        definition: {
          id,
          minElapsedSeconds: 0,
          weight: 2,
          resourceLossPercent: { food: 0.1 },
        },
        i18n: {
          en: { title: "", result: "" },
          cs: { title: "", result: "" },
        },
      }),
    },
    moraleShock: {
      description: "low impact sudden event",
      build: (id) => ({
        definition: {
          id,
          minElapsedSeconds: 0,
          weight: 1,
        },
        i18n: {
          en: { title: "", result: "" },
          cs: { title: "", result: "" },
        },
      }),
    },
  },
};

const state = {
  model: null,
  selectedKey: null,
  listQuery: "",
  listKindFilter: "all",
  listVisibleByKind: {
    decisions: LIST_PAGE_SIZE,
    objectives: LIST_PAGE_SIZE,
    sudden: LIST_PAGE_SIZE,
  },
};

const el = {
  questList: document.getElementById("questList"),
  emptyState: document.getElementById("emptyState"),
  editorPanel: document.getElementById("editorPanel"),
  questBadge: document.getElementById("questBadge"),
  questTitle: document.getElementById("questTitle"),
  definitionInput: document.getElementById("definitionInput"),
  enInput: document.getElementById("enInput"),
  csInput: document.getElementById("csInput"),
  applyBtn: document.getElementById("applyBtn"),
  saveAllBtn: document.getElementById("saveAllBtn"),
  reloadBtn: document.getElementById("reloadBtn"),
  addBtn: document.getElementById("addBtn"),
  status: document.getElementById("status"),
  syncOptionsBtn: document.getElementById("syncOptionsBtn"),
  duplicateBtn: document.getElementById("duplicateBtn"),
  renameBtn: document.getElementById("renameBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  copyEnToCsBtn: document.getElementById("copyEnToCsBtn"),
  localeCheckBtn: document.getElementById("localeCheckBtn"),
  gitStatusText: document.getElementById("gitStatusText"),
  refreshGitBtn: document.getElementById("refreshGitBtn"),
  commitMessageInput: document.getElementById("commitMessageInput"),
  commitPushBtn: document.getElementById("commitPushBtn"),
  questSearchInput: document.getElementById("questSearchInput"),
  questKindFilter: document.getElementById("questKindFilter"),
};

function setStatus(message) {
  el.status.textContent = message;
}

function setGitStatusText(message) {
  el.gitStatusText.textContent = message;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function kindLabel(kind) {
  if (kind === "decisions") return "Decision";
  if (kind === "objectives") return "Objective";
  return "Sudden";
}

function selectedKindAndId() {
  if (!state.selectedKey) {
    return null;
  }

  const [kind, id] = state.selectedKey.split(":");
  return { kind, id };
}

function selectedEntry() {
  const data = selectedKindAndId();
  if (!state.model || !data) {
    return null;
  }

  const collection = state.model.quests[data.kind] ?? [];
  return collection.find((entry) => entry.id === data.id) ?? null;
}

function resetListWindow() {
  state.listVisibleByKind.decisions = LIST_PAGE_SIZE;
  state.listVisibleByKind.objectives = LIST_PAGE_SIZE;
  state.listVisibleByKind.sudden = LIST_PAGE_SIZE;
}

function getEntrySearchText(entry) {
  const enTitle = entry?.i18n?.en?.title ?? "";
  const csTitle = entry?.i18n?.cs?.title ?? "";
  return `${entry.id} ${enTitle} ${csTitle}`.toLowerCase();
}

function getFilteredEntries(kind) {
  if (!state.model) {
    return [];
  }

  const base = [...(state.model.quests[kind] ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const query = state.listQuery.trim().toLowerCase();

  if (!query) {
    return base;
  }

  return base.filter((entry) => getEntrySearchText(entry).includes(query));
}

function renderQuestList() {
  if (!state.model) {
    return;
  }

  el.questList.innerHTML = "";
  const groups = ["decisions", "objectives", "sudden"];

  groups.forEach((kind) => {
    if (state.listKindFilter !== "all" && state.listKindFilter !== kind) {
      return;
    }

    const allEntries = getFilteredEntries(kind);
    const visibleLimit = state.listVisibleByKind[kind] ?? LIST_PAGE_SIZE;
    const visibleEntries = allEntries.slice(0, visibleLimit);

    const container = document.createElement("section");
    container.className = "quest-group";

    const header = document.createElement("div");
    header.className = "quest-group-header";
    header.innerHTML = `<span>${kindLabel(kind)}</span><span>${visibleEntries.length}/${allEntries.length}</span>`;
    container.appendChild(header);

    if (allEntries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "quest-empty";
      empty.textContent = "No matching quests.";
      container.appendChild(empty);
      el.questList.appendChild(container);
      return;
    }

    visibleEntries.forEach((entry) => {
      const key = `${kind}:${entry.id}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `quest-item${state.selectedKey === key ? " active" : ""}`;
      button.textContent = entry.id;
      button.onclick = () => {
        state.selectedKey = key;
        renderQuestList();
        renderEditor();
      };
      container.appendChild(button);
    });

    if (allEntries.length > visibleEntries.length) {
      const moreButton = document.createElement("button");
      moreButton.type = "button";
      moreButton.className = "quest-show-more";
      moreButton.textContent = `Show more (${allEntries.length - visibleEntries.length} remaining)`;
      moreButton.onclick = () => {
        state.listVisibleByKind[kind] = visibleLimit + LIST_PAGE_SIZE;
        renderQuestList();
      };
      container.appendChild(moreButton);
    }

    el.questList.appendChild(container);
  });
}

function parseJsonInput(input, label) {
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`${label}: ${(error && error.message) || "Invalid JSON"}`);
  }
}

function normalizeDecisionLocaleOptions(definition, locale) {
  const optionIds = (definition.options ?? []).map((option) => option.id).filter((id) => typeof id === "string");
  const nextOptions = {};
  const nextResults = {};

  for (const id of optionIds) {
    nextOptions[id] = locale.options?.[id] ?? "";
    nextResults[id] = locale.results?.[id] ?? "";
  }

  locale.options = nextOptions;
  locale.results = nextResults;
}

function applyCurrentEditor({ silent = false } = {}) {
  const entry = selectedEntry();
  if (!entry) {
    return;
  }

  const definition = parseJsonInput(el.definitionInput.value, "Definition JSON");
  const en = parseJsonInput(el.enInput.value, "English locale JSON");
  const cs = parseJsonInput(el.csInput.value, "Czech locale JSON");

  entry.definition = definition;
  entry.id = definition.id;
  entry.i18n.en = en;
  entry.i18n.cs = cs;

  if (entry.kind === "decision") {
    normalizeDecisionLocaleOptions(entry.definition, entry.i18n.en);
    normalizeDecisionLocaleOptions(entry.definition, entry.i18n.cs);
  }

  const { kind } = selectedKindAndId();
  state.selectedKey = `${kind}:${entry.id}`;

  renderQuestList();
  renderEditor();
  if (!silent) {
    setStatus(`Applied changes for ${entry.id}.`);
  }
}

function templateChoicesForKind(kind) {
  const templates = QUEST_TEMPLATES[kind] ?? {};
  return Object.entries(templates).map(([key, value]) => `${key} - ${value.description}`);
}

function createQuestFromTemplate(kind, id, templateKey) {
  const template = QUEST_TEMPLATES[kind]?.[templateKey];
  if (!template) {
    throw new Error(`Unknown template: ${templateKey}`);
  }

  const base = template.build(id);
  return {
    id,
    kind: kind === "decisions" ? "decision" : kind === "objectives" ? "objective" : "sudden",
    group:
      kind === "decisions"
        ? "community"
        : kind === "objectives"
          ? state.model.meta.objectiveGroups[0]
          : state.model.meta.suddenGroups[0],
    definition: base.definition,
    i18n: base.i18n,
  };
}

function addQuest() {
  if (!state.model) {
    return;
  }

  const kind = window.prompt("Kind (decisions/objectives/sudden):", "decisions");
  if (!kind || !["decisions", "objectives", "sudden"].includes(kind)) {
    return;
  }

  const id = window.prompt("New quest id (camelCase):");
  if (!id) {
    return;
  }

  const exists = state.model.quests[kind].some((entry) => entry.id === id);
  if (exists) {
    setStatus(`Quest ${id} already exists.`);
    return;
  }

  const choices = templateChoicesForKind(kind);
  const templatePrompt = [`Template key for ${kind}:`, ...choices].join("\n");
  const fallback = Object.keys(QUEST_TEMPLATES[kind])[0];
  const templateKey = window.prompt(templatePrompt, fallback);
  if (!templateKey || !QUEST_TEMPLATES[kind][templateKey]) {
    setStatus("Invalid template key.");
    return;
  }

  const entry = createQuestFromTemplate(kind, id, templateKey);

  if (kind === "decisions") {
    const group = window.prompt(
      `Decision group (${state.model.meta.decisionGroups.join(", ")}):`,
      entry.group,
    );

    if (!group || !state.model.meta.decisionGroups.includes(group)) {
      setStatus("Invalid decision group.");
      return;
    }

    entry.group = group;
  }

  state.model.quests[kind].push(entry);
  state.selectedKey = `${kind}:${id}`;
  renderQuestList();
  renderEditor();
  setStatus(`Created quest ${id} from template ${templateKey}.`);
}

function duplicateSelectedQuest() {
  const entry = selectedEntry();
  const info = selectedKindAndId();
  if (!entry || !info) {
    return;
  }

  const collection = state.model.quests[info.kind];
  const suggestedId = `${entry.id}Copy`;
  const newId = window.prompt("New id for duplicated quest:", suggestedId);
  if (!newId) {
    return;
  }

  if (collection.some((candidate) => candidate.id === newId)) {
    setStatus(`Quest ${newId} already exists.`);
    return;
  }

  const copy = deepClone(entry);
  copy.id = newId;
  copy.definition.id = newId;
  if (copy.i18n?.en?.title) copy.i18n.en.title = `${copy.i18n.en.title} (copy)`;
  if (copy.i18n?.cs?.title) copy.i18n.cs.title = `${copy.i18n.cs.title} (kopie)`;

  collection.push(copy);
  state.selectedKey = `${info.kind}:${newId}`;
  renderQuestList();
  renderEditor();
  setStatus(`Duplicated ${entry.id} -> ${newId}.`);
}

function renameSelectedQuest() {
  const entry = selectedEntry();
  const info = selectedKindAndId();
  if (!entry || !info) {
    return;
  }

  const collection = state.model.quests[info.kind];
  const newId = window.prompt("Rename quest id:", entry.id);
  if (!newId || newId === entry.id) {
    return;
  }

  if (collection.some((candidate) => candidate !== entry && candidate.id === newId)) {
    setStatus(`Quest ${newId} already exists.`);
    return;
  }

  entry.id = newId;
  entry.definition.id = newId;
  state.selectedKey = `${info.kind}:${newId}`;
  renderQuestList();
  renderEditor();
  setStatus(`Renamed quest to ${newId}.`);
}

function deleteSelectedQuest() {
  const entry = selectedEntry();
  const info = selectedKindAndId();
  if (!entry || !info) {
    return;
  }

  const confirmed = window.confirm(`Delete quest ${entry.id}? This cannot be undone.`);
  if (!confirmed) {
    return;
  }

  const collection = state.model.quests[info.kind];
  const index = collection.findIndex((candidate) => candidate.id === entry.id);
  if (index < 0) {
    return;
  }

  collection.splice(index, 1);

  const next = collection[index] ?? collection[index - 1] ?? null;
  state.selectedKey = next ? `${info.kind}:${next.id}` : null;
  renderQuestList();
  renderEditor();
  setStatus(`Deleted quest ${entry.id}.`);
}

function syncDecisionOptionKeys() {
  const entry = selectedEntry();
  if (!entry || !state.selectedKey?.startsWith("decisions:")) {
    return;
  }

  normalizeDecisionLocaleOptions(entry.definition, entry.i18n.en);
  normalizeDecisionLocaleOptions(entry.definition, entry.i18n.cs);
  renderEditor();
  setStatus("Decision option keys synced for EN/CS locales.");
}

function mergeMissingStringFields(source, target) {
  if (typeof source === "string") {
    return target === "" || target == null ? source : target;
  }

  if (Array.isArray(source)) {
    if (!Array.isArray(target)) {
      return source;
    }

    return source.map((item, index) => mergeMissingStringFields(item, target[index]));
  }

  if (source && typeof source === "object") {
    const out = { ...(target && typeof target === "object" ? target : {}) };

    for (const [key, value] of Object.entries(source)) {
      out[key] = mergeMissingStringFields(value, out[key]);
    }

    return out;
  }

  return target ?? source;
}

function copyEnToCsMissing() {
  const entry = selectedEntry();
  if (!entry) {
    return;
  }

  entry.i18n.cs = mergeMissingStringFields(entry.i18n.en, entry.i18n.cs);
  renderEditor();
  setStatus(`Filled missing CS locale fields from EN for ${entry.id}.`);
}

function collectLocaleIssues(enValue, csValue, path = "") {
  const issues = [];

  if (typeof enValue === "string") {
    if (csValue == null || csValue === "") {
      issues.push(`${path}: missing CS text`);
    } else if (csValue === enValue) {
      issues.push(`${path}: CS equals EN (needs translation)`);
    }
    return issues;
  }

  if (Array.isArray(enValue)) {
    enValue.forEach((item, index) => {
      issues.push(...collectLocaleIssues(item, Array.isArray(csValue) ? csValue[index] : undefined, `${path}[${index}]`));
    });
    return issues;
  }

  if (enValue && typeof enValue === "object") {
    for (const [key, value] of Object.entries(enValue)) {
      const nextPath = path ? `${path}.${key}` : key;
      issues.push(...collectLocaleIssues(value, csValue?.[key], nextPath));
    }
  }

  return issues;
}

function runLocaleCheck() {
  const entry = selectedEntry();
  if (!entry) {
    return;
  }

  const issues = collectLocaleIssues(entry.i18n.en, entry.i18n.cs);
  if (issues.length === 0) {
    setStatus(`Locale check OK for ${entry.id}.`);
    return;
  }

  const preview = issues.slice(0, 5).join(" | ");
  const suffix = issues.length > 5 ? ` | +${issues.length - 5} more` : "";
  setStatus(`Locale issues (${issues.length}): ${preview}${suffix}`);
}

function renderEditor() {
  const entry = selectedEntry();

  if (!entry) {
    el.emptyState.classList.remove("hidden");
    el.editorPanel.classList.add("hidden");
    return;
  }

  el.emptyState.classList.add("hidden");
  el.editorPanel.classList.remove("hidden");

  const info = selectedKindAndId();
  el.questBadge.textContent = `${kindLabel(info.kind)} / group: ${entry.group}`;
  el.questTitle.textContent = entry.id;
  el.definitionInput.value = JSON.stringify(entry.definition, null, 2);
  el.enInput.value = JSON.stringify(entry.i18n.en, null, 2);
  el.csInput.value = JSON.stringify(entry.i18n.cs, null, 2);

  el.syncOptionsBtn.classList.toggle("hidden", info.kind !== "decisions");
}

async function saveModelToDisk() {
  const response = await fetch("/api/quests/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(state.model),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Save failed");
  }
}

async function refreshGitStatus() {
  setGitStatusText("Refreshing git status...");
  const response = await fetch("/api/git/status");
  const payload = await response.json();

  if (!response.ok) {
    setGitStatusText(`Failed: ${payload.error || "Unknown error"}`);
    return;
  }

  const branch = payload.branch || "unknown";
  const dirtyCount = Number(payload.dirtyCount ?? 0);
  const aheadCount = Number(payload.aheadCount ?? 0);
  const dirtyText = dirtyCount > 0 ? `${dirtyCount} changed file(s)` : "clean";
  const aheadText = aheadCount > 0 ? `ahead by ${aheadCount}` : "up-to-date";
  setGitStatusText(`branch ${branch} | ${dirtyText} | ${aheadText}`);
}

async function commitAndPush() {
  const commitMessage = el.commitMessageInput.value.trim();
  if (!commitMessage) {
    setStatus("Commit message is required.");
    return;
  }

  try {
    applyCurrentEditor({ silent: true });
  } catch (error) {
    setStatus(error.message);
    return;
  }

  setStatus("Saving changes before push...");
  try {
    await saveModelToDisk();
  } catch (error) {
    setStatus(`Save failed: ${error.message}`);
    return;
  }

  setStatus("Committing and pushing...");
  const response = await fetch("/api/git/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ commitMessage }),
  });
  const payload = await response.json();

  if (!response.ok) {
    setStatus(`Git push failed: ${payload.error || "Unknown error"}`);
    await refreshGitStatus();
    return;
  }

  el.commitMessageInput.value = "";
  await loadModel();
  await refreshGitStatus();
  setStatus(`Push done on ${payload.branch} (${payload.head || "no head"}).`);
}

async function saveAll() {
  if (!state.model) {
    return;
  }

  try {
    applyCurrentEditor({ silent: true });
  } catch (error) {
    setStatus(error.message);
    return;
  }

  setStatus("Saving...");

  try {
    await saveModelToDisk();
  } catch (error) {
    setStatus(`Save failed: ${error.message}`);
    return;
  }

  setStatus("Saved. Refreshing from disk...");
  await loadModel();
  await refreshGitStatus();
  setStatus("Saved and reloaded successfully.");
}

async function loadModel() {
  setStatus("Loading quest data...");
  const response = await fetch("/api/quests");
  const payload = await response.json();

  if (!response.ok) {
    setStatus(`Load failed: ${payload.error || "Unknown error"}`);
    return;
  }

  state.model = payload;

  if (state.selectedKey) {
    const info = selectedKindAndId();
    const stillExists = payload.quests[info.kind]?.some((entry) => entry.id === info.id);
    if (!stillExists) {
      state.selectedKey = null;
    }
  }

  if (!state.selectedKey) {
    const first = payload.quests.decisions[0] || payload.quests.objectives[0] || payload.quests.sudden[0];
    if (first) {
      const kind = payload.quests.decisions.includes(first)
        ? "decisions"
        : payload.quests.objectives.includes(first)
          ? "objectives"
          : "sudden";
      state.selectedKey = `${kind}:${first.id}`;
    }
  }

  renderQuestList();
  renderEditor();
  setStatus("Quest data loaded.");
}

el.reloadBtn.addEventListener("click", () => {
  loadModel().then(() => refreshGitStatus()).catch((error) => setStatus(`Load failed: ${error.message}`));
});

el.addBtn.addEventListener("click", addQuest);

el.applyBtn.addEventListener("click", () => {
  try {
    applyCurrentEditor();
  } catch (error) {
    setStatus(error.message);
  }
});

el.saveAllBtn.addEventListener("click", () => {
  saveAll().catch((error) => setStatus(`Save failed: ${error.message}`));
});

el.refreshGitBtn.addEventListener("click", () => {
  refreshGitStatus().catch((error) => setGitStatusText(`Failed: ${error.message}`));
});

el.commitPushBtn.addEventListener("click", () => {
  commitAndPush().catch((error) => setStatus(`Git push failed: ${error.message}`));
});

el.syncOptionsBtn.addEventListener("click", () => {
  try {
    applyCurrentEditor({ silent: true });
    syncDecisionOptionKeys();
  } catch (error) {
    setStatus(error.message);
  }
});

el.duplicateBtn.addEventListener("click", () => {
  try {
    applyCurrentEditor({ silent: true });
    duplicateSelectedQuest();
  } catch (error) {
    setStatus(error.message);
  }
});

el.renameBtn.addEventListener("click", () => {
  try {
    applyCurrentEditor({ silent: true });
    renameSelectedQuest();
  } catch (error) {
    setStatus(error.message);
  }
});

el.deleteBtn.addEventListener("click", () => {
  try {
    applyCurrentEditor({ silent: true });
    deleteSelectedQuest();
  } catch (error) {
    setStatus(error.message);
  }
});

el.copyEnToCsBtn.addEventListener("click", () => {
  try {
    applyCurrentEditor({ silent: true });
    copyEnToCsMissing();
  } catch (error) {
    setStatus(error.message);
  }
});

el.localeCheckBtn.addEventListener("click", () => {
  try {
    applyCurrentEditor({ silent: true });
    runLocaleCheck();
  } catch (error) {
    setStatus(error.message);
  }
});

el.questSearchInput.addEventListener("input", () => {
  state.listQuery = el.questSearchInput.value ?? "";
  resetListWindow();
  renderQuestList();
});

el.questKindFilter.addEventListener("change", () => {
  state.listKindFilter = el.questKindFilter.value || "all";
  resetListWindow();
  renderQuestList();
});

loadModel()
  .then(() => refreshGitStatus())
  .catch((error) => setStatus(`Load failed: ${error.message}`));
