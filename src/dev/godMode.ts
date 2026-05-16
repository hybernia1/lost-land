import type { Game } from "../game/Game";
import type { EnvironmentConditionId, GameState } from "../game/types";

export type GodModeController = {
  update: (state: GameState) => void;
  destroy: () => void;
};

let styleInstalled = false;

export function installGodMode(root: HTMLElement, game: Game): GodModeController {
  installStyle();

  const toggle = document.createElement("button");
  toggle.className = "god-mode-toggle";
  toggle.type = "button";
  toggle.textContent = "DEV";
  toggle.dataset.tooltip = "Development tools";

  const panel = document.createElement("aside");
  panel.className = "god-mode-panel";
  panel.setAttribute("aria-hidden", "true");

  const shell = root.querySelector<HTMLElement>(".game-shell") ?? root;
  shell.append(toggle, panel);

  let open = false;
  let state: GameState | null = null;

  const render = () => {
    if (!state) {
      return;
    }

    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    toggle.classList.toggle("active", open);

    const environment = state.environment;
    panel.innerHTML = `
      <h2>God Mode</h2>
      <p>Dev-only tools. Hidden from production builds.</p>
      <div class="god-mode-status">
        <span>${environment.condition}</span>
        <strong>Intensity ${environment.intensity}</strong>
      </div>
      <div class="god-mode-grid">
        <button data-dev-action="add-resources">+100 supplies</button>
        <button data-dev-action="add-workers">+5 workers</button>
        <button data-dev-action="finish-builds">Finish builds</button>
        <button data-dev-action="demo-battle">Demo battle</button>
        <button data-dev-action="homeless-snow">Homeless snow</button>
      </div>
      <div class="god-mode-section">
        <strong>Environment</strong>
        <div class="god-mode-grid compact">
          <button data-dev-action="set-environment" data-condition="stable">Stable</button>
          <button data-dev-action="set-environment" data-condition="rain" data-intensity="1">Rain 1</button>
          <button data-dev-action="set-environment" data-condition="rain" data-intensity="2">Rain 2</button>
          <button data-dev-action="set-environment" data-condition="snowFront" data-intensity="1">Snow 1</button>
          <button data-dev-action="set-environment" data-condition="snowFront" data-intensity="2">Snow 2</button>
        </div>
      </div>
    `;
  };

  const setOpen = (nextOpen: boolean) => {
    open = nextOpen;
    render();
  };

  const handleToggleClick = (event: MouseEvent) => {
    event.stopPropagation();
    setOpen(!open);
  };

  const handlePanelClick = (event: MouseEvent) => {
    event.stopPropagation();

    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-dev-action]");

    if (!button) {
      return;
    }

    const action = button.dataset.devAction;

    if (action === "add-resources") {
      game.devAddResources(100);
    } else if (action === "add-workers") {
      game.devAddWorkers(5);
    } else if (action === "finish-builds") {
      game.devFinishActiveBuilds();
    } else if (action === "demo-battle") {
      game.devStartDemoBattle();
    } else if (action === "set-environment" && button.dataset.condition) {
      game.devSetEnvironment(
        button.dataset.condition as EnvironmentConditionId,
        Number(button.dataset.intensity ?? 1),
      );
    } else if (action === "homeless-snow") {
      game.devAddWorkers(8);
      game.devSetEnvironment("snowFront", 2);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "F10" || (event.ctrlKey && event.key === "`")) {
      event.preventDefault();
      setOpen(!open);
    }
  };

  toggle.addEventListener("click", handleToggleClick);
  panel.addEventListener("click", handlePanelClick);
  window.addEventListener("keydown", handleKeyDown);

  return {
    update(nextState: GameState) {
      state = nextState;
      render();
    },
    destroy() {
      toggle.removeEventListener("click", handleToggleClick);
      panel.removeEventListener("click", handlePanelClick);
      window.removeEventListener("keydown", handleKeyDown);
      toggle.remove();
      panel.remove();
    },
  };
}

function installStyle(): void {
  if (styleInstalled) {
    return;
  }

  styleInstalled = true;
  const style = document.createElement("style");
  style.dataset.devStyle = "god-mode";
  style.textContent = `
    .god-mode-toggle {
      position: fixed;
      z-index: 40;
      right: 16px;
      bottom: 16px;
      min-width: 46px;
      min-height: 34px;
      border: 0;
      border-radius: 0;
      background: rgba(17, 21, 25, 0.88);
      color: #f1df9a;
      cursor: pointer;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0;
    }

    .god-mode-toggle.active,
    .god-mode-toggle:hover {
      background: #d1b25d;
      color: #151719;
    }

    .god-mode-panel {
      position: fixed;
      z-index: 39;
      right: 16px;
      bottom: 60px;
      display: none;
      width: min(320px, calc(100vw - 32px));
      border: 0;
      border-radius: 0;
      background: rgba(13, 17, 20, 0.96);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.42);
      padding: 14px;
    }

    .god-mode-panel.open {
      display: block;
    }

    .god-mode-panel h2 {
      margin: 0;
      color: #f6efdd;
      font-size: 16px;
    }

    .god-mode-panel p {
      margin: 6px 0 12px;
      color: #aeb4b8;
      font-size: 12px;
      line-height: 1.35;
    }

    .god-mode-status {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      border-radius: 0;
      background: rgba(255, 255, 255, 0.06);
      padding: 8px 10px;
      color: #f4eedf;
      font-size: 12px;
    }

    .god-mode-status span,
    .god-mode-status strong,
    .god-mode-section strong {
      overflow-wrap: anywhere;
    }

    .god-mode-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .god-mode-grid.compact {
      margin-top: 8px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .god-mode-grid button {
      min-height: 34px;
      border: 0;
      border-radius: 0;
      background: #2c3439;
      color: #f4eedf;
      cursor: pointer;
      padding: 0 8px;
      font-size: 12px;
      font-weight: 800;
    }

    .god-mode-grid button:hover {
      background: #d1b25d;
      color: #151719;
    }

    .god-mode-section {
      margin-top: 14px;
    }

    .god-mode-section strong {
      color: #f1df9a;
      font-size: 12px;
      text-transform: uppercase;
    }
  `;
  document.head.append(style);
}
