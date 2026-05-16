import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { combatUnitDefinitions } from "../../../data/combatUnits";
import { combatUnitNpcKindById } from "../../../data/combatUnitVisuals";
import { mapNpcDefinitions, type MapNpcKindId } from "../../../data/mapNpcs";
import { settlementBattleMap, type SettlementBattleTileId } from "../../../data/settlementBattleMap";
import type { BattleLogEntry, BattleState, BattleUnitState, CombatUnitId } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getBattleReachableHexes, getBattleUnitAttackDamage, isInAttackRange } from "../../../systems/combat";
import type { MapNpcTextureSet } from "../../villageAssets";
import { uiTextSize, uiTheme } from "../core/constants";
import type { DrawOverlayHeaderFn, DrawPanelFn, DrawTextFn, PixiActionDetail, RectButtonOptions } from "../core/types";
import { formatTemplate } from "../helpers/formatters";

type BattleModalHost = {
  hudLayer: Container;
  drawModalBackdrop: (
    overlay: Container,
    width: number,
    height: number,
    closeAction?: PixiActionDetail,
    blockClose?: boolean,
  ) => void;
  drawPanel: DrawPanelFn;
  drawText: DrawTextFn;
  drawOverlayHeader: DrawOverlayHeaderFn;
  createRectButton: (parent: Container, options: RectButtonOptions) => Container;
  bindAction: (target: Container, detail: PixiActionDetail) => void;
  bindTooltip: (target: Container, text: string) => void;
  getMapNpcTextures: (kindId: MapNpcKindId) => MapNpcTextureSet | null;
  getSettlementBattleTileTexture: (tileId: SettlementBattleTileId) => Texture | null;
};

const BATTLE_SCENE_MARGIN = 22;
const BATTLE_SIDEBAR_WIDTH = 280;
const BATTLE_MIN_MAP_SCALE = 0.55;
const BATTLE_MAX_MAP_SCALE = 1.18;

type BattleMapGeometry = {
  scale: number;
  tileWidth: number;
  tileHeight: number;
  hexSideLength: number;
  rowStep: number;
  columnStep: number;
  mapWidth: number;
  mapHeight: number;
  originX: number;
  originY: number;
};

export function drawBattleModal(
  host: BattleModalHost,
  battle: BattleState | null,
  translations: TranslationPack,
  width: number,
  height: number,
): void {
  if (!battle) {
    return;
  }

  const overlay = new Container();
  host.hudLayer.addChild(overlay);
  host.drawModalBackdrop(overlay, width, height, undefined, true);

  const background = new Graphics();
  background.rect(0, 0, width, height).fill({ color: 0x061928, alpha: 0.97 });
  overlay.addChild(background);
  host.drawPanel(overlay, 0, 0, width, height, 0.34, 0);

  const headerBottom = host.drawOverlayHeader(overlay, width, translations, {
    iconId: "expedition",
    title: translations.ui.battleTitle ?? "Settlement battle",
    subtitle: `${translations.ui.round ?? "Round"} ${battle.round} - ${getTurnLabel(battle, translations)}`,
  });

  drawBattleBody(host, overlay, battle, translations, width, height, headerBottom + 16);
}

function drawBattleBody(
  host: BattleModalHost,
  parent: Container,
  battle: BattleState,
  translations: TranslationPack,
  width: number,
  height: number,
  topY: number,
): void {
  const sideWidth = Math.min(BATTLE_SIDEBAR_WIDTH, Math.max(230, Math.floor(width * 0.24)));
  const mapX = BATTLE_SCENE_MARGIN;
  const mapY = topY;
  const mapWidth = width - sideWidth - BATTLE_SCENE_MARGIN * 3;
  const mapHeight = height - topY - BATTLE_SCENE_MARGIN;
  const sideX = mapX + mapWidth + BATTLE_SCENE_MARGIN;
  const selectedUnit = battle.units.find((unit) => unit.id === battle.selectedUnitId) ?? null;

  host.drawPanel(parent, mapX, mapY, mapWidth, mapHeight, 0.32);
  drawHexMap(host, parent, battle, selectedUnit, translations, mapX, mapY, mapWidth, mapHeight);

  host.drawPanel(parent, sideX, mapY, sideWidth, mapHeight, 0.5);
  host.drawText(parent, translations.ui.battleForces ?? "Forces", sideX + 18, mapY + 18, {
    fill: uiTheme.accentStrong,
    fontSize: uiTextSize.emphasis,
    fontWeight: "900",
  });
  const unitListHeight = Math.max(120, Math.floor(mapHeight * 0.48));
  drawBattleUnitList(host, parent, battle, translations, sideX + 18, mapY + 56, sideWidth - 36, unitListHeight);
  drawBattleLog(
    host,
    parent,
    battle,
    translations,
    sideX + 18,
    mapY + 76 + unitListHeight,
    sideWidth - 36,
    Math.max(92, mapHeight - unitListHeight - 150),
  );

  host.createRectButton(parent, {
    label: translations.ui.endTurn ?? "End turn",
    x: sideX + 18,
    y: mapY + mapHeight - 48,
    width: sideWidth - 36,
    height: 34,
    detail: { action: "battle-end-turn" },
    disabled: battle.turn !== "player",
  });
}

function drawHexMap(
  host: BattleModalHost,
  parent: Container,
  battle: BattleState,
  selectedUnit: BattleUnitState | null,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const geometry = getBattleMapGeometry(x, y, width, height);
  const reachableHexes = selectedUnit &&
      battle.turn === "player" &&
      selectedUnit.side === "player" &&
      !selectedUnit.moved
    ? new Set(getBattleReachableHexes(battle, selectedUnit).map((hex) => getHexKey(hex.q, hex.r)))
    : new Set<string>();
  drawBattleTileLayers(host, parent, geometry);

  for (let q = 0; q < settlementBattleMap.width; q += 1) {
    for (let r = 0; r < settlementBattleMap.height; r += 1) {
      const center = hexToPixel(geometry, q, r);
      const occupant = battle.units.find((unit) => unit.q === q && unit.r === r);
      const reachable = reachableHexes.has(getHexKey(q, r)) && !occupant;
      const selected = selectedUnit?.q === q && selectedUnit.r === r;
      const attackable = occupant &&
        selectedUnit &&
        selectedUnit.side === "player" &&
        occupant.side === "enemy" &&
        battleCanAttack(selectedUnit, occupant);
      const tone = getBattleHexTone(Boolean(selected), Boolean(attackable), Boolean(reachable));
      const hex = drawHex(parent, center.x, center.y, geometry, tone.fill, tone.alpha, tone.stroke, tone.strokeAlpha, tone.strokeWidth);

      if (reachable) {
        host.bindAction(hex, { action: "battle-move", battleQ: q, battleR: r });
      }
    }
  }

  for (const unit of battle.units) {
    drawBattleUnitToken(host, parent, unit, selectedUnit, translations, geometry);
  }
}

function drawBattleTileLayers(
  host: BattleModalHost,
  parent: Container,
  geometry: BattleMapGeometry,
): void {
  for (const layer of settlementBattleMap.tileLayers) {
    for (const tile of layer.tiles) {
      const texture = host.getSettlementBattleTileTexture(tile.tileId);

      if (!texture) {
        continue;
      }

      const center = hexToPixel(geometry, tile.q, tile.r);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.x = center.x;
      sprite.y = center.y;
      sprite.width = geometry.tileWidth;
      sprite.height = geometry.tileHeight;
      sprite.roundPixels = true;
      parent.addChild(sprite);
    }
  }
}

function drawBattleUnitToken(
  host: BattleModalHost,
  parent: Container,
  unit: BattleUnitState,
  selectedUnit: BattleUnitState | null,
  translations: TranslationPack,
  geometry: BattleMapGeometry,
): void {
  const center = hexToPixel(geometry, unit.q, unit.r);
  const definition = combatUnitDefinitions[unit.unitId];
  const token = new Container();
  token.x = center.x;
  token.y = center.y;
  parent.addChild(token);

  const shadow = new Graphics();
  shadow.ellipse(0, geometry.tileHeight * 0.18, geometry.tileWidth * 0.16, geometry.tileHeight * 0.06).fill({ color: 0x050604, alpha: 0.36 });
  token.addChild(shadow);

  const npcKindId = combatUnitNpcKindById[unit.unitId];
  const textureSet = host.getMapNpcTextures(npcKindId);
  const unitVisual = mapNpcDefinitions[npcKindId];
  const direction = unit.side === "player" ? "east" : "west";
  const texture = textureSet?.[direction][getStableFrameIndex(unit.id, textureSet[direction].length)] ?? null;

  if (texture) {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.84);
    const visualScale = Math.max(1.08, geometry.scale * 1.32);
    sprite.width = unitVisual.renderWidth * visualScale;
    sprite.height = unitVisual.renderHeight * visualScale;
    sprite.roundPixels = true;
    token.addChild(sprite);
  } else {
    host.drawText(token, getUnitGlyph(unit.unitId), -5, -10, {
      fill: uiTheme.text,
      fontSize: uiTextSize.body,
      fontWeight: "900",
    });
  }
  if (unit.count > 1) {
    host.drawText(token, `x${unit.count}`, geometry.tileWidth * 0.12, -geometry.tileHeight * 0.38, {
      fill: unit.side === "player" ? uiTheme.accentStrong : uiTheme.warning,
      fontSize: uiTextSize.caption,
      fontWeight: "900",
    });
  }

  host.drawText(token, `${unit.hp}/${unit.maxHp}`, -16, geometry.tileHeight * 0.38, {
    fill: unit.hp < unit.maxHp ? uiTheme.warning : uiTheme.text,
    fontSize: uiTextSize.caption,
    fontWeight: "900",
  });

  host.bindTooltip(token, `${getUnitLabel(unit, translations)} x${unit.count} HP ${unit.hp}/${unit.maxHp} DMG ${getBattleUnitAttackDamage(unit)} RNG ${definition.range}`);
  host.bindAction(token, unit.side === "player"
    ? { action: "battle-select-unit", battleUnitId: unit.id }
    : { action: "battle-attack", battleUnitId: unit.id });
}

function drawBattleUnitList(
  host: BattleModalHost,
  parent: Container,
  battle: BattleState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const rowHeight = 34;
  const visibleUnits = battle.units.slice(0, Math.max(1, Math.floor(height / rowHeight)));
  visibleUnits.forEach((unit, index) => {
    const rowY = y + index * 34;
    const fill = unit.side === "player" ? uiTheme.accentStrong : uiTheme.negative;
    const label = `${getUnitLabel(unit, translations)}${unit.count > 1 ? ` x${unit.count}` : ""}`;
    host.drawText(parent, label, x, rowY, {
      fill,
      fontSize: uiTextSize.caption,
      fontWeight: "900",
      wordWrap: true,
      wordWrapWidth: width - 56,
    });
    host.drawText(parent, `${unit.hp}/${unit.maxHp}`, x + width - 48, rowY, {
      fill: uiTheme.text,
      fontSize: uiTextSize.caption,
      fontWeight: "900",
    });
  });

  if (battle.units.length > visibleUnits.length) {
    host.drawText(parent, `+${battle.units.length - visibleUnits.length}`, x, y + visibleUnits.length * rowHeight, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.caption,
      fontWeight: "900",
    });
  }
}

function drawBattleLog(
  host: BattleModalHost,
  parent: Container,
  battle: BattleState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  host.drawText(parent, translations.ui.battleLog ?? "Battle log", x, y, {
    fill: uiTheme.accentStrong,
    fontSize: uiTextSize.emphasis,
    fontWeight: "900",
  });

  if (battle.log.length === 0) {
    host.drawText(parent, translations.ui.battleLogEmpty ?? "No blows exchanged yet.", x, y + 34, {
      fill: uiTheme.textMuted,
      fontSize: uiTextSize.caption,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: width,
    });
    return;
  }

  const rowHeight = 30;
  const visibleRows = battle.log.slice(0, Math.max(1, Math.floor((height - 32) / rowHeight)));
  visibleRows.forEach((entry, index) => {
    host.drawText(parent, formatBattleLogEntry(entry, translations), x, y + 32 + index * rowHeight, {
      fill: index === 0 ? uiTheme.text : uiTheme.textMuted,
      fontSize: uiTextSize.caption,
      fontWeight: "800",
      wordWrap: true,
      wordWrapWidth: width,
    });
  });
}

function drawHex(
  parent: Container,
  x: number,
  y: number,
  geometry: BattleMapGeometry,
  fill: number,
  alpha: number,
  stroke = uiTheme.border,
  strokeAlpha = 0.45,
  strokeWidth = 1,
): Container {
  const hex = new Container();
  hex.x = x;
  hex.y = y;
  parent.addChild(hex);

  const shape = new Graphics();
  const points = getTiledHexPoints(geometry);
  shape.poly(points).fill({ color: fill, alpha }).stroke({ color: stroke, alpha: strokeAlpha, width: strokeWidth });
  hex.addChild(shape);

  return hex;
}

function getBattleHexTone(
  selected: boolean,
  attackable: boolean,
  reachable: boolean,
): { fill: number; alpha: number; stroke: number; strokeAlpha: number; strokeWidth: number } {
  if (selected) {
    return {
      fill: uiTheme.accent,
      alpha: 0.34,
      stroke: uiTheme.accentStrong,
      strokeAlpha: 0.96,
      strokeWidth: 2,
    };
  }

  if (attackable) {
    return {
      fill: uiTheme.warning,
      alpha: 0.24,
      stroke: uiTheme.warning,
      strokeAlpha: 0.9,
      strokeWidth: 2,
    };
  }

  if (reachable) {
    return {
      fill: uiTheme.accent,
      alpha: 0.24,
      stroke: uiTheme.accent,
      strokeAlpha: 0.72,
      strokeWidth: 1,
    };
  }

  return {
    fill: uiTheme.surfaceSunken,
    alpha: 0.03,
    stroke: uiTheme.border,
    strokeAlpha: 0.45,
    strokeWidth: 1,
  };
}

function hexToPixel(geometry: BattleMapGeometry, q: number, r: number): { x: number; y: number } {
  if (settlementBattleMap.staggerAxis === "y") {
    const rowStaggered = isStaggered(r);
    return {
      x: geometry.originX + q * geometry.tileWidth + (rowStaggered ? geometry.tileWidth / 2 : 0) + geometry.tileWidth / 2,
      y: geometry.originY + r * geometry.rowStep + geometry.tileHeight / 2,
    };
  }

  const columnStaggered = isStaggered(q);
  return {
    x: geometry.originX + q * geometry.columnStep + geometry.tileWidth / 2,
    y: geometry.originY + r * geometry.tileHeight + (columnStaggered ? geometry.tileHeight / 2 : 0) + geometry.tileHeight / 2,
  };
}

function getBattleMapGeometry(x: number, y: number, width: number, height: number): BattleMapGeometry {
  const rawTileWidth = settlementBattleMap.tileWidth;
  const rawTileHeight = settlementBattleMap.tileHeight;
  const rawHexSideLength = Math.max(0, settlementBattleMap.hexSideLength);
  const rawRowStep = settlementBattleMap.staggerAxis === "y"
    ? (rawTileHeight + rawHexSideLength) / 2
    : rawTileHeight;
  const rawColumnStep = settlementBattleMap.staggerAxis === "x"
    ? (rawTileWidth + rawHexSideLength) / 2
    : rawTileWidth;
  const rawMapWidth = settlementBattleMap.staggerAxis === "y"
    ? rawTileWidth * settlementBattleMap.width + (settlementBattleMap.height > 1 ? rawTileWidth / 2 : 0)
    : rawColumnStep * Math.max(0, settlementBattleMap.width - 1) + rawTileWidth;
  const rawMapHeight = settlementBattleMap.staggerAxis === "y"
    ? rawRowStep * Math.max(0, settlementBattleMap.height - 1) + rawTileHeight
    : rawTileHeight * settlementBattleMap.height + (settlementBattleMap.width > 1 ? rawTileHeight / 2 : 0);
  const scale = Math.max(
    BATTLE_MIN_MAP_SCALE,
    Math.min(BATTLE_MAX_MAP_SCALE, Math.min(width / rawMapWidth, height / rawMapHeight)),
  );
  const tileWidth = rawTileWidth * scale;
  const tileHeight = rawTileHeight * scale;
  const hexSideLength = rawHexSideLength * scale;
  const rowStep = rawRowStep * scale;
  const columnStep = rawColumnStep * scale;
  const mapWidth = rawMapWidth * scale;
  const mapHeight = rawMapHeight * scale;

  return {
    scale,
    tileWidth,
    tileHeight,
    hexSideLength,
    rowStep,
    columnStep,
    mapWidth,
    mapHeight,
    originX: x + (width - mapWidth) / 2,
    originY: y + (height - mapHeight) / 2,
  };
}

function getTiledHexPoints(geometry: BattleMapGeometry): number[] {
  if (settlementBattleMap.staggerAxis === "y") {
    const halfWidth = geometry.tileWidth / 2;
    const halfHeight = geometry.tileHeight / 2;
    const halfSide = geometry.hexSideLength / 2;

    return [
      0, -halfHeight,
      halfWidth, -halfSide,
      halfWidth, halfSide,
      0, halfHeight,
      -halfWidth, halfSide,
      -halfWidth, -halfSide,
    ];
  }

  const halfWidth = geometry.tileWidth / 2;
  const halfHeight = geometry.tileHeight / 2;
  const halfSide = geometry.hexSideLength / 2;

  return [
    -halfSide, -halfHeight,
    halfSide, -halfHeight,
    halfWidth, 0,
    halfSide, halfHeight,
    -halfSide, halfHeight,
    -halfWidth, 0,
  ];
}

function isStaggered(index: number): boolean {
  return settlementBattleMap.staggerIndex === "odd"
    ? index % 2 === 1
    : index % 2 === 0;
}

function battleCanAttack(attacker: BattleUnitState, target: BattleUnitState): boolean {
  return !attacker.acted && isInAttackRange(attacker, target);
}

function getTurnLabel(battle: BattleState, translations: TranslationPack): string {
  return battle.turn === "player"
    ? translations.ui.playerTurn ?? "Player turn"
    : translations.ui.enemyTurn ?? "Enemy turn";
}

function getUnitLabel(unit: BattleUnitState, translations: TranslationPack): string {
  return getUnitIdLabel(unit.unitId, translations);
}

function getUnitIdLabel(unitId: CombatUnitId, translations: TranslationPack): string {
  return translations.roles[combatUnitDefinitions[unitId].nameKey] ?? unitId;
}

function formatBattleLogEntry(entry: BattleLogEntry, translations: TranslationPack): string {
  if (entry.key === "text") {
    return entry.text ?? "";
  }

  if (entry.key === "initiative") {
    return entry.side === "enemy"
      ? translations.ui.battleLogInitiativeEnemy ?? "The settlement defenders seized the initiative."
      : translations.ui.battleLogInitiativePlayer ?? "Your force seized the initiative.";
  }

  const losses = Math.max(0, Math.floor(entry.losses ?? 0));
  const lossesText = losses > 0
    ? formatTemplate(translations.ui.battleLogLosses ?? ", {losses} lost", { losses })
    : "";

  return formatTemplate(
    translations.ui.battleLogHit ?? "{attacker} x{attackerCount} hit {target} x{targetCount}: -{damage}{lossesText}",
    {
      attacker: getUnitIdLabel(entry.attackerUnitId ?? "footman", translations),
      attackerCount: Math.max(1, Math.floor(entry.attackerCount ?? 1)),
      target: getUnitIdLabel(entry.targetUnitId ?? "rat", translations),
      targetCount: Math.max(1, Math.floor(entry.targetCount ?? 1)),
      damage: Math.max(0, Math.floor(entry.damage ?? 0)),
      lossesText,
    },
  );
}

function getUnitGlyph(unitId: string): string {
  if (unitId === "archer") {
    return "A";
  }
  if (unitId === "bulwark") {
    return "B";
  }
  if (unitId === "rat") {
    return "R";
  }
  if (unitId === "spider") {
    return "S";
  }
  if (unitId === "snake") {
    return "H";
  }
  if (unitId === "wolf") {
    return "W";
  }
  if (unitId === "zombie") {
    return "Z";
  }
  if (unitId === "bandit") {
    return "N";
  }
  if (unitId === "berserkerZombie") {
    return "BZ";
  }
  return "F";
}

function getStableFrameIndex(value: string, frameCount: number): number {
  if (frameCount <= 1) {
    return 0;
  }

  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % frameCount;
}

function getHexKey(q: number, r: number): string {
  return `${q}:${r}`;
}
