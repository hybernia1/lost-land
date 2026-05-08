import "./style.css";
import villageBackgroundUrl from "./assets/village-bg.webp";
import { Game } from "./game/Game";
import { App } from "./ui/App";

preloadImage(villageBackgroundUrl);

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

const game = new Game();
const app = new App(root, game);

app.mount();

function preloadImage(src: string): void {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = src;
  document.head.append(link);

  const image = new Image();
  image.decoding = "async";
  image.src = src;
}
