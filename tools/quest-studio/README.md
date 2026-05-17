# Quest Studio

Standalone local editor for Lost Land quest content.

## Run

From repository root:

```bash
npm run quest-studio
```

Then open:

- http://127.0.0.1:5180/

## What it edits

- quest definitions:
  - `src/data/decisionDefs/*.ts`
  - `src/data/questDefs/objectives/*.ts`
  - `src/data/questDefs/sudden/*.ts`
- per-quest locales:
  - `src/content/quests/**/i18n/en.ts`
  - `src/content/quests/**/i18n/cs.ts`
- generated i18n aggregators:
  - `src/i18n/quests/en.ts`
  - `src/i18n/quests/cs.ts`
- quest id unions:
  - `src/game/types.ts`

## Notes

- This is an MVP JSON-based editor.
- Quest list supports search (`id`, EN title, CS title), type filter, and paged listing with `Show more`.
- "Apply Changes" updates in-memory model from current textareas.
- "Save All" writes files and reloads from disk.
- For decision quests, "Sync Decision Option Keys" aligns locale option/result keys to current `definition.options` ids.
- Bulk editing for selected quest: duplicate, rename ID, delete.
- Locale helpers: copy missing CS fields from EN and quick locale issue check.
- Template library for `Add Quest` (prompt-based template key selection).
- "Commit + Push" saves current model, runs `git add -A`, commits with the provided message, and pushes to `origin/<current-branch>`.
