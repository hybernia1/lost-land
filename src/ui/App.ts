import type { Game } from "../game/Game";
import { formatGameClock, getDaylightState, getGameDay } from "../game/time";
import type { BuildingId, DecisionHistoryEntry, GameSpeed, GameState } from "../game/types";
import { packs, loadLocale, saveLocale } from "../i18n";
import type { Locale, TranslationPack } from "../i18n/types";
import { PixiVillageRenderer } from "../render/PixiVillageRenderer";
import type { ConquestResultPreview, GameOverPreview, PixiActionDetail, VillageInfoPanel } from "../render/PixiVillageRenderer";
import { hasSavedGame, listSavedGames } from "../systems/save";
import { getPopulation } from "../systems/population";
import type { GodModeController } from "../dev/godMode";
import modalOpenSoundUrl from "../assets/audio/modal-open.ogg";
import modalCloseSoundUrl from "../assets/audio/modal-close.ogg";
import tabSwitchSoundUrl from "../assets/audio/tab-switch.ogg";
import uiClickSoundUrl from "../assets/audio/ui-click.ogg";
import questRewardClaimSoundUrl from "../assets/audio/quest-reward-claim.ogg";
import decisionQuestAlertSoundUrl from "../assets/audio/quest-decision-alert.wav";
import dayAmbientLoopSoundUrl from "../assets/audio/ambient-day-birds.ogg";
import nightAmbientLoopSoundUrl from "../assets/audio/ambient-night-crickets.mp3";

type AppMode = "menu" | "new-game" | "load-game" | "settings" | "game";

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
  private readonly decisionQuestAlertAudio = this.createUiAudio(decisionQuestAlertSoundUrl);
  private readonly dayAmbientLoopAudio = this.createLoopingAudio(dayAmbientLoopSoundUrl, 0.24);
  private readonly nightAmbientLoopAudio = this.createLoopingAudio(nightAmbientLoopSoundUrl, 0.28);
  private activeAmbientLoop: "day" | "night" | null = null;
  private godMode: GodModeController | null = null;

  constructor(
    private readonly root: HTMLDivElement,
    private readonly game: Game,
  ) {}

  mount(): void {
    this.root.addEventListener("click", (event) => this.handleActionClick(event));
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
    if (this.mode === "menu") {
      this.renderMenu();
      return;
    }

    if (this.mode === "new-game") {
      this.renderNewGame();
      return;
    }

    if (this.mode === "load-game") {
      this.renderLoadGame();
      return;
    }

    if (this.mode === "settings") {
      this.renderSettings();
      return;
    }

    this.renderGame();
  }

  private renderMenu(): void {
    const t = this.t();
    const canContinue = hasSavedGame();

    this.shellReady = false;
    this.root.innerHTML = `
      <main class="menu-screen">
        <section class="menu-art" aria-hidden="true"></section>
        <section class="menu-panel">
          <p class="menu-kicker">${t.ui.menuKicker}</p>
          <h1>${t.ui.menuTitle}</h1>
          <p>${t.ui.menuText}</p>
          <div class="menu-actions">
            <button class="menu-button primary" data-action="new-game">${t.ui.newGame}</button>
            <button class="menu-button" data-action="continue" ${canContinue ? "" : "disabled"}>${t.ui.continue}</button>
            <button class="menu-button" data-action="settings">${t.ui.settings}</button>
          </div>
        </section>
      </main>
    `;
  }

  private renderSettings(): void {
    const t = this.t();

    this.shellReady = false;
    this.root.innerHTML = `
      <main class="menu-screen settings-screen">
        <section class="settings-panel">
          <button class="text-button" data-action="back-menu">${t.ui.back}</button>
          <h1>${t.ui.settings}</h1>
          <p>${t.ui.languageText}</p>
          <div class="setting-row">
            <label>${t.ui.language}</label>
            <div class="language-options">
              ${Object.values(packs)
                .map((pack) => `
                  <button class="language-button ${pack.locale === this.locale ? "active" : ""}" data-locale="${pack.locale}">
                    ${pack.label}
                  </button>
                `)
                .join("")}
            </div>
          </div>
        </section>
      </main>
    `;
  }

  private renderNewGame(): void {
    const t = this.t();

    this.shellReady = false;
    this.root.innerHTML = `
      <main class="menu-screen settings-screen">
        <section class="settings-panel">
          <button class="text-button" data-action="back-menu">${t.ui.back}</button>
          <p class="menu-kicker">${t.ui.newGame}</p>
          <h1>${t.ui.nameCommunity}</h1>
          <p>${t.ui.nameCommunityText}</p>
          <div class="setting-row">
            <label for="community-name">${t.ui.communityName}</label>
            <input id="community-name" class="menu-input" data-role="community-name" maxlength="32" value="${this.escapeHtml(t.ui.defaultCommunityName)}" />
          </div>
          <div class="menu-actions compact">
            <button class="menu-button primary" data-action="start-new-community">${t.ui.startCommunity}</button>
          </div>
        </section>
      </main>
    `;

    this.root.querySelector<HTMLInputElement>("[data-role='community-name']")?.select();
  }

  private renderLoadGame(): void {
    const t = this.t();
    const saves = listSavedGames();

    this.shellReady = false;
    this.root.innerHTML = `
      <main class="menu-screen settings-screen">
        <section class="settings-panel save-select-panel">
          <button class="text-button" data-action="back-menu">${t.ui.back}</button>
          <p class="menu-kicker">${t.ui.continue}</p>
          <h1>${t.ui.savedCommunities}</h1>
          <div class="save-list">
            ${
              saves.length === 0
                ? `<p class="muted">${t.ui.noSavedCommunities}</p>`
                : saves
                    .map((save) => `
                      <button class="save-card" data-action="load-save" data-save-id="${save.id}">
                        <span>${this.escapeHtml(save.communityName)}</span>
                        <strong>${t.ui.day} ${getGameDay(save.elapsedSeconds)} / ${formatGameClock(save.elapsedSeconds)}</strong>
                      </button>
                    `)
                    .join("")
            }
          </div>
        </section>
      </main>
    `;
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
    if (!this.state) {
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

  private handleActionClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    const button = target.closest<HTMLButtonElement>("button");

    if (!button) {
      return;
    }

    this.playUiSound(this.uiClickAudio);

    if (button.dataset.locale) {
      this.locale = button.dataset.locale as Locale;
      saveLocale(this.locale);
      this.requestRender();
      return;
    }

    const action = button.dataset.action;

    if (action === "new-game") {
      this.mode = "new-game";
      this.requestRender();
      return;
    }

    if (action === "continue") {
      this.mode = "load-game";
      this.requestRender();
      return;
    }

    if (action === "start-new-community") {
      this.startNewCommunity();
      return;
    }

    if (action === "load-save" && button.dataset.saveId) {
      if (this.game.load(button.dataset.saveId)) {
        this.startGameSession();
      }
      return;
    }

    if (action === "settings") {
      this.mode = "settings";
      this.requestRender();
      return;
    }

    if (action === "back-menu") {
      this.mode = "menu";
      this.requestRender();
      return;
    }

    const gameAction = this.getDomGameAction(button, action);

    if (gameAction) {
      this.handleGameAction(gameAction);
    }
  }

  private getDomGameAction(
    button: HTMLButtonElement,
    action: string | undefined,
  ): PixiActionDetail | null {
    if (button.dataset.speed) {
      return { speed: Number(button.dataset.speed) as GameSpeed };
    }

    if (
      action === "close-village-modal" ||
      action === "open-selected-plot" ||
      action === "pause" ||
      action === "home" ||
      action === "barracks-worker-to-troop" ||
      action === "barracks-troop-to-worker"
    ) {
      return {
        action,
        troopCount: button.dataset.troopCount
          ? Number(button.dataset.troopCount)
          : undefined,
      };
    }

    if ((action === "upgrade" || action === "building-workers") && button.dataset.building) {
      return {
        action,
        building: button.dataset.building as BuildingId,
        delta: Number(button.dataset.delta ?? 0),
      };
    }

    if (action === "build" && button.dataset.building && button.dataset.plot) {
      return {
        action,
        building: button.dataset.building as BuildingId,
        plot: button.dataset.plot,
      };
    }

    return null;
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
    if (this.mode !== "new-game" || event.key !== "Enter") {
      return;
    }

    if (event.target instanceof HTMLInputElement) {
      event.preventDefault();
      this.startNewCommunity();
    }
  }

  private startNewCommunity(): void {
    const input = this.root.querySelector<HTMLInputElement>("[data-role='community-name']");
    const communityName = input?.value.trim() || this.t().ui.defaultCommunityName;

    this.game.newGame(communityName);
    this.startGameSession();
  }

  private startGameSession(): void {
    this.mode = "game";
    this.resolvedDecisionPreview = null;
    this.conquestResultPreview = null;
    this.gameOverPreview = null;
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
    this.villageModalPlotId = null;
    this.villageInfoPanel = null;
    this.resolvedDecisionPreview = null;
    this.conquestResultPreview = null;
    this.gameOverPreview = null;
    this.lastActiveDecisionId = null;
    this.godMode?.destroy();
    this.godMode = null;
    this.game.stop();
    this.destroyVillageRenderer();
    this.shellReady = false;
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
      this.gameOverPreview,
    );
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
    const targetLoop = phase === "night" || phase === "dawn" ? "night" : "day";

    if (this.activeAmbientLoop === targetLoop) {
      return;
    }

    const nextAudio =
      targetLoop === "day" ? this.dayAmbientLoopAudio : this.nightAmbientLoopAudio;
    const previousAudio =
      targetLoop === "day" ? this.nightAmbientLoopAudio : this.dayAmbientLoopAudio;

    if (previousAudio) {
      previousAudio.pause();
      previousAudio.currentTime = 0;
    }

    this.activeAmbientLoop = targetLoop;
    if (nextAudio) {
      nextAudio.currentTime = 0;
      void nextAudio.play().catch(() => undefined);
    }
  }

  private stopAmbientLoops(): void {
    if (this.dayAmbientLoopAudio) {
      this.dayAmbientLoopAudio.pause();
      this.dayAmbientLoopAudio.currentTime = 0;
    }

    if (this.nightAmbientLoopAudio) {
      this.nightAmbientLoopAudio.pause();
      this.nightAmbientLoopAudio.currentTime = 0;
    }

    this.activeAmbientLoop = null;
  }

  private playUiSound(audio: HTMLAudioElement | null): void {
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }

  private createUiAudio(source: string): HTMLAudioElement | null {
    if (typeof Audio === "undefined") {
      return null;
    }

    const audio = new Audio(source);
    audio.preload = "auto";
    audio.volume = 0.45;
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

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
}
