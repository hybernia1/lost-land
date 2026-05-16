import type { Game } from "../game/Game";
import { gameConfig } from "../game/config";
import { getDaylightState } from "../game/time";
import type { DecisionHistoryEntry, GameState } from "../game/types";
import { packs, loadLocale, saveLocale } from "../i18n";
import type { Locale, TranslationPack } from "../i18n/types";
import { PixiVillageRenderer } from "../render/PixiVillageRenderer";
import type {
  ConquestResultPreview,
  FrontScreenModel,
  FrontScreenSaveEntry,
  GameOverPreview,
  GameMenuView,
  PixiActionDetail,
  VillageInfoPanel,
} from "../render/PixiVillageRenderer";
import { deleteSavedGame, listSavedGames } from "../systems/save";
import { getPopulation } from "../systems/population";
import type { GodModeController } from "../dev/godMode";
import modalOpenSoundUrl from "../assets/audio/modal-open.ogg";
import modalCloseSoundUrl from "../assets/audio/modal-close.ogg";
import tabSwitchSoundUrl from "../assets/audio/tab-switch.ogg";
import uiClickSoundUrl from "../assets/audio/ui-click.ogg";
import questRewardClaimSoundUrl from "../assets/audio/quest-reward-claim.ogg";
import decisionQuestAlertSoundUrl from "../assets/audio/decision-heartbeat-alert.wav";
import dayAmbientLoopSoundUrl from "../assets/audio/ambient-day-birds.ogg";
import nightAmbientLoopSoundUrl from "../assets/audio/ambient-night-crickets.mp3";
import rainAmbientLoopSoundUrl from "../assets/audio/ambient-rain-loop.ogg";

type AppMode = "menu" | "new-game" | "load-game" | "settings" | "game";
type AmbientLoop = "day" | "night" | "rain";

const AMBIENT_LOOP_VOLUME: Record<AmbientLoop, number> = gameConfig.audio.ambientLoopVolume;
const AMBIENT_CROSSFADE_MS = gameConfig.audio.ambientCrossfadeMs;
const KEYBOARD_CAMERA_STEP = 112;
const KEYBOARD_CAMERA_FAST_STEP = 240;

export class App {
  private villageRenderer: PixiVillageRenderer | null = null;
  private state: GameState | null = null;
  private mode: AppMode = "menu";
  private locale: Locale = loadLocale();
  private shellReady = false;
  private villageModalPlotId: string | null = null;
  private villageInfoPanel: VillageInfoPanel | null = null;
  private resolvedDecisionPreview: DecisionHistoryEntry | null = null;
  private conquestResultPreview: ConquestResultPreview | null = null;
  private gameOverPreview: GameOverPreview | null = null;
  private gameMenuView: GameMenuView | null = null;
  private topLogSignature = "";
  private lastActiveDecisionId: string | null = null;
  private hasReceivedInitialState = false;
  private renderQueued = false;
  private tooltipTarget: HTMLElement | null = null;
  private suppressVillageClickUntil = 0;
  private readonly handleWindowKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
  private readonly modalOpenAudio = this.createUiAudio(modalOpenSoundUrl);
  private readonly modalCloseAudio = this.createUiAudio(modalCloseSoundUrl);
  private readonly tabSwitchAudio = this.createUiAudio(tabSwitchSoundUrl);
  private readonly uiClickAudio = this.createUiAudio(uiClickSoundUrl);
  private readonly questRewardClaimAudio = this.createUiAudio(questRewardClaimSoundUrl);
  private readonly decisionQuestAlertAudio = this.createUiAudio(
    decisionQuestAlertSoundUrl,
    gameConfig.audio.decisionAlertVolume,
  );
  private readonly dayAmbientLoopAudio = this.createLoopingAudio(dayAmbientLoopSoundUrl, AMBIENT_LOOP_VOLUME.day);
  private readonly nightAmbientLoopAudio = this.createLoopingAudio(nightAmbientLoopSoundUrl, AMBIENT_LOOP_VOLUME.night);
  private readonly rainAmbientLoopAudio = this.createLoopingAudio(rainAmbientLoopSoundUrl, AMBIENT_LOOP_VOLUME.rain);
  private activeAmbientLoop: AmbientLoop | null = null;
  private ambientCrossfadeFrameId: number | null = null;
  private ambientCrossfadeToken = 0;
  private godMode: GodModeController | null = null;
  private communityNameDraft = "";
  private pendingDeleteSaveId: string | null = null;

  constructor(
    private readonly root: HTMLDivElement,
    private readonly game: Game,
  ) {}

  mount(): void {
    this.root.addEventListener("mouseover", (event) => this.handleTooltipOver(event));
    this.root.addEventListener("mousemove", (event) => this.handleTooltipMove(event));
    this.root.addEventListener("mouseout", (event) => this.handleTooltipOut(event));
    this.root.addEventListener("focusin", (event) => this.handleTooltipFocus(event));
    this.root.addEventListener("focusout", () => this.hideTooltip());
    window.addEventListener("keydown", this.handleWindowKeyDown);
    window.addEventListener("resize", () => this.requestRender());
    this.game.subscribe((state) => {
      const wasModalOpen = this.isAnyModalOpen();
      const previousActiveDecisionId = this.lastActiveDecisionId;
      const previousSignature = this.topLogSignature;
      const nextSignature = this.getTopLogSignature(state);
      const nextActiveDecisionId = state.quests.activeDecision?.id ?? null;
      this.state = state;

      if (!this.hasReceivedInitialState) {
        this.hasReceivedInitialState = true;
        this.topLogSignature = nextSignature;
        this.lastActiveDecisionId = nextActiveDecisionId;
        this.updateAmbientLoop();
        this.requestRender();
        return;
      }

      const hasNewDecisionQuest =
        previousActiveDecisionId !== nextActiveDecisionId &&
        Boolean(nextActiveDecisionId);

      if (state.quests.activeDecision) {
        this.resolvedDecisionPreview = null;
      }
      this.maybeShowGameOverModal(state);
      this.maybeShowConquestResultModal(state, previousSignature, nextSignature);
      this.updateAmbientLoop();
      if (hasNewDecisionQuest) {
        this.playUiSound(this.decisionQuestAlertAudio);
      }
      this.playModalTransitionSound(wasModalOpen);
      this.topLogSignature = nextSignature;
      this.lastActiveDecisionId = nextActiveDecisionId;
      this.requestRender();
    });
  }

  private requestRender(): void {
    if (this.renderQueued) {
      return;
    }

    this.renderQueued = true;
    window.requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  private render(): void {
    if (this.mode !== "game") {
      this.renderFrontCanvas();
      return;
    }

    this.renderGame();
  }

  private renderFrontCanvas(): void {
    if (!this.shellReady) {
      this.renderGameShell();
    }

    if (!this.villageRenderer) {
      return;
    }

    if (!this.communityNameDraft.trim()) {
      this.communityNameDraft = this.t().ui.defaultCommunityName;
    }

    const saves = listSavedGames();
    const frontMode = this.mode === "game" ? "menu" : this.mode;
    const model: FrontScreenModel = {
      mode: frontMode,
      translations: this.t(),
      canContinue: saves.some((save) => save.loadable),
      communityNameDraft: this.communityNameDraft,
      locales: this.getLocaleOptions(),
      activeLocale: this.locale,
      saves: saves.map((save): FrontScreenSaveEntry => ({
        id: save.id,
        communityName: save.communityName,
        elapsedSeconds: save.elapsedSeconds,
        loadable: save.loadable,
        version: save.version,
      })),
      pendingDeleteSaveId: this.pendingDeleteSaveId,
    };

    this.villageRenderer.renderFrontScreen(model);
    this.updateShellMode();
  }

  private renderGame(): void {
    if (!this.state) {
      return;
    }

    if (!this.shellReady) {
      this.renderGameShell();
    }

    if (!this.villageRenderer) {
      return;
    }

    this.villageRenderer.render(
      this.state,
      this.t(),
      this.villageModalPlotId,
      this.villageInfoPanel,
      this.resolvedDecisionPreview,
      this.conquestResultPreview,
      this.gameOverPreview,
      this.gameMenuView
        ? {
          view: this.gameMenuView,
          locales: this.getLocaleOptions(),
          activeLocale: this.locale,
        }
        : null,
    );

    this.updateShellMode();
    this.godMode?.update(this.state);
  }

  private renderGameShell(): void {
    const t = this.t();

    this.root.innerHTML = `
      <div class="game-shell">
        <main class="game-layout">
          <section class="scene-panel">
            <div class="pixi-scene" data-role="village-scene"></div>
          </section>
        </main>
        <div class="floating-tooltip" data-slot="tooltip" role="tooltip"></div>
      </div>
    `;

    const villageScene = this.root.querySelector<HTMLElement>("[data-role='village-scene']");

    if (!villageScene) {
      throw new Error("Missing scene hosts.");
    }

    this.villageRenderer = new PixiVillageRenderer(
      villageScene,
      () => this.requestRender(),
      () => this.playUiSound(this.tabSwitchAudio),
    );
    villageScene.addEventListener("click", (event) => this.handleCanvasClick(event));
    const handlePixiAction = (event: Event) => {
      this.handlePixiAction(event as CustomEvent<PixiActionDetail>);
    };
    villageScene.addEventListener("pixi-action", handlePixiAction);
    this.shellReady = true;
    this.installGodMode();
  }

  private updateShellMode(): void {
    const shell = this.root.querySelector<HTMLElement>(".game-shell");

    if (!shell) {
      return;
    }

    shell.classList.add("is-village");
  }

  private handleCanvasClick(event: MouseEvent): void {
    if (this.mode !== "game" || !this.state) {
      return;
    }

    if (this.isAnyModalOpen()) {
      return;
    }

    if (Date.now() < this.suppressVillageClickUntil) {
      return;
    }

    if (this.villageRenderer) {
      const wasModalOpen = this.isAnyModalOpen();
      const plotId = this.villageRenderer.hitTest(event.clientX, event.clientY);

      if (plotId) {
        const isVillagePlot = this.state.village.plots.some((plot) => plot.id === plotId);
        if (isVillagePlot) {
          this.game.selectVillagePlot(plotId);
        }
        this.playUiSound(this.uiClickAudio);
        this.villageModalPlotId = plotId;
        this.villageInfoPanel = null;
        this.requestRender();
        this.playModalTransitionSound(wasModalOpen);
      }

      return;
    }
  }

  private handlePixiAction(event: CustomEvent<PixiActionDetail>): void {
    this.suppressVillageClickUntil = Date.now() + 400;
    if (event.detail.action && event.detail.action !== "consume-pointer") {
      this.playUiSound(this.uiClickAudio);
    }
    if (this.handleAppModeAction(event.detail.action, event.detail.value)) {
      return;
    }
    if (this.mode !== "game") {
      return;
    }
    this.handleGameAction(event.detail);
  }

  private handleGameAction(detail: PixiActionDetail): void {
    const wasModalOpen = this.isAnyModalOpen();
    const {
      action,
      building,
      continuousShifts,
      delta,
      marketAmount,
      marketFromResource,
      marketToResource,
      objectiveQuestId,
      plot,
      questOption,
      resourceId,
      resourceSiteId,
      resourceSiteTroops,
      speed,
      troopCount,
    } = detail;

    if (this.isTabSwitchAction(action)) {
      this.playUiSound(this.tabSwitchAudio);
    }

    if (this.gameOverPreview && action !== "home") {
      return;
    }

    if (action?.startsWith("game-menu-")) {
      this.handleGameMenuAction(action);
      return;
    }

    if (action === "consume-pointer") {
      return;
    }

    if (speed) {
      this.game.setSpeed(speed);
      return;
    }

    if (action === "pause" && this.state) {
      this.game.setPaused(!this.state.paused);
      return;
    }

    if (action === "home") {
      this.returnHome();
      return;
    }

    if (action === "open-resource-breakdown" && resourceId) {
      this.villageModalPlotId = null;
      this.villageInfoPanel = resourceId;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "open-survivor-overview") {
      this.villageModalPlotId = null;
      this.villageInfoPanel = "survivors";
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "open-decision-archive") {
      this.villageModalPlotId = null;
      this.villageInfoPanel = "decisionArchive";
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "open-objective-quest" && objectiveQuestId) {
      this.villageModalPlotId = null;
      this.villageInfoPanel = `objective:${objectiveQuestId}`;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "claim-objective-reward" && objectiveQuestId) {
      this.game.claimObjectiveReward(objectiveQuestId);
      this.playUiSound(this.questRewardClaimAudio);
      return;
    }

    if (action === "open-market" && this.state) {
      const marketPlotId = this.getMarketPlotId(this.state);
      if (!marketPlotId) {
        return;
      }

      this.villageModalPlotId = marketPlotId;
      this.villageInfoPanel = null;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "open-oasis-overview") {
      this.villageModalPlotId = null;
      this.villageInfoPanel = "oasisOverview";
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "open-quest-log") {
      this.villageModalPlotId = null;
      this.villageInfoPanel = "questLog";
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "open-resource-site-modal" && resourceSiteId && this.state) {
      const site = this.state.resourceSites.find((candidate) => candidate.id === resourceSiteId);
      if (!site) {
        return;
      }

      this.villageModalPlotId = site.id;
      this.villageInfoPanel = null;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "open-weather-overview") {
      this.villageModalPlotId = null;
      this.villageInfoPanel = "weather";
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "set-continuous-shifts") {
      this.game.setContinuousShifts(continuousShifts ?? false);
      return;
    }

    if (action === "resolve-quest-decision" && questOption && this.state) {
      const activeDecision = this.state.quests.activeDecision;
      this.game.resolveQuestDecision(questOption);
      const history = this.state.quests.decisionHistory;
      const latestHistory = history[history.length - 1];

      if (
        activeDecision &&
        latestHistory &&
        latestHistory.definitionId === activeDecision.definitionId &&
        latestHistory.optionId === questOption
      ) {
        this.resolvedDecisionPreview = latestHistory;
      }

      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "close-decision-result") {
      this.resolvedDecisionPreview = null;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "close-conquest-result") {
      this.conquestResultPreview = null;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "close-village-modal") {
      this.villageModalPlotId = null;
      this.villageInfoPanel = null;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "open-selected-plot" && this.state) {
      this.villageModalPlotId = this.state.village.selectedPlotId;
      this.villageInfoPanel = null;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return;
    }

    if (action === "open-village-plot" && plot && this.state) {
      const targetPlot = this.state.village.plots.find((candidate) => candidate.id === plot);
      if (!targetPlot || targetPlot.buildingId === null) {
        return;
      }

      this.villageModalPlotId = targetPlot.id;
      this.villageInfoPanel = null;
      this.requestRender();
      this.playUiSound(this.tabSwitchAudio);
      return;
    }

    if (action === "build" && building && plot) {
      if (this.game.buildAtPlot(plot, building)) {
        this.villageModalPlotId = null;
        this.villageInfoPanel = null;
        this.requestRender();
        this.playModalTransitionSound(wasModalOpen);
      }
      return;
    }

    if (action === "upgrade" && building) {
      this.game.upgradeBuilding(building);
      return;
    }

    if (action === "building-workers" && building && this.state) {
      const currentWorkers = this.state.buildings[building].workers;
      this.game.setBuildingWorkers(building, currentWorkers + (delta ?? 0));
      return;
    }

    if (action === "market-trade" && marketFromResource && marketToResource && marketAmount) {
      this.game.tradeAtMarket(marketFromResource, marketToResource, marketAmount);
      return;
    }

    if (action === "barracks-worker-to-troop") {
      this.repeatAction(troopCount, () => this.game.convertWorkerToTroop());
      return;
    }

    if (action === "barracks-troop-to-worker") {
      this.repeatAction(troopCount, () => this.game.convertTroopToWorker());
      return;
    }

    if (
      action === "resource-site-assault" &&
      resourceSiteId &&
      typeof resourceSiteTroops === "number" &&
      Number.isFinite(resourceSiteTroops)
    ) {
      this.game.startResourceSiteAssault(resourceSiteId, resourceSiteTroops);
      return;
    }

    if (action === "resource-site-workers" && resourceSiteId && this.state) {
      const site = this.state.resourceSites.find((candidate) => candidate.id === resourceSiteId);
      if (site) {
        this.game.setResourceSiteWorkers(resourceSiteId, site.assignedWorkers + (delta ?? 0));
      }
    }
  }

  private handleTooltipOver(event: MouseEvent): void {
    const target = this.findTooltipTarget(event.target);

    if (!target) {
      return;
    }

    this.tooltipTarget = target;
    this.showTooltip(target.dataset.tooltip ?? "", event.clientX, event.clientY);
  }

  private handleTooltipMove(event: MouseEvent): void {
    if (!this.tooltipTarget) {
      return;
    }

    this.positionTooltip(event.clientX, event.clientY);
  }

  private handleTooltipOut(event: MouseEvent): void {
    if (
      this.tooltipTarget &&
      event.relatedTarget instanceof Node &&
      this.tooltipTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    this.hideTooltip();
  }

  private handleTooltipFocus(event: FocusEvent): void {
    const target = this.findTooltipTarget(event.target);

    if (!target) {
      return;
    }

    const rect = target.getBoundingClientRect();
    this.tooltipTarget = target;
    this.showTooltip(target.dataset.tooltip ?? "", rect.left + rect.width / 2, rect.top);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.mode === "game") {
      this.handleGameKeyDown(event);
      return;
    }

    if (this.mode !== "new-game") {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      this.startNewCommunity();
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      this.communityNameDraft = this.communityNameDraft.slice(0, -1);
      this.requestRender();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.mode = "menu";
      this.requestRender();
      return;
    }
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (this.communityNameDraft.length >= 32) {
      return;
    }
    this.communityNameDraft += event.key;
    this.requestRender();
  }

  private handleGameKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.handleGameEscape();
      return;
    }

    const direction = this.getArrowKeyDirection(event.key);
    if (!direction) {
      return;
    }

    if (this.isBuildingDetailModalOpen()) {
      event.preventDefault();
      if (direction.x === 0) {
        return;
      }

      this.openAdjacentBuildingModal(direction.x < 0 ? -1 : 1);
      return;
    }

    if (this.isAnyModalOpen()) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const step = event.shiftKey ? KEYBOARD_CAMERA_FAST_STEP : KEYBOARD_CAMERA_STEP;
    this.villageRenderer?.panCameraByViewportDelta(direction.x * step, direction.y * step);
  }

  private getArrowKeyDirection(key: string): { x: number; y: number } | null {
    if (key === "ArrowLeft") {
      return { x: -1, y: 0 };
    }
    if (key === "ArrowRight") {
      return { x: 1, y: 0 };
    }
    if (key === "ArrowUp") {
      return { x: 0, y: -1 };
    }
    if (key === "ArrowDown") {
      return { x: 0, y: 1 };
    }
    return null;
  }

  private isBuildingDetailModalOpen(): boolean {
    if (!this.state || this.villageInfoPanel || !this.villageModalPlotId) {
      return false;
    }

    const plot = this.state.village.plots.find((candidate) => candidate.id === this.villageModalPlotId);
    return Boolean(plot?.buildingId);
  }

  private openAdjacentBuildingModal(direction: -1 | 1): void {
    if (!this.state || !this.villageModalPlotId) {
      return;
    }

    const occupiedPlots = this.state.village.plots.filter((plot) => plot.buildingId !== null);
    if (occupiedPlots.length <= 1) {
      return;
    }

    const currentIndex = occupiedPlots.findIndex((plot) => plot.id === this.villageModalPlotId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = (currentIndex + direction + occupiedPlots.length) % occupiedPlots.length;
    this.villageModalPlotId = occupiedPlots[nextIndex].id;
    this.villageInfoPanel = null;
    this.requestRender();
    this.playUiSound(this.tabSwitchAudio);
  }

  private handleGameEscape(): void {
    this.hideTooltip();

    if (this.closeTopClosableModalWithEsc()) {
      return;
    }

    if (this.isAnyModalOpen()) {
      return;
    }

    this.openGameMenu();
  }

  private closeTopClosableModalWithEsc(): boolean {
    const wasModalOpen = this.isAnyModalOpen();

    if (this.gameMenuView) {
      this.closeGameMenu();
      return true;
    }

    if (this.gameOverPreview || this.state?.quests.activeDecision) {
      return false;
    }

    if (this.conquestResultPreview) {
      this.conquestResultPreview = null;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return true;
    }

    if (this.resolvedDecisionPreview && !this.state?.quests.activeDecision) {
      this.resolvedDecisionPreview = null;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return true;
    }

    if (this.villageModalPlotId || this.villageInfoPanel) {
      this.villageModalPlotId = null;
      this.villageInfoPanel = null;
      this.requestRender();
      this.playModalTransitionSound(wasModalOpen);
      return true;
    }

    return false;
  }

  private openGameMenu(): void {
    if (!this.state) {
      return;
    }

    const wasModalOpen = this.isAnyModalOpen();
    this.gameMenuView = "main";
    this.requestRender();
    this.playModalTransitionSound(wasModalOpen);
  }

  private closeGameMenu(): void {
    if (!this.gameMenuView) {
      return;
    }

    const wasModalOpen = this.isAnyModalOpen();
    this.gameMenuView = null;
    this.requestRender();
    this.playModalTransitionSound(wasModalOpen);
  }

  private handleGameMenuAction(action: string): void {
    if (action === "game-menu-continue") {
      this.closeGameMenu();
      return;
    }

    if (action === "game-menu-settings") {
      this.gameMenuView = "settings";
      this.requestRender();
      this.playUiSound(this.tabSwitchAudio);
      return;
    }

    if (action === "game-menu-back") {
      this.gameMenuView = "main";
      this.requestRender();
      this.playUiSound(this.tabSwitchAudio);
      return;
    }

    if (action === "game-menu-quit") {
      this.returnHome();
    }
  }

  private startNewCommunity(): void {
    const communityName = this.communityNameDraft.trim() || this.t().ui.defaultCommunityName;

    this.game.newGame(communityName);
    this.communityNameDraft = communityName;
    this.pendingDeleteSaveId = null;
    this.startGameSession();
  }

  private startGameSession(): void {
    this.mode = "game";
    this.pendingDeleteSaveId = null;
    this.resolvedDecisionPreview = null;
    this.conquestResultPreview = null;
    this.gameOverPreview = null;
    this.gameMenuView = null;
    this.lastActiveDecisionId = this.state?.quests.activeDecision?.id ?? null;
    this.game.start();
    this.updateAmbientLoop();
    this.requestRender();
  }

  private repeatAction(count: number | undefined, action: () => void): void {
    const repetitions = Math.max(1, Math.floor(count ?? 1));

    for (let index = 0; index < repetitions; index += 1) {
      action();
    }
  }

  private returnHome(): void {
    const wasModalOpen = this.isAnyModalOpen();
    this.mode = "menu";
    this.pendingDeleteSaveId = null;
    this.villageModalPlotId = null;
    this.villageInfoPanel = null;
    this.resolvedDecisionPreview = null;
    this.conquestResultPreview = null;
    this.gameOverPreview = null;
    this.gameMenuView = null;
    this.lastActiveDecisionId = null;
    this.godMode?.destroy();
    this.godMode = null;
    this.game.stop();
    this.stopAmbientLoops();
    this.requestRender();
    this.playModalTransitionSound(wasModalOpen);
  }

  private destroyVillageRenderer(): void {
    this.villageRenderer?.destroy();
    this.villageRenderer = null;
  }

  private isAnyModalOpen(): boolean {
    return Boolean(
      this.villageModalPlotId ||
      this.villageInfoPanel ||
      this.resolvedDecisionPreview ||
      this.conquestResultPreview ||
      this.gameOverPreview ||
      this.gameMenuView ||
      this.state?.quests.activeDecision,
    );
  }

  private getLocaleOptions(): Array<{ id: string; label: string }> {
    return Object.values(packs).map((pack) => ({ id: pack.locale, label: pack.label }));
  }

  private playModalTransitionSound(previousOpen: boolean): void {
    const nextOpen = this.isAnyModalOpen();

    if (!previousOpen && nextOpen) {
      this.playUiSound(this.modalOpenAudio);
      return;
    }

    if (previousOpen && !nextOpen) {
      this.playUiSound(this.modalCloseAudio);
    }
  }

  private isTabSwitchAction(action: string | undefined): boolean {
    return (
      action === "open-resource-breakdown" ||
      action === "open-survivor-overview" ||
      action === "open-decision-archive" ||
      action === "open-weather-overview" ||
      action === "open-objective-quest" ||
      action === "open-market" ||
      action === "open-oasis-overview" ||
      action === "open-quest-log"
    );
  }

  private getMarketPlotId(state: GameState): string | null {
    return state.village.plots.find((plot) => plot.buildingId === "market")?.id ?? null;
  }

  private updateAmbientLoop(): void {
    if (this.mode !== "game" || !this.state) {
      this.stopAmbientLoops();
      return;
    }

    const phase = getDaylightState(this.state.elapsedSeconds).phase;
    const targetLoop = this.state.environment.condition === "rain"
      ? "rain"
      : phase === "night" || phase === "dawn"
        ? "night"
        : "day";

    this.transitionAmbientLoop(targetLoop);
  }

  private stopAmbientLoops(): void {
    this.cancelAmbientCrossfade();

    if (this.dayAmbientLoopAudio) {
      this.dayAmbientLoopAudio.pause();
      this.dayAmbientLoopAudio.currentTime = 0;
      this.dayAmbientLoopAudio.volume = AMBIENT_LOOP_VOLUME.day;
    }

    if (this.nightAmbientLoopAudio) {
      this.nightAmbientLoopAudio.pause();
      this.nightAmbientLoopAudio.currentTime = 0;
      this.nightAmbientLoopAudio.volume = AMBIENT_LOOP_VOLUME.night;
    }
    if (this.rainAmbientLoopAudio) {
      this.rainAmbientLoopAudio.pause();
      this.rainAmbientLoopAudio.currentTime = 0;
      this.rainAmbientLoopAudio.volume = AMBIENT_LOOP_VOLUME.rain;
    }

    this.activeAmbientLoop = null;
  }

  private transitionAmbientLoop(targetLoop: AmbientLoop): void {
    if (this.activeAmbientLoop === targetLoop) {
      return;
    }

    const nextAudio = this.getAmbientLoopAudio(targetLoop);

    if (!nextAudio) {
      this.stopAmbientLoops();
      return;
    }

    this.cancelAmbientCrossfade();
    const previousLoop = this.activeAmbientLoop;
    const previousAudio = previousLoop
      ? this.getAmbientLoopAudio(previousLoop)
      : null;

    this.activeAmbientLoop = targetLoop;

    if (!previousAudio || previousAudio === nextAudio) {
      nextAudio.volume = AMBIENT_LOOP_VOLUME[targetLoop];
      if (nextAudio.paused) {
        nextAudio.currentTime = 0;
        void nextAudio.play().catch(() => undefined);
      }
      return;
    }

    const keepLoops: AmbientLoop[] = [targetLoop];
    if (previousLoop) {
      keepLoops.push(previousLoop);
    }
    this.pauseAmbientLoopsExcept(keepLoops);
    const previousStartVolume = previousAudio.volume;
    nextAudio.volume = 0;
    nextAudio.currentTime = 0;
    void nextAudio.play().catch(() => undefined);

    const token = ++this.ambientCrossfadeToken;
    const startMs = performance.now();
    const step = (nowMs: number) => {
      if (token !== this.ambientCrossfadeToken) {
        return;
      }

      const progress = Math.min(1, Math.max(0, (nowMs - startMs) / AMBIENT_CROSSFADE_MS));
      const eased = progress * progress * (3 - 2 * progress);
      const nextVolume = AMBIENT_LOOP_VOLUME[targetLoop] * eased;
      const previousVolume = previousStartVolume * (1 - eased);
      nextAudio.volume = nextVolume;
      previousAudio.volume = previousVolume;

      if (progress >= 1) {
        previousAudio.pause();
        previousAudio.currentTime = 0;
        if (previousLoop) {
          previousAudio.volume = AMBIENT_LOOP_VOLUME[previousLoop];
        }
        nextAudio.volume = AMBIENT_LOOP_VOLUME[targetLoop];
        this.ambientCrossfadeFrameId = null;
        return;
      }

      this.ambientCrossfadeFrameId = window.requestAnimationFrame(step);
    };

    this.ambientCrossfadeFrameId = window.requestAnimationFrame(step);
  }

  private cancelAmbientCrossfade(): void {
    if (this.ambientCrossfadeFrameId !== null) {
      window.cancelAnimationFrame(this.ambientCrossfadeFrameId);
      this.ambientCrossfadeFrameId = null;
    }
    this.ambientCrossfadeToken += 1;
  }

  private pauseAmbientLoopsExcept(keep: AmbientLoop[]): void {
    const keepSet = new Set<AmbientLoop>(keep);
    const loops: AmbientLoop[] = ["day", "night", "rain"];

    for (const loop of loops) {
      if (keepSet.has(loop)) {
        continue;
      }

      const audio = this.getAmbientLoopAudio(loop);

      if (!audio) {
        continue;
      }

      audio.pause();
      audio.currentTime = 0;
      audio.volume = AMBIENT_LOOP_VOLUME[loop];
    }
  }

  private getAmbientLoopAudio(loop: AmbientLoop): HTMLAudioElement | null {
    if (loop === "day") {
      return this.dayAmbientLoopAudio;
    }

    if (loop === "night") {
      return this.nightAmbientLoopAudio;
    }

    return this.rainAmbientLoopAudio;
  }

  private playUiSound(audio: HTMLAudioElement | null): void {
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }

  private createUiAudio(source: string, volume: number = gameConfig.audio.uiVolume): HTMLAudioElement | null {
    if (typeof Audio === "undefined") {
      return null;
    }

    const audio = new Audio(source);
    audio.preload = "auto";
    audio.volume = volume;
    return audio;
  }

  private createLoopingAudio(
    source: string,
    volume: number,
  ): HTMLAudioElement | null {
    const audio = this.createUiAudio(source);

    if (!audio) {
      return null;
    }

    audio.loop = true;
    audio.volume = volume;
    return audio;
  }

  private findTooltipTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    return target.closest<HTMLElement>("[data-tooltip]");
  }

  private showTooltip(text: string, clientX: number, clientY: number): void {
    const tooltip = this.getTooltipElement();

    if (!tooltip || !text) {
      return;
    }

    tooltip.textContent = text;
    tooltip.classList.add("visible");
    this.positionTooltip(clientX, clientY);
  }

  private positionTooltip(clientX: number, clientY: number): void {
    const tooltip = this.getTooltipElement();

    if (!tooltip || !tooltip.classList.contains("visible")) {
      return;
    }

    const margin = 10;
    const offset = 14;
    const rect = tooltip.getBoundingClientRect();
    let left = clientX + offset;
    let top = clientY + offset;

    if (left + rect.width > window.innerWidth - margin) {
      left = clientX - rect.width - offset;
    }

    if (top + rect.height > window.innerHeight - margin) {
      top = clientY - rect.height - offset;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  private hideTooltip(): void {
    const tooltip = this.getTooltipElement();
    this.tooltipTarget = null;

    if (!tooltip) {
      return;
    }

    tooltip.classList.remove("visible");
  }

  private getTooltipElement(): HTMLElement | null {
    return this.root.querySelector<HTMLElement>("[data-slot='tooltip']");
  }

  private t(): TranslationPack {
    return packs[this.locale];
  }

  private getTopLogSignature(state: GameState): string {
    const topEntry = state.log[0];
    if (!topEntry) {
      return "";
    }

    return `${topEntry.key}:${JSON.stringify(topEntry.params ?? {})}`;
  }

  private maybeShowConquestResultModal(
    state: GameState,
    previousSignature: string,
    nextSignature: string,
  ): void {
    if (this.mode !== "game" || previousSignature === nextSignature) {
      return;
    }

    const topEntry = state.log[0];
    if (!topEntry) {
      return;
    }

    const resourceId = this.toResourceSiteResourceId(topEntry.params?.resourceId);
    if (!resourceId) {
      return;
    }

    if (topEntry.key === "logResourceSiteCaptured") {
      const returnedTroops = this.toNonNegativeInt(topEntry.params?.count);
      const deaths = this.toNonNegativeInt(topEntry.params?.deaths);
      this.conquestResultPreview = {
        outcome: "victory",
        resourceId,
        returnedTroops,
        deaths,
        sentTroops: returnedTroops + deaths,
        resolvedAt: state.elapsedSeconds,
      };
      return;
    }

    if (topEntry.key === "logResourceSiteAssaultFailed") {
      const deaths = this.toNonNegativeInt(topEntry.params?.deaths);
      this.conquestResultPreview = {
        outcome: "failed",
        resourceId,
        returnedTroops: 0,
        deaths,
        sentTroops: deaths,
        resolvedAt: state.elapsedSeconds,
      };
      return;
    }

    if (topEntry.key === "logResourceSiteAssaultOverrun") {
      const sentTroops = this.toNonNegativeInt(topEntry.params?.sent);
      this.conquestResultPreview = {
        outcome: "overrun",
        resourceId,
        returnedTroops: 0,
        deaths: sentTroops,
        sentTroops,
        requiredTroops: this.toNonNegativeInt(topEntry.params?.required),
        resolvedAt: state.elapsedSeconds,
      };
      return;
    }
  }

  private maybeShowGameOverModal(state: GameState): void {
    if (this.mode !== "game" || this.gameOverPreview || getPopulation(state) > 0) {
      return;
    }

    this.villageModalPlotId = null;
    this.villageInfoPanel = null;
    this.resolvedDecisionPreview = null;
    this.conquestResultPreview = null;
    this.gameOverPreview = {
      communityName: state.communityName,
      endedAt: state.elapsedSeconds,
    };

    if (!state.paused) {
      this.game.setPaused(true);
    }
  }

  private toNonNegativeInt(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.floor(value));
  }

  private toResourceSiteResourceId(
    value: unknown,
  ): ConquestResultPreview["resourceId"] | null {
    if (value === "food" || value === "water" || value === "material" || value === "coal") {
      return value;
    }

    return null;
  }

  private installGodMode(): void {
    if (!import.meta.env.DEV || this.godMode) {
      return;
    }

    void import("../dev/godMode").then(({ installGodMode }) => {
      if (!this.shellReady || this.godMode) {
        return;
      }

      this.godMode = installGodMode(this.root, this.game);
      if (this.state) {
        this.godMode.update(this.state);
      }
    });
  }

  private handleAppModeAction(action: string | undefined, value?: string): boolean {
    if (!action) {
      return false;
    }

    if (action !== "delete-save" && action !== "confirm-delete-save" && action !== "cancel-delete-save") {
      this.pendingDeleteSaveId = null;
    }

    if (action === "new-game") {
      this.mode = "new-game";
      if (!this.communityNameDraft.trim()) {
        this.communityNameDraft = this.t().ui.defaultCommunityName;
      }
      this.requestRender();
      return true;
    }

    if (action === "continue") {
      this.mode = "load-game";
      this.requestRender();
      return true;
    }

    if (action === "settings") {
      this.mode = "settings";
      this.requestRender();
      return true;
    }

    if (action === "back-menu") {
      this.mode = "menu";
      this.requestRender();
      return true;
    }

    if (action === "select-locale" && value) {
      this.locale = value as Locale;
      saveLocale(this.locale);
      this.requestRender();
      return true;
    }

    if (action === "community-name-backspace") {
      this.communityNameDraft = this.communityNameDraft.slice(0, -1);
      this.requestRender();
      return true;
    }

    if (action === "community-name-clear") {
      this.communityNameDraft = "";
      this.requestRender();
      return true;
    }

    if (action === "start-new-community") {
      this.startNewCommunity();
      return true;
    }

    if (action === "load-save" && value) {
      const selectedSave = listSavedGames().find((save) => save.id === value);
      if (!selectedSave?.loadable) {
        return true;
      }
      if (this.game.load(value)) {
        this.startGameSession();
      }
      return true;
    }

    if (action === "delete-save" && value) {
      this.pendingDeleteSaveId = value;
      this.requestRender();
      return true;
    }

    if (action === "cancel-delete-save") {
      this.pendingDeleteSaveId = null;
      this.requestRender();
      return true;
    }

    if (action === "confirm-delete-save" && value) {
      deleteSavedGame(value);
      this.pendingDeleteSaveId = null;
      this.requestRender();
      return true;
    }

    return false;
  }
}
