import { Container } from "pixi.js";
import { decisionQuestById } from "../../../data/decisions";
import { formatGameClock, GAME_HOUR_REAL_SECONDS, getGameDay } from "../../../game/time";
import type { DecisionHistoryEntry, GameState } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { canAffordDecisionOption } from "../../../systems/quests";
import { uiTextSize, uiTheme } from "../core/constants";
import type {
  ConquestResultPreview,
  DrawOverlayHeaderFn,
  DrawPanelFn,
  DrawTextFn,
  EffectLine,
  GameOverPreview,
  MeasureWrappedTextHeightFn,
  PixiActionDetail,
} from "../core/types";
import { getDecisionHistoryOption, getDecisionImpactLines } from "../helpers/decisionHelpers";
import { formatTemplate } from "../helpers/formatters";
import { createModalPanel, modalLayout, resolveModalFrame, resolveModalWidth, type ModalFrameOptions } from "./modalLayout";

type ResultModalsHost = {
  hudLayer: Container;
  drawModalBackdrop: (
    overlay: Container,
    width: number,
    height: number,
    closeAction?: PixiActionDetail,
    blockClose?: boolean,
  ) => void;
  measureWrappedTextHeight: MeasureWrappedTextHeightFn;
  drawPanel: DrawPanelFn;
  drawOverlayHeader: DrawOverlayHeaderFn;
  drawText: DrawTextFn;
  createModalButton: (
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    detail: PixiActionDetail,
    disabled?: boolean,
    tooltip?: string,
  ) => Container;
  drawDecisionImpactChips: (
    parent: Container,
    impacts: EffectLine[],
    rightX: number,
    y: number,
  ) => void;
};

type ResultModalShell = {
  panel: Container;
  panelWidth: number;
  panelHeight: number;
};

function createResultModalShell(
  host: ResultModalsHost,
  width: number,
  height: number,
  backdropAction: PixiActionDetail | undefined,
  blockClose: boolean,
  options: ModalFrameOptions,
): ResultModalShell {
  const overlay = new Container();
  host.hudLayer.addChild(overlay);
  host.drawModalBackdrop(overlay, width, height, backdropAction, blockClose);
  const frame = resolveModalFrame(width, height, {
    marginY: modalLayout.tightViewportMargin,
    topMin: modalLayout.resultTopMin,
    ...options,
  });
  const panel = createModalPanel(overlay, host.drawPanel, frame);
  return {
    panel,
    panelWidth: frame.width,
    panelHeight: frame.height,
  };
}

export function drawQuestDecisionModal(
  host: ResultModalsHost,
  state: GameState,
  translations: TranslationPack | undefined,
  width: number,
  height: number,
  resolvedDecisionPreview: DecisionHistoryEntry | null,
): void {
  const activeDecision = state.quests.activeDecision;

  if (!translations || (!activeDecision && !resolvedDecisionPreview)) {
    return;
  }

  const panelWidth = resolveModalWidth(width, { maxWidth: 560 });
  const panelInnerWidth = panelWidth - 56;
  let panelHeight = 348;

  if (activeDecision) {
    const definition = decisionQuestById[activeDecision.definitionId];
    const copy = translations.quests.decisions[definition.id];
    const bodyHeight = host.measureWrappedTextHeight(copy?.body ?? "", uiTextSize.bodyLarge, "700", panelInnerWidth);
    const consequencesHeight = host.measureWrappedTextHeight(
      translations.quests.ui.hiddenConsequences,
      12,
      "900",
      panelInnerWidth,
    );
    const optionCount = definition.options.length;
    const buttonsHeight = optionCount * 34 + Math.max(0, optionCount - 1) * 8;
    const firstButtonY = 86 + bodyHeight + 12 + consequencesHeight + 16;
    panelHeight = Math.ceil(firstButtonY + buttonsHeight + 24);
  } else if (resolvedDecisionPreview) {
    const resultDefinition = decisionQuestById[resolvedDecisionPreview.definitionId];
    const resultCopy = translations.quests.decisions[resultDefinition.id];
    const selectedOptionLabel = resultCopy?.options[resolvedDecisionPreview.optionId] ?? resolvedDecisionPreview.optionId;
    const decisionLine = `${translations.quests.ui.decision ?? "Decision"}: ${selectedOptionLabel}`;
    const decisionHeight = host.measureWrappedTextHeight(decisionLine, uiTextSize.body, "800", panelInnerWidth);
    const resultHeight = host.measureWrappedTextHeight(
      resultCopy?.results[resolvedDecisionPreview.optionId] ?? "",
      13,
      "800",
      panelInnerWidth,
    );
    panelHeight = Math.ceil(94 + decisionHeight + 10 + resultHeight + 46);
  }

  const shell = createResultModalShell(
    host,
    width,
    height,
    activeDecision ? undefined : { action: "close-decision-result" },
    Boolean(activeDecision),
    {
      maxWidth: 560,
      minHeight: 320,
      preferredHeight: panelHeight,
    },
  );
  const { panel } = shell;
  const resolvedPanelWidth = shell.panelWidth;
  const resolvedPanelHeight = shell.panelHeight;

  if (activeDecision) {
    const definition = decisionQuestById[activeDecision.definitionId];
    const copy = translations.quests.decisions[definition.id];
    const headerBottom = host.drawOverlayHeader(panel, resolvedPanelWidth, translations, {
      iconId: "people",
      kicker: translations.quests.ui.decisionRequired,
      title: copy?.title ?? definition.id,
    });
    const bodyLabel = host.drawText(panel, copy?.body ?? "", 28, headerBottom + 2, {
      fill: uiTheme.text,
      fontSize: uiTextSize.bodyLarge,
      fontWeight: "700",
      wordWrap: true,
      wordWrapWidth: resolvedPanelWidth - 56,
    });
    const consequencesY = bodyLabel.y + bodyLabel.height + 12;
    const consequencesLabel = host.drawText(panel, translations.quests.ui.hiddenConsequences, 28, consequencesY, {
      fill: uiTheme.warning,
      fontSize: uiTextSize.small,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: resolvedPanelWidth - 56,
    });

    const buttonWidth = resolvedPanelWidth - 56;
    const buttonBlockHeight = definition.options.length * 34 + Math.max(0, definition.options.length - 1) * 8;
    const buttonStartY = Math.min(
      consequencesLabel.y + consequencesLabel.height + 16,
      resolvedPanelHeight - buttonBlockHeight - 24,
    );
    definition.options.forEach((option, index) => {
      const affordable = canAffordDecisionOption(state, option);
      host.createModalButton(
        panel,
        copy?.options[option.id] ?? option.id,
        28,
        buttonStartY + index * 42,
        buttonWidth,
        34,
        {
          action: "resolve-quest-decision",
          questOption: option.id,
        },
        !affordable,
        affordable ? undefined : translations.quests.ui.notEnoughSupplies,
      );
    });
    return;
  }

  const resultEntry = resolvedDecisionPreview;
  if (!resultEntry) {
    return;
  }

  const resultDefinition = decisionQuestById[resultEntry.definitionId];
  const resultCopy = translations.quests.decisions[resultDefinition.id];
  const resultOption = getDecisionHistoryOption(resultEntry);
  const selectedOptionLabel = resultCopy?.options[resultEntry.optionId] ?? resultEntry.optionId;
  const resolvedDay = `${translations.ui.day ?? "Day"} ${getGameDay(resultEntry.resolvedAt)} ${formatGameClock(resultEntry.resolvedAt)}`;
  const headerBottom = host.drawOverlayHeader(panel, resolvedPanelWidth, translations, {
    iconId: "archive",
    kicker: translations.ui.decisionArchive ?? "Decision archive",
    title: resultCopy?.title ?? resultDefinition.id,
    subtitle: resolvedDay,
    closeAction: { action: "close-decision-result" },
  });
  const decisionLabel = host.drawText(panel, `${translations.quests.ui.decision ?? "Decision"}: ${selectedOptionLabel}`, 28, headerBottom + 2, {
    fill: uiTheme.text,
    fontSize: uiTextSize.body,
    fontWeight: "800",
    wordWrap: true,
    wordWrapWidth: resolvedPanelWidth - 56,
  });
  const resultY = decisionLabel.y + decisionLabel.height + 10;
  const resultLabel = host.drawText(panel, resultCopy?.results[resultEntry.optionId] ?? "", 28, resultY, {
    fill: uiTheme.accentStrong,
    fontSize: uiTextSize.body,
    fontWeight: "800",
    wordWrap: true,
    wordWrapWidth: resolvedPanelWidth - 56,
  });

  if (resultOption) {
    const chipsY = resultLabel.y + resultLabel.height + 16;
    if (chipsY <= resolvedPanelHeight - 28) {
      host.drawDecisionImpactChips(
        panel,
        getDecisionImpactLines(resultOption, translations).slice(0, 8),
        resolvedPanelWidth - 28,
        chipsY,
      );
    }
  }
}

export function drawConquestResultModal(
  host: ResultModalsHost,
  translations: TranslationPack | undefined,
  width: number,
  height: number,
  conquestResultPreview: ConquestResultPreview | null,
): void {
  if (!translations || !conquestResultPreview) {
    return;
  }

  const panelWidth = resolveModalWidth(width, { maxWidth: 520 });
  const resourceName = translations.resources[conquestResultPreview.resourceId];
  const resolvedDay = `${translations.ui.day ?? "Day"} ${getGameDay(conquestResultPreview.resolvedAt)} ${formatGameClock(conquestResultPreview.resolvedAt)}`;
  const isVictory = conquestResultPreview.outcome === "victory";
  const isOverrun = conquestResultPreview.outcome === "overrun";
  const summary = isVictory
    ? formatTemplate(
      translations.ui.conquestVictorySummary ?? "{resource} oasis secured.",
      { resource: resourceName },
    )
    : formatTemplate(
      translations.ui.conquestDefeatSummary ?? "{resource} oasis assault failed.",
      { resource: resourceName },
    );
  const sentLine = formatTemplate(
    translations.ui.conquestVictorySent ?? "Assault force: {count}",
    { count: conquestResultPreview.sentTroops },
  );
  const returnedLine = formatTemplate(
    translations.ui.conquestVictoryReturned ?? "Returned: {count}",
    { count: conquestResultPreview.returnedTroops },
  );
  const fallenLine = formatTemplate(
    translations.ui.conquestVictoryFallen ?? "Fallen: {count}",
    { count: conquestResultPreview.deaths },
  );
  const body = isVictory
    ? (conquestResultPreview.deaths > 0
      ? translations.ui.conquestVictoryBodyWithLosses ?? "The oasis is ours, but the fight cost lives."
      : translations.ui.conquestVictoryBodyNoLosses ?? "The team secured the oasis without losses.")
    : (isOverrun
      ? translations.ui.conquestDefeatBodyOverrun ?? "The assault force was too small against the oasis resistance."
      : translations.ui.conquestDefeatBodyFailed ?? "No one returned from the assault.");
  const summaryHeight = host.measureWrappedTextHeight(summary, uiTextSize.resultTitle, "900", panelWidth - 120);
  const bodyHeight = host.measureWrappedTextHeight(body, uiTextSize.body, "800", panelWidth - 56);
  const dayY = 38 + summaryHeight + 8;
  const bodyBaseY = dayY + 22;
  const sentBaseY = bodyBaseY + bodyHeight + 16;
  const returnedBaseY = sentBaseY + 32;
  const fallenBaseY = returnedBaseY + 32;
  const requirementBaseY = fallenBaseY + 32;
  let panelHeight = Math.ceil(
    (isOverrun && (conquestResultPreview.requiredTroops ?? 0) > 0 ? requirementBaseY : fallenBaseY) + 40,
  );
  const shell = createResultModalShell(
    host,
    width,
    height,
    { action: "close-conquest-result" },
    false,
    {
      maxWidth: 520,
      minHeight: 304,
      preferredHeight: panelHeight,
    },
  );
  const { panel } = shell;
  const resolvedPanelWidth = shell.panelWidth;

  const headerBottom = host.drawOverlayHeader(panel, resolvedPanelWidth, translations, {
    iconId: "shield",
    kicker: isVictory
      ? translations.ui.conquestVictoryTitle ?? "Oasis secured"
      : translations.ui.conquestDefeatTitle ?? "Oasis assault failed",
    title: summary,
    subtitle: resolvedDay,
    closeAction: { action: "close-conquest-result" },
  });
  const bodyY = Math.max(bodyBaseY, headerBottom + 2);
  const bodyLabel = host.drawText(panel, body, 28, bodyY, {
    fill: uiTheme.text,
    fontSize: uiTextSize.body,
    fontWeight: "800",
    wordWrap: true,
    wordWrapWidth: resolvedPanelWidth - 56,
  });
  const sentY = bodyLabel.y + bodyLabel.height + 16;
  const returnedY = sentY + 32;
  const fallenY = returnedY + 32;
  const requirementY = fallenY + 32;

  host.drawText(panel, sentLine, 28, sentY, {
    fill: uiTheme.text,
    fontSize: uiTextSize.bodyLarge,
    fontWeight: "900",
  });
  host.drawText(panel, returnedLine, 28, returnedY, {
    fill: conquestResultPreview.returnedTroops > 0 ? uiTheme.positive : uiTheme.textMuted,
    fontSize: uiTextSize.emphasis,
    fontWeight: "900",
  });
  host.drawText(panel, fallenLine, 28, fallenY, {
    fill: conquestResultPreview.deaths > 0 ? uiTheme.negative : uiTheme.textMuted,
    fontSize: uiTextSize.emphasis,
    fontWeight: "900",
  });

  if (isOverrun && (conquestResultPreview.requiredTroops ?? 0) > 0) {
    host.drawText(
      panel,
      formatTemplate(
        translations.ui.conquestDefeatRequirement ?? "Required minimum: {required}",
        { required: conquestResultPreview.requiredTroops ?? 0 },
      ),
      28,
      requirementY,
      {
        fill: uiTheme.warning,
        fontSize: uiTextSize.body,
        fontWeight: "900",
      },
    );
  }
}

export function drawGameOverModal(
  host: ResultModalsHost,
  translations: TranslationPack | undefined,
  width: number,
  height: number,
  gameOverPreview: GameOverPreview | null,
): void {
  if (!translations || !gameOverPreview) {
    return;
  }

  const panelWidth = resolveModalWidth(width, { maxWidth: 580 });
  const dayCount = getGameDay(gameOverPreview.endedAt);
  const totalGameHours = Math.max(0, Math.floor(gameOverPreview.endedAt / GAME_HOUR_REAL_SECONDS));
  const survivedDays = Math.floor(totalGameHours / 24);
  const survivedHours = totalGameHours % 24;
  const resolvedDay = `${translations.ui.day ?? "Day"} ${dayCount} / ${formatGameClock(gameOverPreview.endedAt)}`;
  const title = formatTemplate(
    translations.ui.gameOverTitle ?? "Community {community} has fallen.",
    { community: gameOverPreview.communityName },
  );
  const summary = formatTemplate(
    translations.ui.gameOverSummary ??
    "Community {community} resisted for {days} days and {hours} hours, then the last survivor fell.",
    {
      community: gameOverPreview.communityName,
      days: survivedDays,
      hours: survivedHours,
    },
  );
  const bodyHeight = host.measureWrappedTextHeight(summary, uiTextSize.bodyLarge, "800", panelWidth - 56);
  const shell = createResultModalShell(
    host,
    width,
    height,
    undefined,
    true,
    {
      maxWidth: 580,
      minHeight: 304,
      preferredHeight: Math.ceil(208 + bodyHeight),
    },
  );
  const { panel } = shell;
  const resolvedPanelWidth = shell.panelWidth;
  const resolvedPanelHeight = shell.panelHeight;

  const headerBottom = host.drawOverlayHeader(panel, resolvedPanelWidth, translations, {
    iconId: "death",
    kicker: translations.ui.gameOverKicker ?? "Camp lost",
    title,
    subtitle: resolvedDay,
  });
  const bodyLabel = host.drawText(panel, summary, 28, headerBottom + 8, {
    fill: uiTheme.text,
    fontSize: uiTextSize.bodyLarge,
    fontWeight: "800",
    wordWrap: true,
    wordWrapWidth: resolvedPanelWidth - 56,
  });

  host.createModalButton(
    panel,
    translations.ui.gameOverActionHome ?? (translations.ui.home ?? "Home"),
    28,
    Math.min(resolvedPanelHeight - 52, bodyLabel.y + bodyLabel.height + 20),
    resolvedPanelWidth - 56,
    34,
    { action: "home" },
  );
}
