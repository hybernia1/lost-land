import type { Container } from "pixi.js";
import type { VillageLayoutDefinition } from "../../../data/villageLayouts";
import { CAMERA_MAX_ZOOM, CAMERA_MIN_ZOOM, CAMERA_OFFSET_SNAP_EPSILON, CAMERA_SMOOTH_FACTOR, CAMERA_ZOOM_SNAP_EPSILON, CAMERA_ZOOM_STEP, HUD_DESIGN_SCALE, HUD_LEFT_PANEL_WIDTH, HUD_TOP_STRIP_HEIGHT } from "../core/constants";
import type { Bounds, SceneLayout } from "../core/types";
import { getMapRenderBounds } from "../scene/mapGeometry";

export type CameraDragState = {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
};

export type CameraWheelHost = {
  host: HTMLElement;
  hudPixelScale: number;
  hudInteractionAreas: Bounds[];
  buildChoicesScrollArea: Bounds | null;
  buildChoicesScrollMax: number;
  buildChoicesScrollY: number;
  setBuildChoicesScrollY: (value: number) => void;
  buildingBonusScrollArea: Bounds | null;
  buildingBonusScrollMax: number;
  buildingBonusScrollY: number;
  setBuildingBonusScrollY: (value: number) => void;
  resourceBreakdownScrollArea: Bounds | null;
  resourceBreakdownScrollMax: number;
  resourceBreakdownScrollY: number;
  setResourceBreakdownScrollY: (value: number) => void;
  logScrollArea: Bounds | null;
  logScrollMax: number;
  logScrollY: number;
  setLogScrollY: (value: number) => void;
  decisionHistoryScrollArea: Bounds | null;
  decisionHistoryScrollMax: number;
  decisionHistoryScrollY: number;
  setDecisionHistoryScrollY: (value: number) => void;
  requestRender: () => void;
  cameraDragBlocked: boolean;
  cameraTargetZoom: number;
  cameraTargetOffsetX: number;
  cameraTargetOffsetY: number;
  setCameraTarget: (zoom: number, offsetX: number, offsetY: number) => void;
  clampTargetCamera: (viewportWidth: number, viewportHeight: number) => void;
  updateAmbientAnimationLoop: () => void;
};

export function isHudPointer(host: HTMLElement, hudInteractionAreas: Bounds[], clientX: number, clientY: number): boolean {
  const rect = host.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  return hudInteractionAreas.some((area) =>
    x >= area.x &&
    x <= area.x + area.width &&
    y >= area.y &&
    y <= area.y + area.height
  );
}

export function getLogicalWheelDelta(hudPixelScale: number, event: WheelEvent): number {
  return event.deltaY / hudPixelScale;
}

function handleScrollableWheel(
  host: HTMLElement,
  hudPixelScale: number,
  event: WheelEvent,
  area: Bounds | null,
  scrollMax: number,
  scrollY: number,
  setScrollY: (value: number) => void,
  requestRender: () => void,
): boolean {
  if (!area || scrollMax <= 0) {
    return false;
  }

  const rect = host.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (
    x < area.x ||
    x > area.x + area.width ||
    y < area.y ||
    y > area.y + area.height
  ) {
    return false;
  }

  event.preventDefault();
  const nextScroll = Math.max(0, Math.min(scrollMax, scrollY + getLogicalWheelDelta(hudPixelScale, event)));
  if (nextScroll === scrollY) {
    return true;
  }

  setScrollY(nextScroll);
  requestRender();
  return true;
}

function handleBuildChoicesWheel(hostState: CameraWheelHost, event: WheelEvent): boolean {
  if (!hostState.buildChoicesScrollArea || hostState.buildChoicesScrollMax <= 0) {
    return false;
  }

  const rect = hostState.host.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const area = hostState.buildChoicesScrollArea;

  if (
    x < area.x ||
    x > area.x + area.width ||
    y < area.y ||
    y > area.y + area.height
  ) {
    return false;
  }

  event.preventDefault();
  const nextScroll = Math.max(
    0,
    Math.min(hostState.buildChoicesScrollMax, hostState.buildChoicesScrollY + getLogicalWheelDelta(hostState.hudPixelScale, event)),
  );
  if (nextScroll === hostState.buildChoicesScrollY) {
    return true;
  }

  hostState.setBuildChoicesScrollY(nextScroll);
  hostState.requestRender();
  return true;
}

function handleCameraZoom(hostState: CameraWheelHost, event: WheelEvent): void {
  if (hostState.cameraDragBlocked || isHudPointer(hostState.host, hostState.hudInteractionAreas, event.clientX, event.clientY)) {
    event.preventDefault();
    return;
  }

  const rect = hostState.host.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const previousZoom = hostState.cameraTargetZoom;
  const nextZoom = Math.max(
    CAMERA_MIN_ZOOM,
    Math.min(CAMERA_MAX_ZOOM, previousZoom * Math.exp(-event.deltaY * CAMERA_ZOOM_STEP)),
  );
  if (nextZoom === previousZoom) {
    event.preventDefault();
    return;
  }

  const worldX = (x - hostState.cameraTargetOffsetX) / previousZoom;
  const worldY = (y - hostState.cameraTargetOffsetY) / previousZoom;
  hostState.setCameraTarget(nextZoom, x - worldX * nextZoom, y - worldY * nextZoom);
  hostState.clampTargetCamera(hostState.host.clientWidth, hostState.host.clientHeight);
  hostState.updateAmbientAnimationLoop();
  event.preventDefault();
}

export function handleHostWheel(hostState: CameraWheelHost, event: WheelEvent): void {
  if (handleScrollableWheel(
    hostState.host,
    hostState.hudPixelScale,
    event,
    hostState.buildingBonusScrollArea,
    hostState.buildingBonusScrollMax,
    hostState.buildingBonusScrollY,
    hostState.setBuildingBonusScrollY,
    hostState.requestRender,
  )) {
    return;
  }

  if (handleScrollableWheel(
    hostState.host,
    hostState.hudPixelScale,
    event,
    hostState.resourceBreakdownScrollArea,
    hostState.resourceBreakdownScrollMax,
    hostState.resourceBreakdownScrollY,
    hostState.setResourceBreakdownScrollY,
    hostState.requestRender,
  )) {
    return;
  }

  if (handleScrollableWheel(
    hostState.host,
    hostState.hudPixelScale,
    event,
    hostState.logScrollArea,
    hostState.logScrollMax,
    hostState.logScrollY,
    hostState.setLogScrollY,
    hostState.requestRender,
  )) {
    return;
  }

  if (handleScrollableWheel(
    hostState.host,
    hostState.hudPixelScale,
    event,
    hostState.decisionHistoryScrollArea,
    hostState.decisionHistoryScrollMax,
    hostState.decisionHistoryScrollY,
    hostState.setDecisionHistoryScrollY,
    hostState.requestRender,
  )) {
    return;
  }

  if (handleBuildChoicesWheel(hostState, event)) {
    return;
  }

  if (isHudPointer(hostState.host, hostState.hudInteractionAreas, event.clientX, event.clientY)) {
    event.preventDefault();
    return;
  }

  handleCameraZoom(hostState, event);
}

export function handleHostPointerDown(
  host: HTMLElement,
  hudInteractionAreas: Bounds[],
  cameraDragBlocked: boolean,
  event: PointerEvent,
  cameraTargetOffsetX: number,
  cameraTargetOffsetY: number,
): CameraDragState | null {
  if (cameraDragBlocked || event.button !== 0 || isHudPointer(host, hudInteractionAreas, event.clientX, event.clientY)) {
    return null;
  }

  host.setPointerCapture(event.pointerId);
  return {
    x: event.clientX,
    y: event.clientY,
    offsetX: cameraTargetOffsetX,
    offsetY: cameraTargetOffsetY,
  };
}

export function handleHostPointerMove(
  host: HTMLElement,
  dragStart: CameraDragState | null,
  event: PointerEvent,
): { moved: boolean; offsetX: number; offsetY: number } | null {
  if (!dragStart) {
    return null;
  }

  const deltaX = event.clientX - dragStart.x;
  const deltaY = event.clientY - dragStart.y;
  const moved = Math.hypot(deltaX, deltaY) >= 5;
  if (!moved) {
    return { moved: false, offsetX: dragStart.offsetX, offsetY: dragStart.offsetY };
  }

  event.preventDefault();
  return {
    moved: true,
    offsetX: dragStart.offsetX + deltaX,
    offsetY: dragStart.offsetY + deltaY,
  };
}

export function handleHostPointerUp(host: HTMLElement, dragStart: CameraDragState | null, event: PointerEvent): boolean {
  if (!dragStart) {
    return false;
  }

  if (host.hasPointerCapture(event.pointerId)) {
    host.releasePointerCapture(event.pointerId);
  }

  return true;
}

export function shouldAnimateCamera(
  cameraTargetZoom: number,
  cameraZoom: number,
  cameraTargetOffsetX: number,
  cameraOffsetX: number,
  cameraTargetOffsetY: number,
  cameraOffsetY: number,
): boolean {
  return (
    Math.abs(cameraTargetZoom - cameraZoom) > CAMERA_ZOOM_SNAP_EPSILON ||
    Math.abs(cameraTargetOffsetX - cameraOffsetX) > CAMERA_OFFSET_SNAP_EPSILON ||
    Math.abs(cameraTargetOffsetY - cameraOffsetY) > CAMERA_OFFSET_SNAP_EPSILON
  );
}

export function clampCamera(
  zoom: number,
  offsetX: number,
  offsetY: number,
  mapLayout: VillageLayoutDefinition,
  layout: SceneLayout,
  viewportWidth: number,
  viewportHeight: number,
): { zoom: number; offsetX: number; offsetY: number } {
  const mapBounds = getMapRenderBounds(mapLayout, layout);
  const terrainWidth = mapBounds.width;
  const terrainHeight = mapBounds.height;
  const originX = mapBounds.x;
  const originY = mapBounds.y;
  const insets = getCameraViewportInsets(viewportWidth, viewportHeight);
  const safeLeft = insets.left;
  const safeTop = insets.top;
  const safeRight = viewportWidth - insets.right;
  const safeBottom = viewportHeight - insets.bottom;
  const safeWidth = Math.max(1, safeRight - safeLeft);
  const safeHeight = Math.max(1, safeBottom - safeTop);
  const minZoomForCoverage = mapLayout.orientation === "isometric"
    ? safeWidth / Math.max(1, terrainWidth) + safeHeight / Math.max(1, terrainHeight)
    : Math.max(
      safeWidth / Math.max(1, terrainWidth),
      safeHeight / Math.max(1, terrainHeight),
    );
  const minAllowedZoom = Math.max(CAMERA_MIN_ZOOM, minZoomForCoverage);
  const clampedZoom = Math.max(minAllowedZoom, Math.min(CAMERA_MAX_ZOOM, zoom));
  let clampedOffsetX = offsetX;
  let clampedOffsetY = offsetY;

  if (mapLayout.orientation === "isometric") {
    const halfTerrainWidth = Math.max(1, terrainWidth / 2);
    const halfTerrainHeight = Math.max(1, terrainHeight / 2);
    const centerX = originX + halfTerrainWidth;
    const centerY = originY + halfTerrainHeight;
    const invX = 1 / (clampedZoom * halfTerrainWidth);
    const invY = 1 / (clampedZoom * halfTerrainHeight);
    const isoPlusCenter = centerX / halfTerrainWidth + centerY / halfTerrainHeight;
    const isoMinusCenter = centerX / halfTerrainWidth - centerY / halfTerrainHeight;
    const corners = [
      { x: safeLeft, y: safeTop },
      { x: safeRight, y: safeTop },
      { x: safeLeft, y: safeBottom },
      { x: safeRight, y: safeBottom },
    ];

    let minIsoPlus = Number.NEGATIVE_INFINITY;
    let maxIsoPlus = Number.POSITIVE_INFINITY;
    let minIsoMinus = Number.NEGATIVE_INFINITY;
    let maxIsoMinus = Number.POSITIVE_INFINITY;

    for (const corner of corners) {
      const plusTerm = invX * corner.x + invY * corner.y - isoPlusCenter;
      minIsoPlus = Math.max(minIsoPlus, plusTerm - 1);
      maxIsoPlus = Math.min(maxIsoPlus, plusTerm + 1);

      const minusTerm = invX * corner.x - invY * corner.y - isoMinusCenter;
      minIsoMinus = Math.max(minIsoMinus, minusTerm - 1);
      maxIsoMinus = Math.min(maxIsoMinus, minusTerm + 1);
    }

    if (minIsoPlus > maxIsoPlus) {
      const middle = (minIsoPlus + maxIsoPlus) / 2;
      minIsoPlus = middle;
      maxIsoPlus = middle;
    }
    if (minIsoMinus > maxIsoMinus) {
      const middle = (minIsoMinus + maxIsoMinus) / 2;
      minIsoMinus = middle;
      maxIsoMinus = middle;
    }

    const desiredIsoPlus = invX * offsetX + invY * offsetY;
    const desiredIsoMinus = invX * offsetX - invY * offsetY;
    const clampedIsoPlus = Math.max(minIsoPlus, Math.min(maxIsoPlus, desiredIsoPlus));
    const clampedIsoMinus = Math.max(minIsoMinus, Math.min(maxIsoMinus, desiredIsoMinus));
    clampedOffsetX = (clampedIsoPlus + clampedIsoMinus) / (2 * invX);
    clampedOffsetY = (clampedIsoPlus - clampedIsoMinus) / (2 * invY);
  } else {
    const scaledTerrainWidth = terrainWidth * clampedZoom;
    const scaledTerrainHeight = terrainHeight * clampedZoom;

    if (scaledTerrainWidth <= safeWidth) {
      clampedOffsetX = safeLeft + (safeWidth - scaledTerrainWidth) / 2 - originX * clampedZoom;
    } else {
      const minX = safeRight - (originX + terrainWidth) * clampedZoom;
      const maxX = safeLeft - originX * clampedZoom;
      clampedOffsetX = Math.max(minX, Math.min(maxX, clampedOffsetX));
    }

    if (scaledTerrainHeight <= safeHeight) {
      clampedOffsetY = safeTop + (safeHeight - scaledTerrainHeight) / 2 - originY * clampedZoom;
    } else {
      const minY = safeBottom - (originY + terrainHeight) * clampedZoom;
      const maxY = safeTop - originY * clampedZoom;
      clampedOffsetY = Math.max(minY, Math.min(maxY, clampedOffsetY));
    }
  }

  return {
    zoom: clampedZoom,
    offsetX: clampedOffsetX,
    offsetY: clampedOffsetY,
  };
}

export function getCameraViewportInsets(viewportWidth: number, viewportHeight: number): { left: number; right: number; top: number; bottom: number } {
  const hudScale = HUD_DESIGN_SCALE * 1;
  const minSafeWidth = 240;
  const minSafeHeight = 220;
  let left = HUD_LEFT_PANEL_WIDTH * hudScale;
  const right = 0;
  let top = HUD_TOP_STRIP_HEIGHT * hudScale;
  const bottom = 0;
  const maxLeftInset = Math.max(0, viewportWidth - minSafeWidth);

  left = Math.min(left, maxLeftInset);
  const maxTopInset = Math.max(0, viewportHeight - minSafeHeight);
  top = Math.min(top, maxTopInset);

  return { left, right, top, bottom };
}

export function getLayout(width: number, height: number): SceneLayout {
  const scale = Math.min(width / 1420, height / 880);
  const villageWidth = 1120 * scale;
  const villageHeight = 680 * scale;

  return {
    originX: (width - villageWidth) / 2,
    originY: Math.max(76, (height - villageHeight) / 2),
    width: villageWidth,
    height: villageHeight,
    scale,
  };
}

export function refreshCameraTransform(
  host: HTMLElement,
  cameraLayer: Container,
  mapLayout: VillageLayoutDefinition,
  layout: SceneLayout,
  state: {
    zoom: number;
    targetZoom: number;
    offsetX: number;
    targetOffsetX: number;
    offsetY: number;
    targetOffsetY: number;
  },
): {
  zoom: number;
  offsetX: number;
  offsetY: number;
} {
  const viewportWidth = host.clientWidth;
  const viewportHeight = host.clientHeight;
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { zoom: state.zoom, offsetX: state.offsetX, offsetY: state.offsetY };
  }

  if (!shouldAnimateCamera(state.targetZoom, state.zoom, state.targetOffsetX, state.offsetX, state.targetOffsetY, state.offsetY)) {
    return { zoom: state.zoom, offsetX: state.offsetX, offsetY: state.offsetY };
  }

  let nextZoom = state.zoom + (state.targetZoom - state.zoom) * CAMERA_SMOOTH_FACTOR;
  let nextOffsetX = state.offsetX + (state.targetOffsetX - state.offsetX) * CAMERA_SMOOTH_FACTOR;
  let nextOffsetY = state.offsetY + (state.targetOffsetY - state.offsetY) * CAMERA_SMOOTH_FACTOR;

  const clampedCurrent = clampCamera(nextZoom, nextOffsetX, nextOffsetY, mapLayout, layout, viewportWidth, viewportHeight);
  nextZoom = clampedCurrent.zoom;
  nextOffsetX = clampedCurrent.offsetX;
  nextOffsetY = clampedCurrent.offsetY;

  if (
    Math.abs(state.targetZoom - nextZoom) <= CAMERA_ZOOM_SNAP_EPSILON &&
    Math.abs(state.targetOffsetX - nextOffsetX) <= CAMERA_OFFSET_SNAP_EPSILON &&
    Math.abs(state.targetOffsetY - nextOffsetY) <= CAMERA_OFFSET_SNAP_EPSILON
  ) {
    const snapped = clampCamera(
      state.targetZoom,
      state.targetOffsetX,
      state.targetOffsetY,
      mapLayout,
      layout,
      viewportWidth,
      viewportHeight,
    );
    nextZoom = snapped.zoom;
    nextOffsetX = snapped.offsetX;
    nextOffsetY = snapped.offsetY;
  }

  cameraLayer.x = nextOffsetX;
  cameraLayer.y = nextOffsetY;
  cameraLayer.scale.set(nextZoom);

  return {
    zoom: nextZoom,
    offsetX: nextOffsetX,
    offsetY: nextOffsetY,
  };
}
