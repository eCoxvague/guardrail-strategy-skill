import type { Candle } from './types'

export function mean(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function sma(candles: Candle[], period: number) {
  if (candles.length < period) return mean(candles.map((candle) => candle.close))
  return mean(candles.slice(-period).map((candle) => candle.close))
}

export function rsi(candles: Candle[], period = 14) {
  if (candles.length <= period) return 50
  const slice = candles.slice(-(period + 1))
  let gains = 0
  let losses = 0

  for (let index = 1; index < slice.length; index += 1) {
    const change = slice[index].close - slice[index - 1].close
    if (change >= 0) gains += change
    else losses += Math.abs(change)
  }

  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

export function atrPct(candles: Candle[], period = 14) {
  if (candles.length <= period) return 0
  const slice = candles.slice(-(period + 1))
  const ranges: number[] = []

  for (let index = 1; index < slice.length; index += 1) {
    const candle = slice[index]
    const previousClose = slice[index - 1].close
    const trueRange = Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    )
    ranges.push(trueRange / candle.close)
  }

  return mean(ranges) * 100
}

export function slopePct(candles: Candle[], period = 20) {
  if (candles.length < period) return 0
  const slice = candles.slice(-period)
  const first = slice[0].close
  const last = slice[slice.length - 1].close
  return ((last - first) / first) * 100
}

export function volumeRatio(candles: Candle[], period = 20) {
  if (candles.length < period + 1) return 1
  const latest = candles[candles.length - 1].volume
  const baseline = mean(candles.slice(-(period + 1), -1).map((candle) => candle.volume))
  return baseline === 0 ? 1 : latest / baseline
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
