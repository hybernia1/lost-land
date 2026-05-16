import "./style.css";
import { Game } from "./game/Game";
import { App } from "./ui/App";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

const game = new Game();
const app = new App(root, game);

app.mount();
