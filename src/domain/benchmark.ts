import { rsi } from './indicators'
import type { BenchmarkStats, Candle, Trade } from './types'

function pct(value: number) {
  return Number(value.toFixed(2))
}

export function runNaiveRsiBenchmark(candles: Candle[]): BenchmarkStats {
  let cash = 10000
  let position: { entryPrice: number; units: number; sizeUsd: number } | null = null
  let peakEquity = cash
  let maxDrawdownPct = 0
  const trades: Trade[] = []

  for (let index = 15; index < candles.length; index += 1) {
    const candle = candles[index]
    const history = candles.slice(0, index + 1)
    const value = rsi(history)

    if (!position && value < 35) {
      const sizeUsd = cash
      position = {
        entryPrice: candle.close,
        units: sizeUsd / candle.close,
        sizeUsd,
      }
      cash = 0
    } else if (position && value > 65) {
      const exitValue = position.units * candle.close
      const pnlUsd = exitValue - position.sizeUsd
      cash = exitValue
      trades.push({
        entryTime: '',
        exitTime: candle.time,
        entryPrice: position.entryPrice,
        exitPrice: candle.close,
        sizeUsd: position.sizeUsd,
        pnlUsd,
        pnlPct: (pnlUsd / position.sizeUsd) * 100,
        strategy: 'Mean Reversion',
        exitReason: 'RSI > 65',
      })
      position = null
    }

    const equity = cash + (position ? position.units * candle.close : 0)
    peakEquity = Math.max(peakEquity, equity)
    maxDrawdownPct = Math.max(maxDrawdownPct, peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100)
  }

  if (position) {
    const last = candles[candles.length - 1]
    const exitValue = position.units * last.close
    const pnlUsd = exitValue - position.sizeUsd
    cash = exitValue
    trades.push({
      entryTime: '',
      exitTime: last.time,
      entryPrice: position.entryPrice,
      exitPrice: last.close,
      sizeUsd: position.sizeUsd,
      pnlUsd,
      pnlPct: (pnlUsd / position.sizeUsd) * 100,
      strategy: 'Mean Reversion',
      exitReason: 'final close',
    })
  }

  const wins = trades.filter((trade) => trade.pnlUsd > 0)

  return {
    name: 'Naive RSI 35/65',
    totalReturnPct: pct(((cash - 10000) / 10000) * 100),
    maxDrawdownPct: pct(maxDrawdownPct),
    tradeCount: trades.length,
    winRatePct: trades.length === 0 ? 0 : pct((wins.length / trades.length) * 100),
  }
}
