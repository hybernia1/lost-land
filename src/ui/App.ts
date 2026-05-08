import type { Game } from "../game/Game";
import { formatGameClock, getGameDay } from "../game/time";
import type { BuildingId, GameSpeed, GameState } from "../game/types";
import { packs, loadLocale, saveLocale } from "../i18n";
import type { Locale, TranslationPack } from "../i18n/types";
import { PixiVillageRenderer } from "../render/PixiVillageRenderer";
import type { VillageInfoPanel } from "../render/PixiVillageRenderer";
import { hasSavedGame, listSavedGames } from "../systems/save";

type AppMode = "menu" | "new-game" | "load-game" | "settings" | "game";

export class App {
  private villageRenderer: PixiVillageRenderer | null = null;
  private state: GameState | null = null;
  private mode: AppMode = "menu";
  private locale: Locale = loadLocale();
  private shellReady = false;
  private villageModalPlotId: string | null = null;
  private villageInfoPanel: VillageInfoPanel | null = null;
  private renderQueued = false;
  private tooltipTarget: HTMLElement | null = null;
  private suppressVillageClickUntil = 0;

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
    this.root.addEventListener("keydown", (event) => this.handleKeyDown(event));
    window.addEventListener("resize", () => this.requestRender());
    this.game.subscribe((state) => {
      this.state = state;
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
    );

    this.updateShellMode();
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

    this.villageRenderer = new PixiVillageRenderer(villageScene, () => this.requestRender());
    villageScene.addEventListener("click", (event) => this.handleCanvasClick(event));
    const handlePixiAction = (event: Event) => {
      this.handlePixiAction(event as CustomEvent<{
        action?: string;
        building?: BuildingId;
        plot?: string;
        delta?: number;
        speed?: GameSpeed;
        continuousShifts?: boolean;
      }>);
    };
    villageScene.addEventListener("pixi-action", handlePixiAction);
    this.shellReady = true;
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

    if (Date.now() < this.suppressVillageClickUntil) {
      return;
    }

    if (this.villageRenderer) {
      const plotId = this.villageRenderer.hitTest(event.clientX, event.clientY);

      if (plotId) {
        this.game.selectVillagePlot(plotId);
        this.villageModalPlotId = plotId;
        this.villageInfoPanel = null;
        this.requestRender();
      }

      return;
    }
  }

  private handlePixiAction(event: CustomEvent<{
    action?: string;
    building?: BuildingId;
    plot?: string;
    delta?: number;
    speed?: GameSpeed;
    continuousShifts?: boolean;
  }>): void {
    this.suppressVillageClickUntil = Date.now() + 120;
    const { action, building, continuousShifts, delta, plot, speed } = event.detail;

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

    if (action === "open-morale-breakdown") {
      this.villageModalPlotId = null;
      this.villageInfoPanel = "morale";
      this.requestRender();
      return;
    }

    if (action === "set-continuous-shifts") {
      this.game.setContinuousShifts(continuousShifts ?? false);
      return;
    }

    if (action === "close-village-modal") {
      this.villageModalPlotId = null;
      this.villageInfoPanel = null;
      this.requestRender();
      return;
    }

    if (action === "open-selected-plot" && this.state) {
      this.villageModalPlotId = this.state.village.selectedPlotId;
      this.requestRender();
      return;
    }

    if (action === "build" && building && plot) {
      this.game.buildAtPlot(plot, building);
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

    if (action === "barracks-worker-to-troop") {
      this.game.convertWorkerToTroop();
      return;
    }

    if (action === "barracks-troop-to-worker") {
      this.game.convertTroopToWorker();
    }
  }

  private handleActionClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    const button = target.closest<HTMLButtonElement>("button");

    if (!button) {
      return;
    }

    if (button.dataset.locale) {
      this.locale = button.dataset.locale as Locale;
      saveLocale(this.locale);
      this.requestRender();
      return;
    }

    const action = button.dataset.action;

    if (action === "close-village-modal") {
      this.villageModalPlotId = null;
      this.villageInfoPanel = null;
      this.requestRender();
      return;
    }

    if (action === "open-selected-plot" && this.state) {
      this.villageModalPlotId = this.state.village.selectedPlotId;
      this.requestRender();
      return;
    }

    if (button.dataset.speed) {
      this.game.setSpeed(Number(button.dataset.speed) as GameSpeed);
      return;
    }

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

    if (action === "pause" && this.state) {
      this.game.setPaused(!this.state.paused);
    }

    if (action === "home") {
      this.returnHome();
    }

    if (action === "upgrade" && button.dataset.building) {
      this.game.upgradeBuilding(button.dataset.building as BuildingId);
    }

    if (action === "building-workers" && button.dataset.building && this.state) {
      const buildingId = button.dataset.building as BuildingId;
      const delta = Number(button.dataset.delta ?? 0);
      const currentWorkers = this.state.buildings[buildingId].workers;
      this.game.setBuildingWorkers(buildingId, currentWorkers + delta);
    }

    if (action === "barracks-worker-to-troop") {
      this.game.convertWorkerToTroop();
    }

    if (action === "barracks-troop-to-worker") {
      this.game.convertTroopToWorker();
    }

    if (action === "build" && button.dataset.building && button.dataset.plot) {
      this.game.buildAtPlot(
        button.dataset.plot,
        button.dataset.building as BuildingId,
      );
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
    this.game.start();
    this.requestRender();
  }

  private returnHome(): void {
    this.mode = "menu";
    this.villageModalPlotId = null;
    this.villageInfoPanel = null;
    this.game.stop();
    this.destroyVillageRenderer();
    this.shellReady = false;
    this.requestRender();
  }

  private destroyVillageRenderer(): void {
    this.villageRenderer?.destroy();
    this.villageRenderer = null;
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
}
