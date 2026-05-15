import { Container, Graphics } from "pixi.js";
import iconsSvgRaw from "../assets/icons.svg?raw";

let iconsDocument: Document | null = null;
const iconSvgCache = new Map<string, string>();

export function drawPixiIcon(
  parent: Container,
  iconId: string,
  x: number,
  y: number,
  size: number,
): Container {
  const icon = new Container();
  const graphic = new Graphics();
  const svg = getIconSvg(iconId);

  icon.x = x - size / 2;
  icon.y = y - size / 2;
  graphic.svg(svg);
  graphic.scale.set(size / 24);
  icon.addChild(graphic);
  parent.addChild(icon);
  return icon;
}

function getIconSvg(iconId: string): string {
  const cached = iconSvgCache.get(iconId);

  if (cached) {
    return cached;
  }

  iconsDocument ??= new DOMParser().parseFromString(iconsSvgRaw, "image/svg+xml");
  const symbol = iconsDocument.getElementById(`icon-${iconId}`);

  if (!symbol) {
    throw new Error(`Missing icon symbol "icon-${iconId}" in icons.svg`);
  }

  const viewBox = symbol.getAttribute("viewBox") ?? "0 0 24 24";
  const iconMarkup = symbol.innerHTML
    .replace(/#d9d2b7/gi, "#f0d7a1")
    .replace(/#f3edda/gi, "#f0d7a1");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="24" height="24">${iconMarkup}</svg>`;
  iconSvgCache.set(iconId, svg);
  return svg;
}
