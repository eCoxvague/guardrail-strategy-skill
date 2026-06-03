import type { Candle, MarketDataSource, SymbolId } from './types'
import { cmcMarketCache, cmcMarketCacheMeta } from './cmcCache'

const profiles: Record<SymbolId, { start: number; drift: number; volatility: number; volume: number; cap: number }> = {
  BNB: { start: 610, drift: 0.0018, volatility: 0.024, volume: 1250000000, cap: 93000000000 },
  CAKE: { start: 2.85, drift: 0.0012, volatility: 0.042, volume: 82000000, cap: 850000000 },
  TWT: { start: 1.22, drift: 0.0015, volatility: 0.036, volume: 61000000, cap: 510000000 },
}

function seededNoise(seed: number) {
  const x = Math.sin(seed * 999) * 10000
  return x - Math.floor(x)
}

export function getMarketData(symbol: SymbolId): Candle[] {
  const cached = cmcMarketCache[symbol]
  if (cached && cached.length >= 40) {
    return cached
  }

  const profile = profiles[symbol]
  const startDate = new Date('2025-12-01T00:00:00Z')
  const candles: Candle[] = []
  let close = profile.start

  for (let index = 0; index < 186; index += 1) {
    const date = new Date(startDate)
    date.setUTCDate(startDate.getUTCDate() + index)

    const cycle = Math.sin(index / 9) * profile.volatility * 0.75
    const impulse = index > 56 && index < 96 ? profile.volatility * 0.42 : 0
    const riskOff = index > 122 && index < 146 ? -profile.volatility * 0.68 : 0
    const rebound = index > 152 ? profile.volatility * 0.36 : 0
    const noise = (seededNoise(index + symbol.charCodeAt(0)) - 0.5) * profile.volatility
    const returnPct = profile.drift + cycle + impulse + riskOff + rebound + noise

    const open = close
    close = Math.max(0.01, close * (1 + returnPct))
    const spread = Math.abs(returnPct) + profile.volatility * (0.55 + seededNoise(index + 7) * 0.8)
    const high = Math.max(open, close) * (1 + spread * 0.45)
    const low = Math.min(open, close) * (1 - spread * 0.45)
    const volumeShock = 1 + Math.abs(returnPct) * 12 + seededNoise(index + 31) * 0.55

    candles.push({
      time: date.toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume: profile.volume * volumeShock,
      marketCap: profile.cap * (close / profile.start),
    })
  }

  return candles
}

export function getMarketDataSource(symbol: SymbolId): MarketDataSource {
  const cached = cmcMarketCache[symbol]
  const meta = cmcMarketCacheMeta[symbol]

  if (cached && cached.length >= 40 && meta) {
    return meta
  }

  return {
    provider: 'Demo',
    mode: 'deterministic-sample',
    candles: getMarketData(symbol).length,
    note: 'Deterministic sample data is active because no CoinMarketCap cache is available for this symbol.',
  }
}
