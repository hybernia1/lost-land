import { Container, Graphics } from "pixi.js";
import { UI_PANEL_RADIUS, uiTheme } from "../core/constants";
import type { Bounds, DrawPanelFn } from "../core/types";
import { drawBluePanelBackground } from "../ui/panelBackground";

export const modalLayout = {
  viewportMarginX: 48,
  viewportMarginY: 72,
  tightViewportMargin: 40,
  buildViewportMargin: 56,
  topMin: 36,
  resultTopMin: 34,
  contentInset: 24,
  wideContentInset: 28,
  sectionGap: 12,
  rowGap: 8,
  rowHeight: 34,
  footerHeight: 110,
} as const;

export type ModalFrameOptions = {
  maxWidth: number;
  minWidth?: number;
  preferredHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  marginX?: number;
  marginY?: number;
  topMin?: number;
};

export type ModalFrame = Bounds;

export function resolveModalWidth(
  viewportWidth: number,
  options: Pick<ModalFrameOptions, "maxWidth" | "minWidth" | "marginX">,
): number {
  const marginX = options.marginX ?? modalLayout.viewportMarginX;
  const availableWidth = Math.max(1, viewportWidth - marginX);
  const minWidth = options.minWidth ?? 0;
  return availableWidth >= minWidth
    ? Math.max(minWidth, Math.min(options.maxWidth, availableWidth))
    : availableWidth;
}

export function resolveModalFrame(
  viewportWidth: number,
  viewportHeight: number,
  options: ModalFrameOptions,
): ModalFrame {
  const marginX = options.marginX ?? modalLayout.viewportMarginX;
  const marginY = options.marginY ?? modalLayout.viewportMarginY;
  const availableHeight = Math.max(1, viewportHeight - marginY);
  const minHeight = options.minHeight ?? 0;

  const width = resolveModalWidth(viewportWidth, { ...options, marginX });
  const heightCeiling = Math.min(options.maxHeight ?? availableHeight, availableHeight);
  const desiredHeight = options.preferredHeight ?? heightCeiling;
  const height = availableHeight >= minHeight
    ? Math.max(minHeight, Math.min(desiredHeight, heightCeiling))
    : availableHeight;

  return {
    x: (viewportWidth - width) / 2,
    y: Math.max(options.topMin ?? modalLayout.topMin, (viewportHeight - height) / 2),
    width,
    height,
  };
}

export function createModalPanel(
  parent: Container,
  drawPanel: DrawPanelFn,
  frame: ModalFrame,
): Container {
  const panel = new Container();
  panel.x = frame.x;
  panel.y = frame.y;
  panel.eventMode = "static";
  panel.sortableChildren = true;
  parent.addChild(panel);
  drawPanel(panel, 0, 0, frame.width, frame.height, 1, 0);
  drawModalFrame(panel, frame.width, frame.height);
  return panel;
}

function drawModalFrame(parent: Container, width: number, height: number): Graphics {
  const radius = UI_PANEL_RADIUS + 2;
  const frame = new Graphics();
  frame.zIndex = 5000;
  frame.eventMode = "none";
  frame
    .roundRect(0.5, 0.5, width - 1, height - 1, radius)
    .stroke({ color: uiTheme.shadow, alpha: 0.84, width: 3 });
  frame
    .roundRect(2.5, 2.5, width - 5, height - 5, Math.max(0, radius - 2))
    .stroke({ color: uiTheme.border, alpha: 0.86, width: 1.4 });
  frame
    .roundRect(5.5, 5.5, width - 11, height - 11, Math.max(0, radius - 5))
    .stroke({ color: uiTheme.borderStrong, alpha: 0.22, width: 1 });
  parent.addChild(frame);
  return frame;
}

export function drawModalHeaderPlane(
  parent: Container,
  width: number,
  height: number,
  alpha = 0.96,
): Graphics {
  drawBluePanelBackground(parent, 0, 0, width, height, alpha);
  const plane = new Graphics();
  plane.roundRect(0, 0, width, height, UI_PANEL_RADIUS)
    .fill({ color: uiTheme.modalHeader, alpha: 0.18 });
  plane.rect(0, height - 1, width, 1)
    .fill({ color: uiTheme.borderStrong, alpha: 0.28 });
  parent.addChild(plane);
  return plane;
}

export function drawModalContentPlane(
  parent: Container,
  width: number,
  height: number,
  y: number,
  alpha = 0.86,
  rounded = true,
): Graphics {
  drawBluePanelBackground(parent, 0, y, width, height - y, alpha);
  const plane = new Graphics();
  if (rounded) {
    plane.roundRect(0, y, width, height - y, UI_PANEL_RADIUS)
      .fill({ color: uiTheme.modalContent, alpha: 0.14 });
  } else {
    plane.rect(0, y, width, height - y)
      .fill({ color: uiTheme.modalContent, alpha: 0.14 });
  }
  plane.rect(0, y, width, 1)
    .fill({ color: uiTheme.borderStrong, alpha: 0.28 });
  parent.addChild(plane);
  return plane;
}
