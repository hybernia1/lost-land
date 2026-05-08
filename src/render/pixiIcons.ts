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
    return getFallbackSvg();
  }

  const viewBox = symbol.getAttribute("viewBox") ?? "0 0 24 24";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="24" height="24">${symbol.innerHTML}</svg>`;
  iconSvgCache.set(iconId, svg);
  return svg;
}

function getFallbackSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle fill="#d9d2b7" cx="12" cy="12" r="7"/></svg>`;
}
