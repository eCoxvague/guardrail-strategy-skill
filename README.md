# GuardRail Strategy Skill

Track 2 prototype for BNB Hack: AI Trading Agent Edition.

GuardRail is a backtestable AI trading strategy skill. It reads OHLCV-style market data, classifies the market regime, routes to a strategy, and lets a risk governor approve or block actions before they enter the backtest.

## What it demonstrates

- Market regime detection: trend, range, volatility, liquidity, and risk-off states.
- Strategy routing: momentum follow, mean reversion, volatility breakout, and capital preservation.
- Risk controls: max drawdown, max position size, confidence threshold, stop loss, take profit, and cooldown after losses.
- Benchmarking against a naive RSI 35/65 strategy.
- Judge-friendly dashboard: PnL, drawdown, win rate, profit factor, benchmark delta, decision log, and JSON skill output.

## Submission files

- Strategy skill spec: `docs/STRATEGY_SKILL_SPEC.md`
- DoraHacks submission draft: `docs/DORAHACKS_SUBMISSION.md`

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Optional CoinMarketCap Data Cache

The app runs without API keys using deterministic sample data. To generate a real CoinMarketCap OHLCV cache:

```bash
copy .env.example .env
# set CMC_API_KEY in .env or in your shell
npm run fetch:cmc -- --symbols=BNB,CAKE,TWT --days=180
npm run dev
```

The fetch script first tries CoinMarketCap's historical OHLCV endpoint and writes normalized candles into `src/domain/cmcCache.ts`. If the current CMC plan does not support historical OHLCV, it falls back to latest quote data and calibrates the demo history around the live CMC price, volume, and market cap. API keys are never shipped to the browser.
