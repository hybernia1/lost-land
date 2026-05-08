import { buildingDefinitions } from "../data/buildings";
import { resourceDefinitions } from "../data/resources";
import type { Game } from "../game/Game";
import { formatGameClock, getGameDay } from "../game/time";
import type { BuildingId, GameSpeed, GameState, ResourceBag } from "../game/types";
import { packs, loadLocale, saveLocale } from "../i18n";
import type { Locale, TranslationPack } from "../i18n/types";
import { PixiVillageRenderer } from "../render/PixiVillageRenderer";
import { PixiWorldRenderer } from "../render/PixiWorldRenderer";
import { getBuildingAssetDataUrl } from "../render/buildingAssets";
import {
  getAvailableBuildingsForPlot,
  getActiveBuildingQueue,
  getBuildingWorkerLimit,
  getConstructionWorkerRequirement,
  getDefenseScore,
  getGeneratorEnergyRate,
  getResourceProductionRates,
  getUpgradeCost,
  hasAvailableBuildingSlot,
  MAX_ACTIVE_BUILDINGS,
} from "../systems/buildings";
import { getExpeditionSupplyCost } from "../systems/expeditions";
import { getClinicFoodPerTreatment } from "../systems/health";
import { canAfford } from "../systems/resources";
import { hasSavedGame, listSavedGames } from "../systems/save";
import { icon } from "./icons";

type ScreenId = "village" | "world";
type AppMode = "menu" | "new-game" | "load-game" | "settings" | "game";

export class App {
  private worldRenderer: PixiWorldRenderer | null = null;
  private villageRenderer: PixiVillageRenderer | null = null;
  private state: GameState | null = null;
  private activeScreen: ScreenId = "village";
  private mode: AppMode = "menu";
  private locale: Locale = loadLocale();
  private shellReady = false;
  private villageModalPlotId: string | null = null;
  private villageDrawerOpen = false;
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
    window.addEventListener("resize", () => this.render());
    this.game.subscribe((state) => {
      this.state = state;
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
        <section class="menu-art" aria-hidden="true">
          <div class="menu-sun"></div>
          <div class="menu-wall"></div>
          <div class="menu-gate"></div>
          <div class="menu-road"></div>
        </section>
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

    if (!this.worldRenderer || !this.villageRenderer) {
      return;
    }

    if (this.activeScreen === "village") {
      this.villageRenderer.render(this.state, this.t(), this.villageModalPlotId);
    } else {
      this.worldRenderer.render(this.state, this.t());
    }

    this.updateShellMode();
  }

  private renderGameShell(): void {
    const t = this.t();

    this.root.innerHTML = `
      <div class="game-shell">
        <main class="game-layout">
          <section class="scene-panel">
            <div class="pixi-scene" data-role="village-scene"></div>
            <div class="pixi-scene" data-role="world-scene"></div>
          </section>
        </main>
        <div data-slot="village-modal"></div>
        <div class="floating-tooltip" data-slot="tooltip" role="tooltip"></div>
      </div>
    `;

    const worldScene = this.root.querySelector<HTMLElement>("[data-role='world-scene']");
    const villageScene = this.root.querySelector<HTMLElement>("[data-role='village-scene']");

    if (!worldScene || !villageScene) {
      throw new Error("Missing scene hosts.");
    }

    this.worldRenderer = new PixiWorldRenderer(worldScene, () => this.render());
    this.villageRenderer = new PixiVillageRenderer(villageScene, () => this.render());
    worldScene.addEventListener("click", (event) => this.handleCanvasClick(event));
    villageScene.addEventListener("click", (event) => this.handleCanvasClick(event));
    const handlePixiAction = (event: Event) => {
      this.handlePixiAction(event as CustomEvent<{
        action?: string;
        building?: BuildingId;
        plot?: string;
        delta?: number;
        sector?: string;
        speed?: GameSpeed;
        view?: ScreenId;
      }>);
    };
    const handlePixiTooltip = (event: Event) => {
      this.handlePixiTooltip(event as CustomEvent<{
        visible: boolean;
        text?: string;
        x?: number;
        y?: number;
      }>);
    };
    villageScene.addEventListener("pixi-action", handlePixiAction);
    worldScene.addEventListener("pixi-action", handlePixiAction);
    villageScene.addEventListener("pixi-tooltip", handlePixiTooltip);
    worldScene.addEventListener("pixi-tooltip", handlePixiTooltip);
    this.shellReady = true;
  }

  private updateShellMode(): void {
    const shell = this.root.querySelector<HTMLElement>(".game-shell");

    if (!shell) {
      return;
    }

    shell.classList.toggle("is-village", this.activeScreen === "village");
    shell.classList.toggle("is-world", this.activeScreen === "world");
    shell.classList.toggle("show-village-drawer", this.villageDrawerOpen);
  }

  private renderBrand(state: GameState): void {
    const title = this.root.querySelector<HTMLElement>("[data-slot='brand-title']");
    const subtitle = this.root.querySelector<HTMLElement>("[data-slot='brand-subtitle']");

    if (!title || !subtitle) {
      return;
    }

    const t = this.t();

    title.textContent =
      this.activeScreen === "village" ? state.communityName : t.ui.menuTitle;
    subtitle.textContent =
      this.activeScreen === "village"
        ? `${t.ui.day} ${getGameDay(state.elapsedSeconds)} / ${formatGameClock(state.elapsedSeconds)}`
        : t.ui.subtitle;
  }

  private renderResources(state: GameState): void {
    const slot = this.root.querySelector<HTMLElement>("[data-slot='resources']");

    if (!slot) {
      return;
    }

    const t = this.t();
    slot.innerHTML = resourceDefinitions
      .filter((resource) => resource.id !== "morale")
      .map((resource) => {
        const value = Math.floor(state.resources[resource.id]);
        const cap = Math.floor(state.capacities[resource.id]);
        return `
          <div class="resource-pill" ${this.tooltip(`${t.resources[resource.id]}: ${t.resourceDescriptions[resource.id]}`)}>
            ${icon(resource.id, t.resources[resource.id])}
            <span>${value}/${cap}</span>
          </div>
        `;
      })
      .join("");
  }

  private renderGlobalStatus(state: GameState): void {
    const slot = this.root.querySelector<HTMLElement>("[data-slot='globals']");

    if (!slot) {
      return;
    }

    const t = this.t();
    const day = getGameDay(state.elapsedSeconds);
    const time = formatGameClock(state.elapsedSeconds);
    const population = this.getPopulation(state);
    const defense = Math.round(getDefenseScore(state));
    const morale = Math.floor(state.resources.morale);

    slot.innerHTML = `
      <div class="global-pill" ${this.tooltip(t.ui.dayTooltip)}>
        ${icon("day", t.ui.day)}
        <span>${t.ui.day} ${day} / ${time}</span>
      </div>
      <div class="global-pill" ${this.tooltip(t.ui.populationTooltip)}>
        ${icon("people", t.ui.population)}
        <span>${population}</span>
      </div>
      <div class="global-pill" ${this.tooltip(t.ui.defenseTooltip)}>
        ${icon("shield", t.ui.defense)}
        <span>${defense}</span>
      </div>
      <div class="global-pill" ${this.tooltip(`${t.resources.morale}: ${t.resourceDescriptions.morale}`)}>
        ${icon("morale", t.resources.morale)}
        <span>${morale}%</span>
      </div>
    `;
  }

  private renderBuildingQueue(state: GameState): void {
    const slot = this.root.querySelector<HTMLElement>("[data-slot='building-queue']");

    if (!slot) {
      return;
    }

    const t = this.t();
    const queue = getActiveBuildingQueue(state);

    slot.innerHTML = `
      <div class="queue-header">
        <span>${t.ui.buildingQueue}</span>
        <strong>${queue.length}/${MAX_ACTIVE_BUILDINGS}</strong>
      </div>
      ${
        queue.length === 0
          ? `<p>${t.ui.queueEmpty}</p>`
          : queue
              .map((buildingId) => {
                const building = state.buildings[buildingId];
                const label = t.buildings[buildingId].name;
                return `
                  <div class="queue-row">
                    <span>${label}</span>
                    <strong>${building.constructionWorkers} ${t.roles.workers} / ${Math.ceil(building.upgradingRemaining)}s</strong>
                  </div>
                `;
              })
              .join("")
      }
    `;
  }

  private renderProduction(state: GameState): void {
    const slot = this.root.querySelector<HTMLElement>("[data-slot='production']");

    if (!slot) {
      return;
    }

    const t = this.t();
    const rates = getResourceProductionRates(state);
    slot.innerHTML = `
      <div class="production-header" ${this.tooltip(t.ui.productionTooltip)}>
        ${icon("build", t.ui.production)}
        <span>${t.ui.production}</span>
      </div>
      <table class="production-table">
        <thead>
          <tr>
            <th>${t.ui.resource}</th>
            <th>${t.ui.stock}</th>
            <th>${t.ui.perMinute}</th>
          </tr>
        </thead>
        <tbody>
          ${resourceDefinitions
            .map((resource) => {
              const perMinute = rates[resource.id] * 60;
              const direction =
                perMinute > 0.004 ? "positive" : perMinute < -0.004 ? "negative" : "neutral";
              const value = `${perMinute > 0 ? "+" : ""}${this.formatRate(perMinute)}`;
              const current = Math.floor(state.resources[resource.id]);
              const cap = Math.floor(state.capacities[resource.id]);
              const stock = resource.id === "morale" ? `${current}%` : `${current}/${cap}`;

              return `
                <tr>
                  <td ${this.tooltip(`${t.resources[resource.id]}: ${t.resourceDescriptions[resource.id]}`)}>
                    ${icon(resource.id, t.resources[resource.id])}
                    <span>${t.resources[resource.id]}</span>
                  </td>
                  <td>${stock}</td>
                  <td class="${direction}">${value}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  private renderFocus(state: GameState): void {
    const slot = this.root.querySelector<HTMLElement>("[data-slot='focus']");

    if (!slot) {
      return;
    }

    if (this.activeScreen === "village") {
      slot.innerHTML = "";
      slot.hidden = true;
      return;
    }

    slot.hidden = false;
    this.renderSectorFocus(slot, state);
  }

  private renderSectorFocus(slot: HTMLElement, state: GameState): void {
    const t = this.t();
    const sector = state.map.sectors.find(
      (candidate) => candidate.id === state.map.selectedSectorId,
    );

    if (!sector) {
      return;
    }

    if (!sector.revealed) {
      slot.innerHTML = `
        <h2>${t.ui.unknownSector}</h2>
        <p class="muted">${t.ui.unknownSectorText}</p>
      `;
      return;
    }

    const hasLoot = Object.keys(sector.loot).length > 0;
    const hasExpeditionTroops = state.survivors.troops >= 2;
    const supplyCost = getExpeditionSupplyCost(state, sector);
    const hasSupplies = canAfford(state.resources, supplyCost);
    const canSend = sector.kind !== "base" && hasLoot && hasExpeditionTroops && hasSupplies;

    slot.innerHTML = `
      <h2>${t.tiles[sector.kind]}</h2>
      <div class="sector-meta">
        <span>${sector.id}</span>
        <span>${t.ui.threat} ${Math.round(sector.threat)}%</span>
      </div>
      <div class="loot-list">${this.formatResourceBag(sector.loot) || `<span class="muted">${t.ui.noLoot}</span>`}</div>
      ${hasLoot && sector.kind !== "base" ? `
        <div class="expedition-cost">
          <span>${t.ui.expeditionSupplies}</span>
          <div class="cost-line">${this.formatResourceBag(supplyCost, state.resources)}</div>
        </div>
      ` : ""}
      ${hasLoot && !hasExpeditionTroops ? `<p class="modal-warning">${t.ui.needTroops}</p>` : ""}
      ${hasLoot && hasExpeditionTroops && !hasSupplies ? `<p class="modal-warning">${t.ui.needExpeditionSupplies}</p>` : ""}
      <button class="primary-action" data-action="expedition" data-sector="${sector.id}" ${canSend ? "" : "disabled"}>
        ${icon("scout")} ${t.ui.sendExpedition}
      </button>
    `;
  }

  private renderVillageModal(state: GameState): void {
    const slot = this.root.querySelector<HTMLElement>("[data-slot='village-modal']");

    if (!slot) {
      return;
    }

    slot.innerHTML = "";
    void state;
  }

  private renderBuildChoices(
    plotId: string,
    buildableBuildings: BuildingId[],
    state: GameState,
  ): string {
    const t = this.t();

    if (buildableBuildings.length === 0) {
      return `<p class="muted">${t.ui.alreadyBuilt}</p>`;
    }

    return `
      <div class="modal-grid">
        ${buildableBuildings
          .map((buildingId) => {
            const definition = buildingDefinitions.find(
              (candidate) => candidate.id === buildingId,
            );

            if (!definition) {
              return "";
            }

            const translated = t.buildings[buildingId];
            const cost = getUpgradeCost(buildingId, 0);
            const affordable = canAfford(state.resources, cost);
            const queueAvailable = hasAvailableBuildingSlot(state);
            const constructionWorkers = getConstructionWorkerRequirement(buildingId, 0);
            const workersAvailable = state.survivors.workers >= constructionWorkers;

            return `
              <article class="building-card build-card">
                <div class="building-card-preview" aria-hidden="true">
                  <img src="${getBuildingAssetDataUrl(buildingId, 1, true)}" alt="" />
                </div>
                <div>
                  <h3>${translated.name}</h3>
                  <p>${translated.description}</p>
                </div>
                ${this.renderNextLevelEffects(buildingId, 0)}
                <div class="cost-line">
                  ${this.formatResourceBag(cost, state.resources)}
                  ${this.formatWorkerRequirement(constructionWorkers, state.survivors.workers)}
                </div>
                <button data-action="build" data-building="${buildingId}" data-plot="${plotId}" ${affordable && queueAvailable && workersAvailable ? "" : "disabled"}>
                  ${!queueAvailable ? t.ui.queueFull : !workersAvailable ? t.ui.notEnoughWorkers : t.ui.buildHere}
                </button>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  private renderBuildingDetail(
    buildingId: BuildingId,
    level: number,
    upgradingRemaining: number,
    maxLevel: number,
    buildSeconds: number,
    state: GameState,
  ): string {
    const t = this.t();
    const translated = t.buildings[buildingId];
    const cost = getUpgradeCost(buildingId, level);
    const locked = level >= maxLevel;
    const upgrading = upgradingRemaining > 0;
    const affordable = canAfford(state.resources, cost);
    const queueAvailable = hasAvailableBuildingSlot(state);
    const constructionWorkers = getConstructionWorkerRequirement(buildingId, level);
    const workersAvailable = state.survivors.workers >= constructionWorkers;
    const disabled = locked || upgrading || !affordable || !queueAvailable || !workersAvailable;

    return `
      <article class="modal-building-detail">
        <div class="modal-building-head">
          <div class="building-card-preview large" aria-hidden="true">
            <img src="${getBuildingAssetDataUrl(buildingId, Math.max(1, level), level > 0)}" alt="" />
          </div>
          <div>
            <h3>${translated.name}</h3>
            <p>${translated.description}</p>
          </div>
        </div>
        <div class="village-stats">
          <div>${icon("build")} ${t.ui.level} <strong>${level}/${maxLevel}</strong></div>
          <div>${icon("shield")} ${t.ui.defense} <strong>${Math.round(getDefenseScore(state))}</strong></div>
        </div>
        ${this.renderWorkerControls(buildingId, state)}
        ${this.renderBarracksControls(buildingId, state)}
        ${this.renderNextLevelEffects(buildingId, level, maxLevel)}
        <div class="cost-line">
          ${this.formatResourceBag(cost, state.resources)}
          ${this.formatWorkerRequirement(constructionWorkers, state.survivors.workers)}
        </div>
        ${!queueAvailable && !upgrading ? `<p class="modal-warning">${t.ui.queueFull}</p>` : ""}
        ${!workersAvailable && !upgrading ? `<p class="modal-warning">${t.ui.notEnoughWorkers}</p>` : ""}
        ${upgrading ? `<p class="construction-countdown">${Math.ceil(upgradingRemaining)}s</p>` : ""}
        <button class="primary-action" data-action="upgrade" data-building="${buildingId}" ${disabled ? "disabled" : ""}>
          ${upgrading ? `${Math.ceil(upgradingRemaining)}s` : queueAvailable ? t.ui.upgrade : t.ui.queueFull}
        </button>
      </article>
    `;
  }

  private renderExpeditions(state: GameState): void {
    const slot = this.root.querySelector<HTMLElement>("[data-slot='expeditions']");

    if (!slot) {
      return;
    }

    const t = this.t();
    const buildingWorkers = this.getAssignedBuildingWorkers(state);
    const constructionWorkers = this.getConstructionWorkers(state);
    const expeditionTroops = this.getExpeditionSurvivors(state);
    const totalWorkers = state.survivors.workers + buildingWorkers + constructionWorkers;
    const totalTroops = state.survivors.troops + expeditionTroops;
    const totalPopulation = totalWorkers + totalTroops + state.health.injured;

    slot.innerHTML = `
      <h2>${t.ui.survivors}</h2>
      <div class="survivor-grid">
        <span>${t.ui.availableWorkers}</span><strong>${state.survivors.workers}</strong>
        <span>${t.ui.buildingWorkers}</span><strong>${buildingWorkers}</strong>
        <span>${t.ui.constructionCrew}</span><strong>${constructionWorkers}</strong>
        <span>${t.roles.injured}</span><strong>${state.health.injured}</strong>
        <span>${t.ui.availableTroops}</span><strong>${state.survivors.troops}</strong>
        <span>${t.ui.expeditionTroops}</span><strong>${expeditionTroops}</strong>
        <span class="survivor-total">${t.ui.totalPopulation}</span><strong class="survivor-total">${totalPopulation}</strong>
      </div>
      <h2>${t.ui.expeditions}</h2>
      ${
        state.expeditions.length === 0
          ? `<p class="muted">${t.ui.noExpedition}</p>`
          : state.expeditions
              .map((expedition) => `
                <div class="expedition-row">
                  <span>${expedition.targetSectorId}</span>
                  <strong>${Math.ceil(expedition.remainingSeconds)}s</strong>
                </div>
              `)
              .join("")
      }
    `;
  }

  private renderLog(state: GameState): void {
    const slot = this.root.querySelector<HTMLElement>("[data-slot='log']");

    if (!slot) {
      return;
    }

    slot.innerHTML = `
      <h2>${this.t().ui.log}</h2>
      <div class="event-log">
        ${state.log.map((message) => `<p>${this.localizeLogMessage(message)}</p>`).join("")}
      </div>
    `;
  }

  private syncControls(state: GameState): void {
    const t = this.t();
    const pauseButton = this.root.querySelector<HTMLButtonElement>("[data-action='pause']");
    const speedButtons = this.root.querySelectorAll<HTMLButtonElement>("[data-speed]");
    const viewButtons = this.root.querySelectorAll<HTMLButtonElement>("[data-view]");

    if (pauseButton) {
      pauseButton.innerHTML = state.paused ? icon("play") : icon("pause");
      const tooltipText = state.paused ? t.ui.resume : t.ui.pause;
      pauseButton.removeAttribute("title");
      pauseButton.dataset.tooltip = tooltipText;
      pauseButton.setAttribute("aria-label", tooltipText);
    }

    for (const button of speedButtons) {
      button.classList.toggle("active", Number(button.dataset.speed) === state.speed);
    }

    for (const button of viewButtons) {
      button.classList.toggle("active", button.dataset.view === this.activeScreen);
    }

  }

  private handleCanvasClick(event: MouseEvent): void {
    if (!this.state) {
      return;
    }

    if (Date.now() < this.suppressVillageClickUntil) {
      return;
    }

    if (this.activeScreen === "village" && this.villageRenderer) {
      const plotId = this.villageRenderer.hitTest(event.clientX, event.clientY);

      if (plotId) {
        this.game.selectVillagePlot(plotId);
        this.villageModalPlotId = plotId;
        this.render();
      }

      return;
    }

    if (!this.worldRenderer || this.activeScreen !== "world") {
      return;
    }

    const sector = this.worldRenderer.hitTest(event.clientX, event.clientY, this.state);

    if (sector) {
      this.game.selectSector(sector.id);
    }
  }

  private handlePixiAction(event: CustomEvent<{
    action?: string;
    building?: BuildingId;
    plot?: string;
    delta?: number;
    sector?: string;
    speed?: GameSpeed;
    view?: ScreenId;
  }>): void {
    this.suppressVillageClickUntil = Date.now() + 120;
    const { action, building, delta, plot, sector, speed, view } = event.detail;

    if (view) {
      this.activeScreen = view;
      this.villageModalPlotId = null;
      this.villageDrawerOpen = false;
      this.render();
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

    if (action === "save") {
      this.game.save();
      return;
    }

    if (action === "load") {
      this.game.load();
      return;
    }

    if (action === "reset") {
      this.game.reset();
      return;
    }

    if (action === "close-village-modal") {
      this.villageModalPlotId = null;
      this.render();
      return;
    }

    if (action === "open-selected-plot" && this.state) {
      this.villageModalPlotId = this.state.village.selectedPlotId;
      this.villageDrawerOpen = false;
      this.render();
      return;
    }

    if (action === "open-survivors") {
      this.villageModalPlotId = null;
      this.villageDrawerOpen = true;
      this.render();
      return;
    }

    if (action === "open-log") {
      this.villageModalPlotId = null;
      this.villageDrawerOpen = true;
      this.render();
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
      return;
    }

    if (action === "expedition" && sector) {
      this.game.sendExpedition(sector);
    }
  }

  private handlePixiTooltip(event: CustomEvent<{
    visible: boolean;
    text?: string;
    x?: number;
    y?: number;
  }>): void {
    if (!event.detail.visible || !event.detail.text) {
      this.hideTooltip();
      return;
    }

    this.tooltipTarget = null;
    this.showTooltip(event.detail.text, event.detail.x ?? 0, event.detail.y ?? 0);
  }

  private handleActionClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (target.classList.contains("modal-backdrop")) {
      this.villageModalPlotId = null;
      this.render();
      return;
    }

    const button = target.closest<HTMLButtonElement>("button");

    if (!button) {
      return;
    }

    if (button.dataset.locale) {
      this.locale = button.dataset.locale as Locale;
      saveLocale(this.locale);
      this.render();
      return;
    }

    const action = button.dataset.action;

    if (action === "close-village-modal") {
      this.villageModalPlotId = null;
      this.render();
      return;
    }

    if (action === "open-selected-plot" && this.state) {
      this.villageModalPlotId = this.state.village.selectedPlotId;
      this.villageDrawerOpen = false;
      this.render();
      return;
    }

    if (action === "open-survivors") {
      this.villageModalPlotId = null;
      this.villageDrawerOpen = true;
      this.render();
      this.root.querySelector("[data-slot='expeditions']")?.scrollIntoView({ block: "nearest" });
      return;
    }

    if (action === "open-log") {
      this.villageModalPlotId = null;
      this.villageDrawerOpen = true;
      this.render();
      this.root.querySelector("[data-slot='log']")?.scrollIntoView({ block: "nearest" });
      return;
    }

    if (button.dataset.view) {
      this.activeScreen = button.dataset.view as ScreenId;
      this.villageModalPlotId = null;
      this.villageDrawerOpen = false;
      this.render();
      return;
    }

    if (button.dataset.speed) {
      this.game.setSpeed(Number(button.dataset.speed) as GameSpeed);
      return;
    }

    if (action === "new-game") {
      this.mode = "new-game";
      this.render();
      return;
    }

    if (action === "continue") {
      this.mode = "load-game";
      this.render();
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
      this.render();
      return;
    }

    if (action === "back-menu") {
      this.mode = "menu";
      this.render();
      return;
    }

    if (action === "pause" && this.state) {
      this.game.setPaused(!this.state.paused);
    }

    if (action === "save") {
      this.game.save();
    }

    if (action === "load") {
      this.game.load();
    }

    if (action === "reset") {
      this.game.reset();
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

    if (action === "expedition" && button.dataset.sector) {
      this.game.sendExpedition(button.dataset.sector);
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
    this.activeScreen = "village";
    this.game.start();
    this.render();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private formatResourceBag(
    bag: ResourceBag,
    availableResources?: GameState["resources"],
  ): string {
    const t = this.t();

    return Object.entries(bag)
      .filter(([, amount]) => (amount ?? 0) > 0)
      .map(([resourceId, amount]) => {
        const typedResourceId = resourceId as keyof typeof t.resources;
        const required = Math.ceil(amount ?? 0);
        const available = availableResources?.[typedResourceId] ?? required;
        const missing = available < required;
        const tooltipText = `${t.resources[typedResourceId]}: ${t.resourceDescriptions[typedResourceId]} (${Math.floor(available)}/${required})`;

        return `
        <span class="mini-resource ${missing ? "missing" : ""}" ${this.tooltip(tooltipText)}>
          ${icon(resourceId, t.resources[typedResourceId])}
          ${required}
        </span>
      `;
      })
      .join("");
  }

  private formatWorkerRequirement(required: number, available: number): string {
    const t = this.t();
    const missing = available < required;
    const tooltipText = `${t.ui.constructionWorkers}: ${Math.floor(available)}/${required}`;

    return `
      <span class="mini-resource ${missing ? "missing" : ""}" ${this.tooltip(tooltipText)}>
        ${icon("people", t.roles.workers)}
        ${required}
      </span>
    `;
  }

  private formatRate(value: number): string {
    const absolute = Math.abs(value);

    if (absolute >= 10) {
      return value.toFixed(0);
    }

    return value.toFixed(1);
  }

  private renderNextLevelEffects(
    buildingId: BuildingId,
    currentLevel: number,
    maxLevel?: number,
  ): string {
    const t = this.t();
    const effects = this.getNextLevelEffects(buildingId, currentLevel);

    if (maxLevel !== undefined && currentLevel >= maxLevel) {
      return `<p class="muted">${t.ui.maxLevelReached}</p>`;
    }

    if (effects.length === 0) {
      return "";
    }

    return `
      <div class="building-effects">
        <span>${currentLevel === 0 ? t.ui.onBuild : t.ui.nextLevel}</span>
        ${effects
          .map(
            (effect) => `
              <strong class="${effect.negative ? "negative" : "positive"}">
                ${effect.label}
              </strong>
            `,
          )
          .join("")}
      </div>
    `;
  }

  private getNextLevelEffects(
    buildingId: BuildingId,
    currentLevel: number,
  ): Array<{ label: string; negative?: boolean }> {
    const t = this.t();
    const definition = buildingDefinitions.find((building) => building.id === buildingId);

    if (!definition || currentLevel >= definition.maxLevel) {
      return [];
    }

    const effects: Array<{ label: string; negative?: boolean }> = [];

    if (buildingId === "palisade") {
      effects.push({ label: `${t.ui.population} +1` });
    }

    if (buildingId === "clinic") {
      effects.push({
        label: `${t.ui.treatment} +1/min (${t.resources.food} -${getClinicFoodPerTreatment()})`,
      });
    }

    if (buildingId === "barracks") {
      effects.push({ label: t.ui.unlocksTroopTraining });
    }

    if (buildingId === "generator") {
      const currentLimit = currentLevel <= 0 ? 0 : Math.min(4, currentLevel + 1);
      const nextLimit = Math.min(4, currentLevel + 2);
      const currentMaxRate = getGeneratorEnergyRate(currentLevel, currentLimit) * 60;
      const nextMaxRate = getGeneratorEnergyRate(currentLevel + 1, nextLimit) * 60;

      if (nextLimit > currentLimit) {
        effects.push({ label: `${t.ui.workers} max +${nextLimit - currentLimit}` });
      }

      effects.push({
        label: `${t.resources.energy} max +${this.formatRate(nextMaxRate - currentMaxRate)}/min`,
      });
    }

    if (definition.defense) {
      effects.push({ label: `${t.ui.defense} +${definition.defense}` });
    }

    for (const [resourceId, amount] of Object.entries(definition.produces ?? {})) {
      const typedResourceId = resourceId as keyof typeof t.resources;
      effects.push({
        label: `${t.resources[typedResourceId]} +${this.formatRate((amount ?? 0) * 60)}/min`,
      });
    }

    for (const [resourceId, amount] of Object.entries(definition.consumes ?? {})) {
      const typedResourceId = resourceId as keyof typeof t.resources;
      effects.push({
        label: `${t.resources[typedResourceId]} -${this.formatRate((amount ?? 0) * 60)}/min`,
        negative: true,
      });
    }

    for (const [resourceId, amount] of Object.entries(definition.storageBonus ?? {})) {
      const typedResourceId = resourceId as keyof typeof t.resources;
      effects.push({
        label: `${t.resources[typedResourceId]} cap +${Math.round(amount ?? 0)}`,
      });
    }

    return effects;
  }

  private renderWorkerControls(buildingId: BuildingId, state: GameState): string {
    if (buildingId !== "generator") {
      return "";
    }

    const t = this.t();
    const building = state.buildings[buildingId];
    const workerLimit = getBuildingWorkerLimit(state, buildingId);
    const energyPerMinute = getGeneratorEnergyRate(building.level, building.workers) * 60;

    if (workerLimit <= 0) {
      return "";
    }

    return `
      <div class="worker-controls">
        <div>
          <span>${t.ui.workers}</span>
          <strong>${building.workers}/${workerLimit}</strong>
        </div>
        <div>
          <span>${t.resources.energy}</span>
          <strong>+${this.formatRate(energyPerMinute)}/min</strong>
        </div>
        <div class="worker-actions">
          <button class="icon-button" data-action="building-workers" data-building="${buildingId}" data-delta="-1" ${building.workers <= 0 ? "disabled" : ""}>-</button>
          <button class="icon-button" data-action="building-workers" data-building="${buildingId}" data-delta="1" ${building.workers >= workerLimit || state.survivors.workers <= 0 ? "disabled" : ""}>+</button>
        </div>
      </div>
    `;
  }

  private renderBarracksControls(buildingId: BuildingId, state: GameState): string {
    if (buildingId !== "barracks" || state.buildings.barracks.level <= 0) {
      return "";
    }

    const t = this.t();

    return `
      <div class="barracks-controls">
        <div>
          <span>${t.ui.availableWorkers}</span>
          <strong>${state.survivors.workers}</strong>
        </div>
        <div>
          <span>${t.ui.availableTroops}</span>
          <strong>${state.survivors.troops}</strong>
        </div>
        <div class="barracks-actions">
          <button data-action="barracks-worker-to-troop" ${state.survivors.workers <= 0 ? "disabled" : ""}>${t.ui.workerToTroop}</button>
          <button data-action="barracks-troop-to-worker" ${state.survivors.troops <= 0 ? "disabled" : ""}>${t.ui.troopToWorker}</button>
        </div>
      </div>
    `;
  }

  private localizeLogMessage(message: string): string {
    const t = this.t();

    if (message === "Day 1: the camp radio catches only static.") {
      return t.ui.logDayOne;
    }

    if (message === "A safe perimeter is marked around the old transit depot.") {
      return t.ui.logPerimeter;
    }

    if (message === "Game saved.") {
      return t.ui.logGameSaved;
    }

    if (message === "No compatible save found.") {
      return t.ui.logNoSave;
    }

    if (message === "Save loaded.") {
      return t.ui.logSaveLoaded;
    }

    if (message === "A survivor was injured during construction.") {
      return t.ui.logConstructionInjury;
    }

    if (message === "A survivor fell ill.") {
      return t.ui.logIllness;
    }

    if (message === "The clinic treated one survivor.") {
      return t.ui.logClinicTreated;
    }

    const joined = message.match(/^(\d+) survivors? joined the camp\.$/);

    if (joined) {
      if (joined[1] === "1") {
        return t.ui.logSurvivorJoined;
      }

      return t.ui.logSurvivorsJoined.replace("{count}", joined[1]);
    }

    const upgradeStarted = message.match(/^(.+) upgrade started\.$/);

    if (upgradeStarted) {
      const buildingName = this.localizeBuildingName(upgradeStarted[1]);
      return t.ui.logUpgradeStarted.replace("{building}", buildingName);
    }

    const reachedLevel = message.match(/^(.+) reached level (\d+)\.$/);

    if (reachedLevel) {
      const buildingName = this.localizeBuildingName(reachedLevel[1]);
      return t.ui.logReachedLevel
        .replace("{building}", buildingName)
        .replace("{level}", reachedLevel[2]);
    }

    const sent = message.match(/^Expedition sent to (.+)\.$/);

    if (sent) {
      return t.ui.logExpeditionSent.replace("{sector}", sent[1]);
    }

    const returned = message.match(/^Expedition returned from (.+) with supplies\.$/);

    if (returned) {
      return t.ui.logExpeditionReturned.replace("{sector}", returned[1]);
    }

    const troopLost = message.match(
      /^Expedition returned from (.+), but one troop was lost\.$/,
    );

    if (troopLost) {
      return t.ui.logExpeditionTroopLost.replace("{sector}", troopLost[1]);
    }

    return message;
  }

  private localizeBuildingName(englishName: string): string {
    const definition = buildingDefinitions.find(
      (building) => building.name === englishName,
    );

    if (!definition) {
      return englishName;
    }

    return this.t().buildings[definition.id].name;
  }

  private getPopulation(state: GameState): number {
    return (
      Object.values(state.survivors).reduce((total, count) => total + count, 0) +
      this.getAssignedBuildingWorkers(state) +
      this.getConstructionWorkers(state) +
      this.getExpeditionSurvivors(state) +
      state.health.injured
    );
  }

  private getAssignedBuildingWorkers(state: GameState): number {
    return Object.values(state.buildings).reduce(
      (total, building) => total + building.workers,
      0,
    );
  }

  private getExpeditionSurvivors(state: GameState): number {
    return state.expeditions.reduce(
      (total, expedition) => total + expedition.survivors,
      0,
    );
  }

  private getConstructionWorkers(state: GameState): number {
    return Object.values(state.buildings).reduce(
      (total, building) => total + building.constructionWorkers,
      0,
    );
  }

  private tooltip(text: string): string {
    const safeText = this.escapeAttribute(text);
    return `data-tooltip="${safeText}" aria-label="${safeText}"`;
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

  private escapeAttribute(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private t(): TranslationPack {
    return packs[this.locale];
  }
}
