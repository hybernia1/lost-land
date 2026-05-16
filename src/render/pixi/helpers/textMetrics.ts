import { CanvasTextMetrics, TextStyle, type TextStyleFontWeight } from "pixi.js";
import {
  getHudTextLineHeight,
  HUD_FONT_FAMILY,
  normalizeHudFontWeight,
} from "../core/constants";

function createHudMeasureStyle(
  fontSize: number,
  fontWeight: TextStyleFontWeight,
  options: { wordWrap?: boolean; wordWrapWidth?: number } = {},
): TextStyle {
  return new TextStyle({
    fill: 0xffffff,
    fontFamily: HUD_FONT_FAMILY,
    fontSize,
    fontWeight: normalizeHudFontWeight(fontWeight),
    lineHeight: getHudTextLineHeight(fontSize),
    wordWrap: options.wordWrap,
    wordWrapWidth: options.wordWrapWidth,
  });
}

export function measureHudWrappedTextHeight(
  text: string,
  fontSize: number,
  fontWeight: TextStyleFontWeight,
  maxWidth: number,
): number {
  const lineHeight = getHudTextLineHeight(fontSize);
  const style = createHudMeasureStyle(fontSize, fontWeight, {
    wordWrap: true,
    wordWrapWidth: Math.max(1, maxWidth),
  });
  const sample = text && text.trim().length > 0 ? text : " ";
  const metrics = CanvasTextMetrics.measureText(sample, style);
  return Math.max(lineHeight, Math.ceil(metrics.height));
}

export function wrapHudTextLines(
  text: string,
  options: {
    fontSize: number;
    fontWeight: TextStyleFontWeight;
    maxWidth: number;
  },
): string[] {
  const style = createHudMeasureStyle(options.fontSize, options.fontWeight, {
    wordWrap: false,
  });
  const lines: string[] = [];
  const words = text.split(/\s+/).filter((word) => word.length > 0);

  if (words.length === 0) {
    return [text];
  }

  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const candidateWidth = CanvasTextMetrics.measureText(candidate, style).width;

    if (candidateWidth <= options.maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }

    if (CanvasTextMetrics.measureText(word, style).width <= options.maxWidth) {
      currentLine = word;
      continue;
    }

    let chunk = "";
    for (const char of word) {
      const charCandidate = chunk + char;
      if (CanvasTextMetrics.measureText(charCandidate, style).width <= options.maxWidth || chunk.length === 0) {
        chunk = charCandidate;
        continue;
      }

      lines.push(chunk);
      chunk = char;
    }

    currentLine = chunk;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
