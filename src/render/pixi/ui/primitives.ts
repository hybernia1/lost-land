import { Container, Graphics, Text, type TextStyleFontWeight } from "pixi.js";
import {
  getHudTextLineHeight,
  HUD_FONT_FAMILY,
  normalizeHudFontWeight,
  UI_CONTROL_RADIUS,
  UI_PANEL_RADIUS,
  uiTextSize,
  uiTheme,
} from "../core/constants";
import type { CircleButtonOptions, PixiActionDetail, RectButtonOptions, RectButtonTone } from "../core/types";
import { drawBluePanelBackground } from "./panelBackground";

type UiPrimitivesHost = {
  drawIcon: (parent: Container, iconId: string, x: number, y: number, size: number) => Container;
  bindTooltip: (target: Container, text: string) => void;
  bindAction: (target: Container, detail: PixiActionDetail) => void;
  bindLocalAction: (target: Container, onTap: () => void) => void;
  consumeHostClick: () => void;
};

export function drawTextPrimitive(
  parent: Container,
  text: string,
  x: number,
  y: number,
  options: {
    fill: number;
    fontSize: number;
    fontWeight?: TextStyleFontWeight;
    alpha?: number;
    align?: "left" | "center" | "right";
    wordWrap?: boolean;
    wordWrapWidth?: number;
    lineHeight?: number;
  },
): Text {
  const normalizedLineHeight = options.lineHeight ?? getHudTextLineHeight(options.fontSize);
  const label = new Text({
    text,
    style: {
      fill: options.fill,
      fontFamily: HUD_FONT_FAMILY,
      fontSize: options.fontSize,
      fontWeight: normalizeHudFontWeight(options.fontWeight ?? "700"),
      lineHeight: normalizedLineHeight,
      align: options.align,
      wordWrap: options.wordWrap,
      wordWrapWidth: options.wordWrapWidth,
    },
  });
  label.alpha = options.alpha ?? 1;
  label.x = x;
  label.y = y;
  parent.addChild(label);
  return label;
}

export function drawCenteredTextPrimitive(
  parent: Container,
  drawText: typeof drawTextPrimitive,
  text: string,
  x: number,
  y: number,
  options: Parameters<typeof drawTextPrimitive>[4],
): Text {
  const label = drawText(parent, text, x, y, options);
  label.anchor.set(0.5);
  return label;
}

export function drawPanelPrimitive(
  parent: Container,
  x: number,
  y: number,
  width: number,
  height: number,
  fillAlpha = 0.76,
): Graphics {
  const background = drawBluePanelBackground(parent, x, y, width, height, Math.min(1, Math.max(fillAlpha, 0.82)));
  const backgroundMask = new Graphics();
  backgroundMask.roundRect(x, y, width, height, UI_PANEL_RADIUS).fill({ color: 0xffffff, alpha: 1 });
  parent.addChild(backgroundMask);
  background.mask = backgroundMask;

  const panel = new Graphics();
  panel.roundRect(x, y, width, height, UI_PANEL_RADIUS);
  panel
    .fill({ color: uiTheme.surface, alpha: 0.1 })
    .stroke({ color: uiTheme.border, alpha: 0.5, width: 1 });
  parent.addChild(panel);
  return panel;
}

export function getRectButtonStyle(
  tone: RectButtonTone,
  disabled: boolean,
  active: boolean,
): { fill: number; fillAlpha: number; textFill: number; border: number; borderAlpha: number } {
  if (disabled) {
    return {
      fill: uiTheme.surfaceSunken,
      fillAlpha: tone === "secondary" ? 0.44 : 0.58,
      textFill: uiTheme.textMuted,
      border: uiTheme.border,
      borderAlpha: 0.24,
    };
  }

  if (tone === "primary") {
    return {
      fill: uiTheme.actionSurface,
      fillAlpha: 0.9,
      textFill: uiTheme.text,
      border: uiTheme.actionBorder,
      borderAlpha: 0.86,
    };
  }

  if (active) {
    return {
      fill: uiTheme.accentSurface,
      fillAlpha: 0.72,
      textFill: uiTheme.text,
      border: uiTheme.borderStrong,
      borderAlpha: 0.78,
    };
  }

  if (tone === "secondary") {
    return {
      fill: uiTheme.surfaceSunken,
      fillAlpha: 0.7,
      textFill: uiTheme.accentStrong,
      border: uiTheme.border,
      borderAlpha: 0.46,
    };
  }

  return {
    fill: uiTheme.surfaceMuted,
    fillAlpha: 0.72,
    textFill: uiTheme.text,
    border: uiTheme.border,
    borderAlpha: 0.48,
  };
}

export function createRectButtonPrimitive(
  host: UiPrimitivesHost,
  parent: Container,
  options: RectButtonOptions,
  drawCenteredText: (
    parent: Container,
    text: string,
    x: number,
    y: number,
    options: {
      fill: number;
      fontSize: number;
      fontWeight?: TextStyleFontWeight;
      alpha?: number;
      align?: "left" | "center" | "right";
      wordWrap?: boolean;
      wordWrapWidth?: number;
      lineHeight?: number;
    },
  ) => Text,
): Container {
  const button = new Container();
  button.x = options.x;
  button.y = options.y;

  const style = getRectButtonStyle(options.tone ?? "toolbar", options.disabled ?? false, options.active ?? false);
  const radius = Math.min(UI_CONTROL_RADIUS, options.height / 2);
  const tone = options.tone ?? "toolbar";
  const box = new Graphics();
  box.roundRect(0, 0, options.width, options.height, radius)
    .fill({ color: style.fill, alpha: style.fillAlpha });
  if (!options.disabled && tone === "primary") {
    box.roundRect(1, 1, options.width - 2, Math.max(0, options.height - 2), Math.max(0, radius - 1))
      .fill({ color: uiTheme.actionSurfaceDark, alpha: 0.28 });
    box.rect(2, 2, Math.max(0, options.width - 4), Math.max(0, options.height * 0.45))
      .fill({ color: uiTheme.actionBorder, alpha: 0.1 });
  }
  box.roundRect(0, 0, options.width, options.height, radius)
    .stroke({ color: style.border, alpha: style.borderAlpha, width: tone === "primary" ? 1.4 : 1 });
  if (options.disabled) {
    box.roundRect(0, 0, options.width, options.height, radius)
      .fill({ color: uiTheme.border, alpha: 0.12 });
  } else if (options.active) {
    box.rect(2, options.height - 2, Math.max(0, options.width - 4), 1.5).fill({ color: uiTheme.borderStrong, alpha: 0.42 });
  }
  button.addChild(box);

  if (options.iconId) {
    const icon = host.drawIcon(button, options.iconId, options.width / 2, options.height / 2, Math.min(options.width, options.height) - 14);
    icon.alpha = options.active ? 0.9 : 1;
  }

  if (options.label) {
    drawCenteredText(button, options.label, options.width / 2, options.height / 2, {
      fill: style.textFill,
      fontSize: options.fontSize ?? uiTextSize.body,
      fontWeight: normalizeHudFontWeight(options.fontWeight ?? "700"),
    });
  }

  if (!options.disabled) {
    if (options.detail) {
      host.bindAction(button, options.detail);
    } else if (options.onTap) {
      host.bindLocalAction(button, options.onTap);
    }
  } else {
    button.eventMode = "static";
    button.cursor = "not-allowed";
    button.on("pointerdown", (event) => {
      event.stopPropagation();
      host.consumeHostClick();
    });
  }

  if (options.tooltip) {
    host.bindTooltip(button, options.tooltip);
  }

  parent.addChild(button);
  return button;
}

export function createCircleButtonPrimitive(
  host: UiPrimitivesHost,
  parent: Container,
  options: CircleButtonOptions,
): Container {
  const disabled = options.disabled ?? false;
  const button = new Container();
  button.x = options.x;
  button.y = options.y;

  const box = new Graphics();
  const fillColor = disabled
    ? uiTheme.surfaceSunken
    : options.active
      ? uiTheme.accentSurface
      : uiTheme.surface;
  const fillAlpha = disabled
    ? 0.42
    : options.active
      ? 0.92
      : 0.86;
  const shadow = new Graphics();
  shadow.circle(1.5, 2.5, options.radius)
    .fill({ color: uiTheme.shadow, alpha: disabled ? 0.08 : 0.16 });
  button.addChild(shadow);
  box.circle(0, 0, options.radius)
    .fill({ color: fillColor, alpha: fillAlpha });
  box.circle(0, 0, options.radius)
    .stroke({ color: uiTheme.border, alpha: disabled ? 0.32 : 0.68, width: 1.2 });
  if (!disabled) {
    box.circle(0, 0, Math.max(0, options.radius - 5))
      .fill({ color: options.active ? uiTheme.accentSurface : uiTheme.surfaceMuted, alpha: options.active ? 0.32 : 0.42 });
  }
  button.addChild(box);

  const icon = host.drawIcon(button, options.iconId, 0, 0, options.radius * 1.08);
  icon.alpha = disabled ? 0.44 : 1;
  if (!disabled) {
    host.bindAction(button, options.detail);
  } else {
    button.eventMode = "static";
    button.cursor = "not-allowed";
    button.on("pointerdown", (event) => {
      event.stopPropagation();
      host.consumeHostClick();
    });
  }
  host.bindTooltip(button, options.tooltip);
  parent.addChild(button);
  return button;
}

export function createPillPrimitive(
  host: UiPrimitivesHost,
  drawText: typeof drawTextPrimitive,
  options: {
    label: string;
    iconId: string;
    tooltip?: string;
    sublabel?: string;
    sublabelFill?: number;
    action?: PixiActionDetail;
    labelFill?: number;
    compact?: boolean;
  },
): Container {
  const group = new Container();
  const labelFill = options.labelFill ?? uiTheme.text;
  const sublabelFill = options.sublabelFill ?? uiTheme.textMuted;
  const compact = options.compact ?? false;

  const text = new Text({
    text: options.label,
    style: {
      fill: labelFill,
      fontFamily: HUD_FONT_FAMILY,
      fontSize: compact ? uiTextSize.small : uiTextSize.body,
      fontWeight: normalizeHudFontWeight("800"),
    },
  });
  const subtext = options.sublabel
    ? new Text({
      text: options.sublabel,
      style: {
        fill: sublabelFill,
        fontFamily: HUD_FONT_FAMILY,
        fontSize: compact ? uiTextSize.tiny : uiTextSize.micro,
        fontWeight: normalizeHudFontWeight("800"),
      },
    })
    : null;
  const width = Math.max(compact ? 62 : 68, Math.max(text.width, subtext?.width ?? 0) + (compact ? 38 : 44));
  const height = subtext ? (compact ? 38 : 46) : (compact ? 30 : 34);
  const panel = new Graphics();
  panel.roundRect(0, 0, width, height, UI_CONTROL_RADIUS)
    .fill({ color: uiTheme.surface, alpha: compact ? 0.46 : 0.62 })
    .stroke({ color: uiTheme.border, alpha: compact ? 0.42 : 0.52, width: 1 });
  group.addChild(panel);
  host.drawIcon(group, options.iconId, compact ? 15 : 17, height / 2, compact ? 14 : 16);
  text.x = compact ? 28 : 32;
  text.y = subtext ? (compact ? 4 : 6) : (compact ? 6 : 7);
  group.addChild(text);
  if (subtext) {
    subtext.x = compact ? 28 : 32;
    subtext.y = compact ? 22 : 25;
    group.addChild(subtext);
  }
  if (options.tooltip) {
    host.bindTooltip(group, options.tooltip);
  }
  if (options.action) {
    host.bindAction(group, options.action);
  }
  return group;
}
