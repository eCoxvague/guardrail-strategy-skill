import {
  Activity,
  Brain,
  CircleDollarSign,
  Gauge,
  LineChart,
  RefreshCw,
  ShieldCheck,
  Swords,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import './App.css'
import { riskConfigs } from './domain/agent'
import { runBacktest } from './domain/backtest'
import { getMarketData } from './domain/marketData'
import type { EquityPoint, RiskMode, SymbolId, Trade } from './domain/types'

const symbols: SymbolId[] = ['BNB', 'CAKE', 'TWT']
const riskModes: RiskMode[] = ['defensive', 'balanced', 'growth']

const modeLabels: Record<RiskMode, string> = {
  defensive: 'Defensive',
  balanced: 'Balanced',
  growth: 'Growth',
}

function formatCurrency(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(value)
}

function formatPct(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(2)}%`
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}) {
  return (
    <article className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function buildPath(points: EquityPoint[], key: 'equity' | 'price', width: number, height: number) {
  const values = points.map((point) => point[key])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width
      const y = height - ((point[key] - min) / range) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function EquityChart({ points }: { points: EquityPoint[] }) {
  const width = 920
  const height = 300
  const equityPath = buildPath(points, 'equity', width, height)
  const pricePath = buildPath(points, 'price', width, height)
  const signalPoints = points
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point.action === 'buy' || point.action === 'sell')
    .slice(-26)

  return (
    <div className="chart-shell">
      <div className="chart-head">
        <div>
          <span>Backtest replay</span>
          <strong>Equity curve with routed signals</strong>
        </div>
        <div className="legend">
          <span className="legend-equity">Equity</span>
          <span className="legend-price">Price</span>
          <span className="legend-buy">Buy/Sell</span>
        </div>
      </div>
      <svg className="equity-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Backtest equity chart">
        <path className="grid-line" d={`M 0 ${height * 0.25} L ${width} ${height * 0.25}`} />
        <path className="grid-line" d={`M 0 ${height * 0.5} L ${width} ${height * 0.5}`} />
        <path className="grid-line" d={`M 0 ${height * 0.75} L ${width} ${height * 0.75}`} />
        <path className="price-path" d={pricePath} />
        <path className="equity-path" d={equityPath} />
        {signalPoints.map(({ point, index }) => {
          const x = (index / Math.max(points.length - 1, 1)) * width
          const y = height - ((point.equity - Math.min(...points.map((p) => p.equity))) /
            (Math.max(...points.map((p) => p.equity)) - Math.min(...points.map((p) => p.equity)) || 1)) * height
          return <circle key={`${point.time}-${point.action}`} className={`signal-dot ${point.action}`} cx={x} cy={y} r="5" />
        })}
      </svg>
    </div>
  )
}

function TradesTable({ trades }: { trades: Trade[] }) {
  const latestTrades = trades.slice(-6).reverse()

  return (
    <section className="panel">
      <div className="panel-title">
        <CircleDollarSign size={18} />
        <h2>Recent trades</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Entry</th>
              <th>Exit</th>
              <th>Strategy</th>
              <th>PnL</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {latestTrades.map((trade) => (
              <tr key={`${trade.entryTime}-${trade.exitTime}-${trade.entryPrice}`}>
                <td>{trade.entryTime}</td>
                <td>{trade.exitTime}</td>
                <td>{trade.strategy}</td>
                <td className={trade.pnlUsd >= 0 ? 'positive' : 'negative'}>{formatPct(trade.pnlPct)}</td>
                <td>{trade.exitReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function BenchmarkPanel({
  guardReturn,
  guardDrawdown,
  benchmarkReturn,
  benchmarkDrawdown,
  benchmarkName,
}: {
  guardReturn: number
  guardDrawdown: number
  benchmarkReturn: number
  benchmarkDrawdown: number
  benchmarkName: string
}) {
  const returnDelta = guardReturn - benchmarkReturn
  const drawdownDelta = benchmarkDrawdown - guardDrawdown

  return (
    <section className="panel benchmark-panel">
      <div className="panel-title">
        <Swords size={18} />
        <h2>Benchmark edge</h2>
      </div>
      <div className="benchmark-grid">
        <article>
          <span>GuardRail return</span>
          <strong className={guardReturn >= 0 ? 'positive' : 'negative'}>{formatPct(guardReturn)}</strong>
          <small>Risk-routed strategy</small>
        </article>
        <article>
          <span>{benchmarkName}</span>
          <strong className={benchmarkReturn >= 0 ? 'positive' : 'negative'}>{formatPct(benchmarkReturn)}</strong>
          <small>Baseline indicator strategy</small>
        </article>
        <article>
          <span>Return delta</span>
          <strong className={returnDelta >= 0 ? 'positive' : 'negative'}>{formatPct(returnDelta)}</strong>
          <small>GuardRail minus baseline</small>
        </article>
        <article>
          <span>Drawdown saved</span>
          <strong className={drawdownDelta >= 0 ? 'positive' : 'negative'}>{formatPct(drawdownDelta)}</strong>
          <small>Baseline drawdown minus GuardRail</small>
        </article>
      </div>
    </section>
  )
}

function App() {
  const [symbol, setSymbol] = useState<SymbolId>('BNB')
  const [riskMode, setRiskMode] = useState<RiskMode>('balanced')
  const candles = useMemo(() => getMarketData(symbol), [symbol])
  const result = useMemo(() => runBacktest(symbol, candles, riskMode), [symbol, candles, riskMode])
  const latestDecision = result.decisions[result.decisions.length - 1]
  const latestEquity = result.equityCurve[result.equityCurve.length - 1]?.equity ?? 10000
  const risk = riskConfigs[riskMode]

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">BNB Hack: AI Trading Agent Edition - Track 2</p>
          <h1>GuardRail Strategy Skill</h1>
        </div>
        <div className="status-pill">
          <ShieldCheck size={18} />
          Backtest only
        </div>
      </header>

      <section className="control-strip" aria-label="Strategy controls">
        <div className="segmented">
          {symbols.map((item) => (
            <button key={item} type="button" className={symbol === item ? 'active' : ''} onClick={() => setSymbol(item)}>
              <Activity size={16} />
              {item}
            </button>
          ))}
        </div>
        <div className="segmented">
          {riskModes.map((item) => (
            <button
              key={item}
              type="button"
              className={riskMode === item ? 'active' : ''}
              onClick={() => setRiskMode(item)}
            >
              <Gauge size={16} />
              {modeLabels[item]}
            </button>
          ))}
        </div>
      </section>

      <section className="agent-summary">
        <div className="agent-copy">
          <div className="panel-title">
            <Brain size={19} />
            <h2>Agent decision</h2>
          </div>
          <p>
            The skill labels the market as <strong>{result.currentSignal.regime}</strong>, routes to{' '}
            <strong>{result.currentSignal.strategy}</strong>, then lets the risk governor approve or block the entry.
          </p>
          <div className="decision-row">
            <span className={`action-badge ${latestDecision.action}`}>{latestDecision.action.toUpperCase()}</span>
            <span>Confidence {(latestDecision.confidence * 100).toFixed(0)}%</span>
            <span>Risk score {latestDecision.riskScore.toFixed(0)}/100</span>
          </div>
        </div>
        <div className="risk-box">
          <span>Risk governor</span>
          <strong>{modeLabels[riskMode]}</strong>
          <p>
            Max drawdown {risk.maxDrawdownPct}% - max position {(risk.maxPositionPct * 100).toFixed(0)}% - min confidence{' '}
            {(risk.minConfidence * 100).toFixed(0)}%
          </p>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard
          label="Total return"
          value={formatPct(result.stats.totalReturnPct)}
          detail={`Final equity ${formatCurrency(latestEquity)}`}
          tone={result.stats.totalReturnPct >= 0 ? 'good' : 'bad'}
        />
        <MetricCard
          label="Max drawdown"
          value={`${result.stats.maxDrawdownPct.toFixed(2)}%`}
          detail={`${result.stats.riskBlocks} risk overrides`}
          tone={result.stats.maxDrawdownPct <= risk.maxDrawdownPct ? 'good' : 'warn'}
        />
        <MetricCard label="Win rate" value={`${result.stats.winRatePct.toFixed(1)}%`} detail={`${result.stats.tradeCount} trades`} />
        <MetricCard label="Profit factor" value={result.stats.profitFactor.toFixed(2)} detail={`Exposure ${result.stats.exposurePct}%`} />
        <MetricCard label="Sharpe-like" value={result.stats.sharpeLike.toFixed(2)} detail="Daily return stability" />
      </section>

      <section className="main-grid">
        <div className="left-column">
          <EquityChart points={result.equityCurve} />
          <BenchmarkPanel
            guardReturn={result.stats.totalReturnPct}
            guardDrawdown={result.stats.maxDrawdownPct}
            benchmarkReturn={result.benchmark.totalReturnPct}
            benchmarkDrawdown={result.benchmark.maxDrawdownPct}
            benchmarkName={result.benchmark.name}
          />
          <TradesTable trades={result.trades} />
        </div>

        <aside className="right-column">
          <section className="panel">
            <div className="panel-title">
              <LineChart size={18} />
              <h2>Why it is different</h2>
            </div>
            <ul className="thesis-list">
              {result.thesis.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <div className="panel-title">
              <RefreshCw size={18} />
              <h2>Decision log</h2>
            </div>
            <div className="decision-log">
              {result.decisions
                .slice(-7)
                .reverse()
                .map((decision) => (
                  <article key={`${decision.time}-${decision.action}-${decision.riskScore}`}>
                    <div>
                      <strong>{decision.time}</strong>
                      <span className={`mini-action ${decision.action}`}>{decision.action}</span>
                    </div>
                    <p>{decision.reason}</p>
                  </article>
                ))}
            </div>
          </section>

          <section className="panel callout">
            <div className="panel-title">
              <TrendingUp size={18} />
              <h2>CMC skill output</h2>
            </div>
            <code>
              {JSON.stringify(
                {
                  symbol,
                  regime: result.currentSignal.regime,
                  strategy: result.currentSignal.strategy,
                  action: result.currentSignal.action,
                  confidence: Number(result.currentSignal.confidence.toFixed(2)),
                  stopLossPct: result.currentSignal.stopLossPct,
                  takeProfitPct: result.currentSignal.takeProfitPct,
                },
                null,
                2,
              )}
            </code>
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
