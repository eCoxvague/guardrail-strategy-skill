# DoraHacks Submission Draft

## Project Name

GuardRail Strategy Skill

## Track

Track 2 - Strategy Skills

## One-Liner

A risk-first CMC Strategy Skill that classifies market regimes, routes to a strategy, and backtests every decision with explicit drawdown and confidence guardrails.

## Description

GuardRail Strategy Skill is a backtestable crypto strategy generator for the BNB Hack: AI Trading Agent Edition. It takes CoinMarketCap-style OHLCV market data, classifies the market into regimes such as trend expansion, range rotation, high volatility, low liquidity, or risk-off, and then routes to the appropriate strategy.

The differentiator is the risk governor. Every generated signal must pass drawdown, position sizing, confidence, stop loss, take profit, and cooldown checks. The dashboard shows not only PnL, but also why the agent traded or refused to trade.

The dashboard also compares GuardRail against a naive RSI 35/65 baseline. This makes the project judgeable: reviewers can inspect whether the skill improves return, reduces drawdown, or blocks low-quality trades compared with a simple indicator strategy.

This is built for Track 2, so it does not execute live trades. It ships a reproducible strategy spec, backtest engine, and demo UI.

## Sponsor Capability Used

CoinMarketCap capability is used as the target data and skill layer. The code is built around normalized CMC-style OHLCV input and produces CMC Skill-style structured output.

The app can run with deterministic sample market data so judges can review it without API keys. It also includes `npm run fetch:cmc`, which uses `CMC_API_KEY` to fetch CoinMarketCap market data and writes a local cache consumed by the dashboard. The script uses historical OHLCV when the API plan supports it; otherwise it falls back to latest CMC quote data and calibrates the demo history around live CMC price, volume, and market cap. API keys are not exposed to the browser.

## Why Pick This Project

GuardRail does not claim guaranteed profit. It targets the harder and more useful part of trading strategy generation: knowing when not to trade.

Reasons it stands out:

- It is a strategy router, not a single hardcoded RSI/MACD rule.
- It classifies market regime before choosing a strategy.
- It can refuse trades through a risk governor.
- It shows every decision in plain English.
- It benchmarks against naive RSI so the improvement or failure is visible.
- It produces structured CMC Skill-style JSON output that another agent can consume.

## What Judges Should Try

1. Change symbol between BNB, CAKE, and TWT.
2. Change risk mode between Defensive, Balanced, and Growth.
3. Compare GuardRail versus the naive RSI baseline.
4. Compare total return, max drawdown, risk overrides, and decision log.
5. Inspect the JSON skill output in the right panel.
6. Read `docs/STRATEGY_SKILL_SPEC.md` for the full strategy specification.

## Repository

Add public GitHub repository URL here after pushing.

## Demo

Add deployed demo URL here after deploying.

## Video

Add demo video URL here after recording.

Suggested 2-minute video flow:

- 0:00-0:20: Explain Track 2 and GuardRail's risk-first idea.
- 0:20-0:50: Show symbol and risk-mode switching.
- 0:50-1:15: Show benchmark panel versus naive RSI.
- 1:15-1:35: Show equity curve, drawdown, trade table, and decision log.
- 1:35-1:50: Show JSON skill output and strategy spec.
- 1:50-2:00: Explain CMC data cache and why this is useful.

## Setup

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Optional CMC data cache:

```bash
copy .env.example .env
npm run fetch:cmc -- --symbols=BNB,CAKE,TWT --days=180
```

## Notes

Track 2 has no on-chain registration requirement. The pasted hackathon text says Track 2 submissions are made through DoraHacks with the Skill and strategy spec by the end of the build window on June 21, 2026.
