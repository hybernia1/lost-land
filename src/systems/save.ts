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

export type SaveSummary = SaveIndexEntry & {
  loadable: boolean;
  version: number | null;
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
    return null;
  }

  return loadSlot(targetSaveId);
}

export function listSavedGames(): SaveSummary[] {
  const index = readIndex();
  const indexById = new Map(index.map((entry) => [entry.id, entry]));
  const summaries = collectSaveIds()
    .map((saveId) => readSaveSummary(saveId, indexById.get(saveId)))
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
    .filter((summary) => summary.loadable)
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

function readSaveSummary(
  saveId: string,
  indexedSummary?: SaveIndexEntry,
): SaveSummary | null {
  const rawSave = localStorage.getItem(getSlotKey(saveId));

  if (!rawSave) {
    return null;
  }

  let parsedVersion: number | null = null;
  let parsedSavedAt: string | null = null;
  let parsedCommunityName: string | null = null;
  let parsedElapsedSeconds: number | null = null;

  try {
    const parsed = JSON.parse(rawSave) as Partial<SaveFile>;

    parsedVersion = typeof parsed.version === "number" ? parsed.version : null;
    parsedSavedAt = typeof parsed.savedAt === "string" ? parsed.savedAt : null;

    if (
      parsed.state &&
      typeof parsed.state === "object" &&
      "communityName" in parsed.state &&
      "elapsedSeconds" in parsed.state
    ) {
      const communityName = parsed.state.communityName;
      const elapsedSeconds = parsed.state.elapsedSeconds;
      parsedCommunityName = typeof communityName === "string" ? communityName : null;
      parsedElapsedSeconds = typeof elapsedSeconds === "number" ? elapsedSeconds : null;
    }
  } catch {
    // Keep summary from index when legacy/corrupted payload is not parseable.
  }

  const loadable = parsedVersion === SAVE_VERSION && loadSlot(saveId) !== null;

  return {
    id: saveId,
    communityName:
      parsedCommunityName ??
      indexedSummary?.communityName ??
      saveId,
    savedAt:
      parsedSavedAt ??
      indexedSummary?.savedAt ??
      new Date(0).toISOString(),
    elapsedSeconds:
      parsedElapsedSeconds ??
      indexedSummary?.elapsedSeconds ??
      0,
    loadable,
    version: parsedVersion,
  };
}
