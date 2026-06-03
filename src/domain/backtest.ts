import { createSignal, riskConfigs } from './agent'
import { runNaiveRsiBenchmark } from './benchmark'
import { clamp } from './indicators'
import type {
  AgentDecision,
  BacktestResult,
  Candle,
  EquityPoint,
  RiskMode,
  SymbolId,
  Trade,
  TradeSignal,
} from './types'

type OpenPosition = {
  entryTime: string
  entryPrice: number
  units: number
  sizeUsd: number
  signal: TradeSignal
}

function pct(value: number) {
  return Number(value.toFixed(2))
}

function calculateSharpeLike(points: EquityPoint[]) {
  const returns = points.slice(1).map((point, index) => point.equity / points[index].equity - 1)
  const average = returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1)
  const variance =
    returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(returns.length - 1, 1)
  const deviation = Math.sqrt(variance)
  return deviation === 0 ? 0 : pct((average / deviation) * Math.sqrt(365))
}

export function runBacktest(symbol: SymbolId, candles: Candle[], mode: RiskMode): BacktestResult {
  const risk = riskConfigs[mode]
  let cash = 10000
  let position: OpenPosition | null = null
  let peakEquity = cash
  let lossesInRow = 0
  let cooldown = 0
  let riskBlocks = 0
  let daysInMarket = 0

  const trades: Trade[] = []
  const equityCurve: EquityPoint[] = []
  const decisions: AgentDecision[] = []

  for (let index = 36; index < candles.length; index += 1) {
    const candle = candles[index]
    const history = candles.slice(0, index + 1)
    const signal = createSignal(history, symbol, risk)
    let action = signal.action
    let approved = true
    let reason = signal.reason
    let equity = cash + (position ? position.units * candle.close : 0)
    peakEquity = Math.max(peakEquity, equity)
    const drawdownPct = peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100

    if (position) {
      daysInMarket += 1
      const stopPrice = position.entryPrice * (1 - position.signal.stopLossPct / 100)
      const takePrice = position.entryPrice * (1 + position.signal.takeProfitPct / 100)
      const shouldStop = candle.low <= stopPrice
      const shouldTake = candle.high >= takePrice
      const shouldSell = signal.action === 'sell'

      if (shouldStop || shouldTake || shouldSell) {
        const exitPrice = shouldStop ? stopPrice : shouldTake ? takePrice : candle.close
        const exitValue = position.units * exitPrice
        const pnlUsd = exitValue - position.sizeUsd
        cash += exitValue
        trades.push({
          entryTime: position.entryTime,
          exitTime: candle.time,
          entryPrice: position.entryPrice,
          exitPrice,
          sizeUsd: position.sizeUsd,
          pnlUsd,
          pnlPct: (pnlUsd / position.sizeUsd) * 100,
          strategy: position.signal.strategy,
          exitReason: shouldStop ? 'stop loss' : shouldTake ? 'take profit' : 'router sell',
        })
        lossesInRow = pnlUsd < 0 ? lossesInRow + 1 : 0
        cooldown = pnlUsd < 0 ? risk.cooldownAfterLosses : 0
        position = null
        action = 'sell'
        reason = shouldStop ? 'Stop loss protected the account.' : shouldTake ? 'Take profit locked the move.' : reason
      }
    } else if (cooldown > 0) {
      approved = false
      action = 'hold'
      reason = 'Cooldown active after a losing trade.'
      cooldown -= 1
      riskBlocks += 1
    } else if (drawdownPct > risk.maxDrawdownPct) {
      approved = false
      action = 'hold'
      reason = 'Max drawdown guard blocked new exposure.'
      riskBlocks += 1
    } else if (signal.action === 'buy' && signal.confidence < risk.minConfidence) {
      approved = false
      action = 'hold'
      reason = 'Signal confidence did not clear the risk governor.'
      riskBlocks += 1
    } else if (signal.action === 'buy') {
      const sizeUsd = cash * signal.positionPct
      position = {
        entryTime: candle.time,
        entryPrice: candle.close,
        units: sizeUsd / candle.close,
        sizeUsd,
        signal,
      }
      cash -= sizeUsd
    }

    equity = cash + (position ? position.units * candle.close : 0)
    peakEquity = Math.max(peakEquity, equity)
    const updatedDrawdownPct = peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100
    const riskScore = clamp(100 - updatedDrawdownPct * 4 - lossesInRow * 12 - (signal.regime === 'High Volatility' ? 14 : 0), 0, 100)

    equityCurve.push({
      time: candle.time,
      price: candle.close,
      equity,
      drawdownPct: updatedDrawdownPct,
      action,
    })
    decisions.push({
      time: candle.time,
      symbol,
      action,
      strategy: signal.strategy,
      regime: signal.regime,
      confidence: signal.confidence,
      approved,
      riskScore,
      reason,
    })
  }

  if (position) {
    const last = candles[candles.length - 1]
    const exitValue = position.units * last.close
    const pnlUsd = exitValue - position.sizeUsd
    trades.push({
      entryTime: position.entryTime,
      exitTime: last.time,
      entryPrice: position.entryPrice,
      exitPrice: last.close,
      sizeUsd: position.sizeUsd,
      pnlUsd,
      pnlPct: (pnlUsd / position.sizeUsd) * 100,
      strategy: position.signal.strategy,
      exitReason: 'final close',
    })
  }

  const startEquity = 10000
  const endEquity = equityCurve[equityCurve.length - 1]?.equity ?? startEquity
  const wins = trades.filter((trade) => trade.pnlUsd > 0)
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnlUsd, 0)
  const grossLoss = Math.abs(trades.filter((trade) => trade.pnlUsd < 0).reduce((sum, trade) => sum + trade.pnlUsd, 0))
  const maxDrawdownPct = Math.max(...equityCurve.map((point) => point.drawdownPct), 0)
  const currentSignal = createSignal(candles, symbol, risk)

  return {
    symbol,
    benchmark: runNaiveRsiBenchmark(candles),
    equityCurve,
    trades,
    decisions,
    currentSignal,
    stats: {
      totalReturnPct: pct(((endEquity - startEquity) / startEquity) * 100),
      maxDrawdownPct: pct(maxDrawdownPct),
      winRatePct: trades.length === 0 ? 0 : pct((wins.length / trades.length) * 100),
      profitFactor: grossLoss === 0 ? pct(grossProfit) : pct(grossProfit / grossLoss),
      tradeCount: trades.length,
      exposurePct: pct((daysInMarket / Math.max(equityCurve.length, 1)) * 100),
      riskBlocks,
      sharpeLike: calculateSharpeLike(equityCurve),
    },
    thesis: [
      'CoinMarketCap-ready OHLCV input is converted into market regime labels.',
      'The strategy router selects momentum, mean reversion, breakout, or no-trade behavior.',
      'The risk governor can override entries using drawdown, confidence, cooldown, and position limits.',
      'Every action is logged with a plain-English rationale for judges and strategy reviewers.',
    ],
  }
}
