import { Container } from "pixi.js";
import { uiTextSize, uiTheme } from "../core/constants";
import type { DrawCenteredTextFn, PixiActionDetail } from "../core/types";

export type ModalStepperHost = {
  drawCenteredText: DrawCenteredTextFn;
  createLocalModalButton: (
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    onTap: () => void,
    disabled?: boolean,
  ) => Container;
  createModalButton: (
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    detail: PixiActionDetail,
    disabled?: boolean,
    tooltip?: string,
  ) => Container;
};

export function drawLocalStepper(
  host: ModalStepperHost,
  parent: Container,
  value: string,
  x: number,
  y: number,
  onDecrement: () => void,
  onIncrement: () => void,
  decrementDisabled = false,
  incrementDisabled = false,
  valueFill = uiTheme.accentStrong,
): void {
  host.createLocalModalButton(parent, "-", x, y, 34, 28, onDecrement, decrementDisabled);
  host.drawCenteredText(parent, value, x + 62, y + 14, {
    fill: valueFill,
    fontSize: uiTextSize.value,
    fontWeight: "900",
  });
  host.createLocalModalButton(parent, "+", x + 90, y, 34, 28, onIncrement, incrementDisabled);
}

export function drawActionStepper(
  host: ModalStepperHost,
  parent: Container,
  value: string,
  x: number,
  y: number,
  decrementDetail: PixiActionDetail,
  incrementDetail: PixiActionDetail,
  decrementDisabled = false,
  incrementDisabled = false,
  decrementTooltip?: string,
  incrementTooltip?: string,
): void {
  host.createModalButton(parent, "-", x, y, 34, 28, decrementDetail, decrementDisabled, decrementTooltip);
  host.drawCenteredText(parent, value, x + 62, y + 14, {
    fill: uiTheme.accentStrong,
    fontSize: uiTextSize.value,
    fontWeight: "900",
  });
  host.createModalButton(parent, "+", x + 90, y, 34, 28, incrementDetail, incrementDisabled, incrementTooltip);
}
