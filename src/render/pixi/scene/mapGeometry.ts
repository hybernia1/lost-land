import type { VillageLayoutDefinition } from "../../../data/villageLayouts";
import type { Bounds, SceneLayout } from "../core/types";

type MapLayoutBounds = Pick<VillageLayoutDefinition, "width" | "height">;

type MapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getMapRenderBounds(
  mapLayout: MapLayoutBounds,
  sceneLayout: SceneLayout,
): Bounds {
  const width = mapLayout.width * sceneLayout.scale;
  const height = mapLayout.height * sceneLayout.scale;

  return {
    x: sceneLayout.originX + sceneLayout.width / 2 - width / 2,
    y: sceneLayout.originY + sceneLayout.height / 2 - height / 2,
    width,
    height,
  };
}

export function mapRectToSceneBounds(
  mapLayout: MapLayoutBounds,
  sceneLayout: SceneLayout,
  rect: MapRect,
): Bounds {
  const mapBounds = getMapRenderBounds(mapLayout, sceneLayout);

  return {
    x: mapBounds.x + rect.x * sceneLayout.scale,
    y: mapBounds.y + rect.y * sceneLayout.scale,
    width: rect.width * sceneLayout.scale,
    height: rect.height * sceneLayout.scale,
  };
}
