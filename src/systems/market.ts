import { gameConfig } from "../game/config";
import { GAME_HOUR_REAL_SECONDS } from "../game/time";
import type { GameState, MarketResourceId, ResourceId } from "../game/types";
import { pushLocalizedLog } from "./log";

export const MARKET_TRADE_COOLDOWN_SECONDS =
  gameConfig.market.tradeCooldownHours * GAME_HOUR_REAL_SECONDS;
export const marketResourceIds: MarketResourceId[] = ["food", "water", "material", "coal"];

const MARKET_TRADE_LIMIT_BY_LEVEL = [0, 100, 120, 150, 180, 200];
const MARKET_EXTRA_TRADE_LEVEL = 5;
const MARKET_MIN_COOLDOWN_HOURS = 0.5;

export function normalizeMarketState(state: GameState): void {
  state.market = {
    cooldownRemainingSeconds: Math.max(
      0,
      Math.floor(state.market?.cooldownRemainingSeconds ?? 0),
    ),
    tradesUsed: Math.max(0, Math.floor(state.market?.tradesUsed ?? 0)),
  };

  if (state.market.cooldownRemainingSeconds > 0) {
    state.market.tradesUsed = 0;
  }
}

export function tickMarket(state: GameState, deltaSeconds: number): void {
  if (state.market.cooldownRemainingSeconds <= 0) {
    return;
  }

  state.market.cooldownRemainingSeconds = Math.max(
    0,
    state.market.cooldownRemainingSeconds - deltaSeconds,
  );
}

export function getMarketTradeLimit(level: number): number {
  return MARKET_TRADE_LIMIT_BY_LEVEL[Math.max(0, Math.min(5, Math.floor(level)))] ?? 0;
}

export function getMarketTradeSlots(level: number): number {
  return level >= MARKET_EXTRA_TRADE_LEVEL ? 2 : 1;
}

export function getMarketTradeCooldownSeconds(level: number): number {
  if (level <= 0) {
    return MARKET_TRADE_COOLDOWN_SECONDS;
  }

  const clampedLevel = Math.max(1, Math.min(5, Math.floor(level)));
  const reductionProgress = (clampedLevel - 1) / 4;
  const cooldownHours = gameConfig.market.tradeCooldownHours -
    (gameConfig.market.tradeCooldownHours - MARKET_MIN_COOLDOWN_HOURS) * reductionProgress;

  return Math.max(MARKET_MIN_COOLDOWN_HOURS, cooldownHours) * GAME_HOUR_REAL_SECONDS;
}

export function getAvailableMarketTrades(state: GameState): number {
  const marketLevel = state.buildings.market.level;

  if (
    marketLevel <= 0 ||
    state.buildings.market.upgradingRemaining > 0 ||
    state.market.cooldownRemainingSeconds > 0
  ) {
    return 0;
  }

  return Math.max(0, getMarketTradeSlots(marketLevel) - state.market.tradesUsed);
}

export function getMarketTradeCapacity(
  state: GameState,
  fromResourceId: ResourceId,
  toResourceId: ResourceId,
): number {
  if (!isMarketResourceId(fromResourceId) || !isMarketResourceId(toResourceId)) {
    return 0;
  }

  const marketLevel = state.buildings.market.level;
  const tradeLimit = getMarketTradeLimit(marketLevel);
  const availableSource = Math.floor(state.resources[fromResourceId]);
  const freeTargetCapacity = Math.floor(
    state.capacities[toResourceId] - state.resources[toResourceId],
  );

  return Math.max(0, Math.min(tradeLimit, availableSource, freeTargetCapacity));
}

export function canTradeAtMarket(
  state: GameState,
  fromResourceId: ResourceId,
  toResourceId: ResourceId,
  amount: number,
): boolean {
  const normalizedAmount = Math.floor(amount);

  return getAvailableMarketTrades(state) > 0 &&
    fromResourceId !== toResourceId &&
    normalizedAmount > 0 &&
    normalizedAmount <= getMarketTradeCapacity(state, fromResourceId, toResourceId);
}

export function tradeAtMarket(
  state: GameState,
  fromResourceId: ResourceId,
  toResourceId: ResourceId,
  amount: number,
): boolean {
  const normalizedAmount = Math.floor(amount);
  const marketLevel = state.buildings.market.level;

  if (!canTradeAtMarket(state, fromResourceId, toResourceId, normalizedAmount)) {
    return false;
  }

  state.resources[fromResourceId] -= normalizedAmount;
  state.resources[toResourceId] += normalizedAmount;
  state.market.tradesUsed += 1;

  if (getAvailableMarketTrades(state) <= 0) {
    state.market.cooldownRemainingSeconds = getMarketTradeCooldownSeconds(marketLevel);
    state.market.tradesUsed = 0;
  }

  pushLocalizedLog(state, "logMarketTrade", {
    amount: normalizedAmount,
    fromResourceId,
    toResourceId,
  });
  return true;
}

export function isMarketResourceId(resourceId: ResourceId): resourceId is MarketResourceId {
  return marketResourceIds.includes(resourceId as MarketResourceId);
}
