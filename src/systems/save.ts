import type { GameState } from "../game/types";

const LEGACY_SAVE_KEY = "lost-land.save";
const SAVE_INDEX_KEY = "lost-land.saves";
const SAVE_SLOT_PREFIX = "lost-land.save.";
const SAVE_VERSION = 12;

type SaveFile = {
  version: number;
  savedAt: string;
  state: GameState;
};

export type SaveSummary = {
  id: string;
  communityName: string;
  savedAt: string;
  elapsedSeconds: number;
};

export function saveGame(state: GameState): void {
  const savedAt = new Date().toISOString();
  const saveFile: SaveFile = {
    version: SAVE_VERSION,
    savedAt,
    state,
  };

  localStorage.setItem(getSlotKey(state.saveId), JSON.stringify(saveFile));
  upsertSaveSummary({
    id: state.saveId,
    communityName: state.communityName,
    savedAt,
    elapsedSeconds: state.elapsedSeconds,
  });
}

export function loadGame(saveId?: string): GameState | null {
  const targetSaveId = saveId ?? getLatestSaveId();

  if (!targetSaveId) {
    return loadLegacyGame();
  }

  return loadSlot(targetSaveId);
}

export function listSavedGames(): SaveSummary[] {
  const summaries = readIndex()
    .filter((summary) => loadSlot(summary.id) !== null)
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));

  const legacySave = loadLegacyGame();

  if (legacySave && summaries.every((summary) => summary.id !== legacySave.saveId)) {
    summaries.push({
      id: legacySave.saveId,
      communityName: legacySave.communityName,
      savedAt: legacySave.startedAt,
      elapsedSeconds: legacySave.elapsedSeconds,
    });
  }

  return summaries;
}

export function hasSavedGame(): boolean {
  return listSavedGames().length > 0;
}

export function clearSave(saveId: string): void {
  localStorage.removeItem(getSlotKey(saveId));
  writeIndex(readIndex().filter((summary) => summary.id !== saveId));
}

function loadSlot(saveId: string): GameState | null {
  const rawSave = localStorage.getItem(getSlotKey(saveId));

  if (!rawSave) {
    return null;
  }

  return parseSave(rawSave);
}

function loadLegacyGame(): GameState | null {
  const rawSave = localStorage.getItem(LEGACY_SAVE_KEY);

  if (!rawSave) {
    return null;
  }

  const state = parseSave(rawSave);

  if (state) {
    saveGame(state);
    localStorage.removeItem(LEGACY_SAVE_KEY);
  }

  return state;
}

function parseSave(rawSave: string): GameState | null {
  try {
    const saveFile = JSON.parse(rawSave) as SaveFile;

    if (saveFile.version !== SAVE_VERSION && saveFile.version !== 11) {
      return null;
    }

    saveFile.state.saveVersion = SAVE_VERSION;
    saveFile.state.communityName = saveFile.state.communityName?.trim() || "Lost Land";
    saveFile.state.saveId = saveFile.state.saveId?.trim() || createSaveId(saveFile.state.communityName);

    return saveFile.state;
  } catch {
    return null;
  }
}

function getLatestSaveId(): string | null {
  return readIndex().sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0]?.id ?? null;
}

function upsertSaveSummary(summary: SaveSummary): void {
  const nextIndex = [
    summary,
    ...readIndex().filter((candidate) => candidate.id !== summary.id),
  ];

  writeIndex(nextIndex);
}

function readIndex(): SaveSummary[] {
  const rawIndex = localStorage.getItem(SAVE_INDEX_KEY);

  if (!rawIndex) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawIndex) as SaveSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(index: SaveSummary[]): void {
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
}

function getSlotKey(saveId: string): string {
  return `${SAVE_SLOT_PREFIX}${saveId}`;
}

function createSaveId(communityName: string): string {
  const slug = communityName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `${slug || "community"}-${Date.now().toString(36)}`;
}
