import type { GameState } from "../game/types";

const SAVE_INDEX_KEY = "lost-land.saves";
const SAVE_SLOT_PREFIX = "lost-land.save.";
export const SAVE_VERSION = 37;

type SaveFile = {
  version: number;
  savedAt: string;
  state: GameState;
};

type SaveIndexEntry = {
  id: string;
  communityName: string;
  savedAt: string;
  elapsedSeconds: number;
};

export type SaveSummary = SaveIndexEntry;

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
    return null;
  }

  return loadSlot(targetSaveId);
}

export function listSavedGames(): SaveSummary[] {
  const summaries = collectSaveIds()
    .map(readSaveSummary)
    .filter((summary): summary is SaveSummary => summary !== null)
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));

  return summaries;
}

export function deleteSavedGame(saveId: string): void {
  localStorage.removeItem(getSlotKey(saveId));
  writeIndex(readIndex().filter((entry) => entry.id !== saveId));
}

function loadSlot(saveId: string): GameState | null {
  const rawSave = localStorage.getItem(getSlotKey(saveId));

  if (!rawSave) {
    return null;
  }

  return parseSave(rawSave);
}

function parseSave(rawSave: string): GameState | null {
  try {
    const saveFile = JSON.parse(rawSave) as SaveFile;

    if (saveFile.version !== SAVE_VERSION) {
      return null;
    }

    return saveFile.state;
  } catch {
    return null;
  }
}

function getLatestSaveId(): string | null {
  const latestLoadable = listSavedGames()
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0];

  return latestLoadable?.id ?? null;
}

function upsertSaveSummary(summary: SaveIndexEntry): void {
  const nextIndex = [
    summary,
    ...readIndex().filter((candidate) => candidate.id !== summary.id),
  ];

  writeIndex(nextIndex);
}

function readIndex(): SaveIndexEntry[] {
  const rawIndex = localStorage.getItem(SAVE_INDEX_KEY);

  if (!rawIndex) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawIndex) as SaveIndexEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(index: SaveIndexEntry[]): void {
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
}

function getSlotKey(saveId: string): string {
  return `${SAVE_SLOT_PREFIX}${saveId}`;
}

function collectSaveIds(): string[] {
  const ids = new Set(readIndex().map((entry) => entry.id));

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);

    if (!key?.startsWith(SAVE_SLOT_PREFIX)) {
      continue;
    }

    ids.add(key.slice(SAVE_SLOT_PREFIX.length));
  }

  return Array.from(ids);
}

function readSaveSummary(saveId: string): SaveSummary | null {
  const rawSave = localStorage.getItem(getSlotKey(saveId));

  if (!rawSave) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSave) as Partial<SaveFile>;

    if (
      parsed.version !== SAVE_VERSION ||
      typeof parsed.savedAt !== "string" ||
      !parsed.state ||
      typeof parsed.state !== "object" ||
      typeof parsed.state.communityName !== "string" ||
      typeof parsed.state.elapsedSeconds !== "number"
    ) {
      return null;
    }

    return {
      id: saveId,
      communityName: parsed.state.communityName,
      savedAt: parsed.savedAt,
      elapsedSeconds: parsed.state.elapsedSeconds,
    };
  } catch {
    return null;
  }
}
