import { Assets, Container, Sprite, Texture } from "pixi.js";
import bluePanelBackgroundUrl from "../../../assets/ui/blue-panel-bg.png";

let bluePanelBackgroundTexture: Texture | null = null;
let bluePanelBackgroundLoadPromise: Promise<Texture> | null = null;

export async function loadBluePanelBackground(): Promise<void> {
  if (!bluePanelBackgroundLoadPromise) {
    bluePanelBackgroundLoadPromise = Assets.load<Texture>(bluePanelBackgroundUrl);
  }

  bluePanelBackgroundTexture = await bluePanelBackgroundLoadPromise;
}

export function drawBluePanelBackground(
  parent: Container,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1,
): Sprite {
  bluePanelBackgroundTexture ??= Texture.from(bluePanelBackgroundUrl);

  const sprite = new Sprite(bluePanelBackgroundTexture);
  sprite.x = x;
  sprite.y = y;
  sprite.width = width;
  sprite.height = height;
  sprite.alpha = alpha;
  parent.addChild(sprite);
  return sprite;
}
