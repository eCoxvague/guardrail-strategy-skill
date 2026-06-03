import { atrPct, clamp, rsi, slopePct, sma, volumeRatio } from './indicators'
import type { Candle, MarketRegime, RiskConfig, RiskMode, StrategyId, SymbolId, TradeSignal } from './types'

export const riskConfigs: Record<RiskMode, RiskConfig> = {
  defensive: {
    maxDrawdownPct: 8,
    maxPositionPct: 0.22,
    minConfidence: 0.64,
    stopLossPct: 2.4,
    takeProfitPct: 5.2,
    cooldownAfterLosses: 1,
  },
  balanced: {
    maxDrawdownPct: 12,
    maxPositionPct: 0.34,
    minConfidence: 0.58,
    stopLossPct: 3.2,
    takeProfitPct: 7,
    cooldownAfterLosses: 2,
  },
  growth: {
    maxDrawdownPct: 16,
    maxPositionPct: 0.48,
    minConfidence: 0.54,
    stopLossPct: 4.4,
    takeProfitPct: 9.5,
    cooldownAfterLosses: 2,
  },
}

export function classifyRegime(candles: Candle[]): MarketRegime {
  const latest = candles[candles.length - 1]
  const atr = atrPct(candles)
  const trend = slopePct(candles)
  const ratio = volumeRatio(candles)
  const shortAverage = sma(candles, 12)
  const longAverage = sma(candles, 34)

  if (latest.volume < 35000000 || ratio < 0.42) return 'Low Liquidity'
  if (atr > 6.2) return 'High Volatility'
  if (trend < -10 && latest.close < longAverage) return 'Risk-Off'
  if (shortAverage > longAverage && trend > 4) return 'Trend Expansion'
  return 'Range Rotation'
}

export function createSignal(candles: Candle[], symbol: SymbolId, risk: RiskConfig): TradeSignal {
  const regime = classifyRegime(candles)
  const momentum = slopePct(candles)
  const relativeStrength = rsi(candles)
  const atr = atrPct(candles)
  const volume = volumeRatio(candles)
  const latest = candles[candles.length - 1]
  const shortAverage = sma(candles, 10)
  const longAverage = sma(candles, 30)

  let strategy: StrategyId = 'Capital Preservation'
  let action: TradeSignal['action'] = 'hold'
  let confidence = 0.48
  let reason = 'No edge strong enough after regime and risk checks.'

  if (regime === 'Trend Expansion') {
    strategy = 'Momentum Follow'
    action = relativeStrength < 76 && latest.close > shortAverage ? 'buy' : 'hold'
    confidence = clamp(0.57 + momentum / 42 + (volume - 1) * 0.08, 0.45, 0.9)
    reason = 'Short average is above long average, price confirms trend, and volume supports continuation.'
  }

  if (regime === 'Range Rotation') {
    strategy = 'Mean Reversion'
    action = relativeStrength < 42 && latest.close < shortAverage ? 'buy' : relativeStrength > 68 ? 'sell' : 'hold'
    confidence = clamp(0.52 + Math.abs(50 - relativeStrength) / 90 + Math.max(0, 2.8 - atr) * 0.04, 0.43, 0.84)
    reason = 'Market is rotating inside a range, so the skill buys weakness and sells stretched moves.'
  }

  if (regime === 'High Volatility') {
    strategy = 'Volatility Breakout'
    action = latest.close > longAverage && relativeStrength < 72 && volume > 1.35 ? 'buy' : 'hold'
    confidence = clamp(0.5 + (volume - 1) * 0.12 - atr * 0.025, 0.38, 0.78)
    reason = 'Volatility is elevated; only confirmed breakouts are allowed and position size is reduced.'
  }

  if (regime === 'Risk-Off' || regime === 'Low Liquidity') {
    strategy = 'Capital Preservation'
    action = 'hold'
    confidence = 0.72
    reason =
      regime === 'Risk-Off'
        ? 'Trend and price structure are deteriorating, so capital preservation overrides entries.'
        : 'Liquidity is too thin for a reliable backtestable signal.'
  }

  if (symbol === 'CAKE' && strategy === 'Mean Reversion') {
    confidence = clamp(confidence + 0.04, 0, 0.9)
  }

  return {
    action,
    confidence,
    strategy,
    regime,
    reason,
    positionPct: Math.min(risk.maxPositionPct, clamp(confidence - 0.32, 0.08, risk.maxPositionPct)),
    stopLossPct: risk.stopLossPct,
    takeProfitPct: risk.takeProfitPct,
  }
}
