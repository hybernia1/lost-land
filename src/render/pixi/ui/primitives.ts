import { Container, Graphics, Text, type TextStyleFontWeight } from "pixi.js";
import { getHudTextLineHeight, HUD_FONT_FAMILY, normalizeHudFontWeight } from "../core/constants";
import type { CircleButtonOptions, PixiActionDetail, RectButtonOptions, RectButtonTone } from "../core/types";

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
  const panel = new Graphics();
  panel.rect(x, y, width, height);
  panel.fill({ color: 0x10120e, alpha: fillAlpha });
  parent.addChild(panel);
  return panel;
}

export function getRectButtonStyle(
  tone: RectButtonTone,
  disabled: boolean,
  active: boolean,
): { fill: number; fillAlpha: number; textFill: number } {
  if (disabled) {
    return {
      fill: 0x34362e,
      fillAlpha: tone === "secondary" ? 0.52 : 0.62,
      textFill: 0xaeb4b8,
    };
  }

  if (active || tone === "primary") {
    return {
      fill: 0xe0c46f,
      fillAlpha: 1,
      textFill: 0x141719,
    };
  }

  if (tone === "secondary") {
    return {
      fill: 0x262719,
      fillAlpha: 0.92,
      textFill: 0xf1df9a,
    };
  }

  return {
    fill: 0x2d2f23,
    fillAlpha: 0.84,
    textFill: 0xf4eedf,
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
  const box = new Graphics();
  box.rect(0, 0, options.width, options.height).fill({ color: style.fill, alpha: style.fillAlpha });
  button.addChild(box);

  if (options.iconId) {
    const icon = host.drawIcon(button, options.iconId, options.width / 2, options.height / 2, Math.min(options.width, options.height) - 14);
    icon.alpha = options.active ? 0.9 : 1;
  }

  if (options.label) {
    drawCenteredText(button, options.label, options.width / 2, options.height / 2, {
      fill: style.textFill,
      fontSize: options.fontSize ?? 13,
      fontWeight: options.fontWeight ?? "900",
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
  const button = new Container();
  button.x = options.x;
  button.y = options.y;

  const box = new Graphics();
  box.rect(-options.radius, -options.radius, options.radius * 2, options.radius * 2)
    .fill({ color: options.active ? 0xe0c46f : 0x2d2f23, alpha: options.active ? 1 : 0.9 });
  button.addChild(box);

  const icon = host.drawIcon(button, options.iconId, 0, 0, options.radius * 1.08);
  icon.alpha = options.active ? 0.92 : 1;
  host.bindAction(button, options.detail);
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
  const labelFill = options.labelFill ?? 0xe9e4d2;
  const sublabelFill = options.sublabelFill ?? 0xaeb4b8;
  const compact = options.compact ?? false;

  const text = new Text({
    text: options.label,
    style: {
      fill: labelFill,
      fontFamily: HUD_FONT_FAMILY,
      fontSize: compact ? 12 : 13,
      fontWeight: normalizeHudFontWeight("800"),
    },
  });
  const subtext = options.sublabel
    ? new Text({
      text: options.sublabel,
      style: {
        fill: sublabelFill,
        fontFamily: HUD_FONT_FAMILY,
        fontSize: compact ? 9 : 10,
        fontWeight: normalizeHudFontWeight("800"),
      },
    })
    : null;
  const width = Math.max(compact ? 62 : 68, Math.max(text.width, subtext?.width ?? 0) + (compact ? 38 : 44));
  const height = subtext ? (compact ? 38 : 46) : (compact ? 30 : 34);
  const panel = new Graphics();
  panel.rect(0, 0, width, height).fill({ color: 0x10120e, alpha: compact ? 0.64 : 0.76 });
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
