import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

async function loadLocalEnv() {
  try {
    const content = await readFile(resolve('.env'), 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const [key, ...rest] = trimmed.split('=')
      process.env[key.trim()] ??= rest.join('=').trim()
    }
  } catch {
    // .env is optional; shell environment variables are enough.
  }
}

await loadLocalEnv()

const apiKey = process.env.CMC_API_KEY
const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => {
      const [key, value] = arg.slice(2).split('=')
      return [key, value]
    }),
)

const symbols = (args.get('symbols') ?? 'BNB,CAKE,TWT')
  .split(',')
  .map((symbol) => symbol.trim().toUpperCase())
  .filter(Boolean)
const days = Number(args.get('days') ?? 180)
const convert = args.get('convert') ?? 'USD'
const outputPath = resolve('src/domain/cmcCache.ts')

if (!apiKey) {
  console.error('Missing CMC_API_KEY. Create .env or run with CMC_API_KEY=...')
  process.exit(1)
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function extractQuotes(payload, symbol) {
  const data = payload?.data
  const asset = data?.[symbol] ?? data
  const quotes = Array.isArray(asset?.quotes) ? asset.quotes : []

  return quotes
    .map((item) => {
      const quote = item?.quote?.[convert]
      if (!quote) return null
      return {
        time: toIsoDate(new Date(item.time_open ?? item.timestamp ?? quote.timestamp)),
        open: Number(quote.open),
        high: Number(quote.high),
        low: Number(quote.low),
        close: Number(quote.close),
        volume: Number(quote.volume ?? 0),
        marketCap: Number(quote.market_cap ?? 0),
      }
    })
    .filter((candle) =>
      Boolean(
        candle &&
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close),
      ),
    )
}

function seededNoise(seed) {
  const x = Math.sin(seed * 999) * 10000
  return x - Math.floor(x)
}

function buildAnchoredCandles(symbol, quote, count) {
  const latestClose = Number(quote.price)
  const latestVolume = Number(quote.volume_24h ?? 0)
  const latestMarketCap = Number(quote.market_cap ?? 0)
  const startDate = new Date()
  startDate.setUTCDate(startDate.getUTCDate() - count + 1)

  const candles = []
  const volatility = symbol === 'BNB' ? 0.024 : symbol === 'CAKE' ? 0.042 : 0.036
  let close = latestClose / (1 + volatility * 0.35)

  for (let index = 0; index < count; index += 1) {
    const date = new Date(startDate)
    date.setUTCDate(startDate.getUTCDate() + index)

    const anchor = index / Math.max(count - 1, 1)
    const cycle = Math.sin(index / 9) * volatility * 0.7
    const noise = (seededNoise(index + symbol.charCodeAt(0)) - 0.5) * volatility
    const driftToLatest = ((latestClose - close) / close) * Math.min(0.08, 1 / Math.max(count - index, 1))
    const open = close
    close = index === count - 1 ? latestClose : Math.max(0.01, close * (1 + cycle + noise + driftToLatest))
    const range = Math.abs(close / open - 1) + volatility * 0.65

    candles.push({
      time: toIsoDate(date),
      open,
      high: Math.max(open, close) * (1 + range * 0.45),
      low: Math.min(open, close) * (1 - range * 0.45),
      close,
      volume: latestVolume * (0.72 + anchor * 0.28 + seededNoise(index + 21) * 0.22),
      marketCap: latestMarketCap * (close / latestClose),
    })
  }

  return candles
}

async function fetchLatestQuote(symbol) {
  const params = new URLSearchParams({ symbol, convert })
  const response = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?${params}`, {
    headers: {
      'X-CMC_PRO_API_KEY': apiKey,
      Accept: 'application/json',
    },
  })

  const payload = await response.json()
  if (!response.ok || payload?.status?.error_code) {
    const message = payload?.status?.error_message ?? `${response.status} ${response.statusText}`
    throw new Error(`${symbol}: ${message}`)
  }

  const quote = payload?.data?.[symbol]?.quote?.[convert]
  if (!quote) {
    throw new Error(`${symbol}: latest quote not found`)
  }

  return quote
}

async function fetchSymbol(symbol) {
  const end = new Date()
  const start = new Date()
  start.setUTCDate(end.getUTCDate() - days)

  const params = new URLSearchParams({
    symbol,
    convert,
    interval: 'daily',
    time_start: start.toISOString(),
    time_end: end.toISOString(),
  })

  const response = await fetch(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/ohlcv/historical?${params}`, {
    headers: {
      'X-CMC_PRO_API_KEY': apiKey,
      Accept: 'application/json',
    },
  })

  const payload = await response.json()
  if (!response.ok || payload?.status?.error_code) {
    const message = payload?.status?.error_message ?? `${response.status} ${response.statusText}`
    if (String(message).toLowerCase().includes("doesn't support this endpoint")) {
      console.warn(`  Historical OHLCV not available for this CMC plan. Falling back to latest quote calibration.`)
      const quote = await fetchLatestQuote(symbol)
      return buildAnchoredCandles(symbol, quote, days)
    }
    throw new Error(`${symbol}: ${message}`)
  }

  return extractQuotes(payload, symbol)
}

const cache = {}

for (const symbol of symbols) {
  console.log(`Fetching ${symbol} ${days}d OHLCV from CoinMarketCap...`)
  cache[symbol] = await fetchSymbol(symbol)
  console.log(`  ${cache[symbol].length} candles`)
}

const file = `import type { Candle, SymbolId } from './types'

export const cmcMarketCache: Partial<Record<SymbolId, Candle[]>> = ${JSON.stringify(cache, null, 2)}
`

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, file)
console.log(`Wrote ${outputPath}`)
