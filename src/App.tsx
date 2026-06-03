import {
  Activity,
  BarChart3,
  Brain,
  ChevronDown,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Cpu,
  Database,
  FileText,
  Gauge,
  HelpCircle,
  LineChart,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Swords,
  Terminal,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import './App.css'
import { riskConfigs } from './domain/agent'
import { runBacktest } from './domain/backtest'
import { getMarketData, getMarketDataSource } from './domain/marketData'
import type { BacktestResult, EquityPoint, MarketDataSource, RiskMode, SymbolId, Trade } from './domain/types'

const symbols: SymbolId[] = ['BNB', 'CAKE', 'TWT']
const riskModes: RiskMode[] = ['defensive', 'balanced', 'growth']
type AppTab = 'terminal' | 'backtest' | 'skill' | 'faq' | 'submission'

const tabs: Array<{ id: AppTab; label: string; Icon: typeof Terminal }> = [
  { id: 'terminal', label: 'Terminal', Icon: Terminal },
  { id: 'backtest', label: 'Backtest', Icon: BarChart3 },
  { id: 'skill', label: 'Skill Spec', Icon: FileText },
  { id: 'faq', label: 'FAQ', Icon: HelpCircle },
  { id: 'submission', label: 'Submit', Icon: Rocket },
]

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

function titleCaseMode(mode: string) {
  return mode
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

function actionNarrative(result: BacktestResult) {
  const latestDecision = result.decisions[result.decisions.length - 1]
  const strategy = result.currentSignal.strategy

  if (latestDecision.action === 'buy') {
    return `Entry allowed: ${strategy} passed confidence, drawdown, and position-size checks.`
  }

  if (latestDecision.action === 'sell') {
    return `Exit signal: ${strategy} detected a stretched move, so the skill protects the backtest portfolio instead of adding exposure.`
  }

  if (!latestDecision.approved) {
    return `No trade: risk governor blocked the signal before it reached the strategy output.`
  }

  return `No trade: the current regime does not offer a clean enough edge after risk checks.`
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
  const equityMin = Math.min(...points.map((point) => point.equity))
  const equityMax = Math.max(...points.map((point) => point.equity))
  const equityRange = equityMax - equityMin || 1
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
          const y = height - ((point.equity - equityMin) / equityRange) * height
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

function DataSourcePanel({ source }: { source: MarketDataSource }) {
  return (
    <section className="data-source-panel">
      <div className="panel-title">
        <Database size={18} />
        <h2>CoinMarketCap data source</h2>
      </div>
      <div className="source-grid">
        <article>
          <span>Provider</span>
          <strong>{source.provider}</strong>
        </article>
        <article>
          <span>Mode</span>
          <strong>{titleCaseMode(source.mode)}</strong>
        </article>
        <article>
          <span>Candles</span>
          <strong>{source.candles}</strong>
        </article>
        <article>
          <span>Fetched</span>
          <strong>{source.fetchedAt ? new Date(source.fetchedAt).toLocaleDateString('en-US') : 'Local demo'}</strong>
        </article>
      </div>
      <p>{source.note}</p>
      <small>API key is used only by the local cache script and is never shipped to the browser.</small>
    </section>
  )
}

function BenchmarkPanel({ result }: { result: BacktestResult }) {
  const returnDelta = result.stats.totalReturnPct - result.benchmark.totalReturnPct
  const drawdownDelta = result.benchmark.maxDrawdownPct - result.stats.maxDrawdownPct

  return (
    <section className="panel benchmark-panel">
      <div className="panel-title">
        <Swords size={18} />
        <h2>Benchmark edge</h2>
      </div>
      <div className="benchmark-grid">
        <article>
          <span>GuardRail return</span>
          <strong className={result.stats.totalReturnPct >= 0 ? 'positive' : 'negative'}>{formatPct(result.stats.totalReturnPct)}</strong>
          <small>Risk-routed strategy</small>
        </article>
        <article>
          <span>{result.benchmark.name}</span>
          <strong className={result.benchmark.totalReturnPct >= 0 ? 'positive' : 'negative'}>
            {formatPct(result.benchmark.totalReturnPct)}
          </strong>
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

function TerminalPanel({
  symbol,
  riskMode,
  result,
  source,
}: {
  symbol: SymbolId
  riskMode: RiskMode
  result: BacktestResult
  source: MarketDataSource
}) {
  const latestDecision = result.decisions[result.decisions.length - 1]
  const recentDecisions = result.decisions.slice(-5)
  const confidence = Math.round(latestDecision.confidence * 100)
  const riskScore = Math.round(latestDecision.riskScore)
  const terminalLines = [
    ['00:00.000', 'boot', 'GuardRail Strategy Skill v1 initialized'],
    ['00:00.018', 'source', `${source.provider} / ${source.mode} / ${source.candles} candles loaded`],
    ['00:00.041', 'regime', `${result.currentSignal.regime} detected from trend, volume, and volatility features`],
    ['00:00.067', 'router', `${result.currentSignal.strategy} selected by strategy router`],
    ['00:00.093', 'risk', `confidence=${confidence}% riskScore=${riskScore}/100 approved=${String(latestDecision.approved)}`],
    ['00:00.121', latestDecision.action, actionNarrative(result)],
  ]

  return (
    <section className="terminal-layout">
      <div className="terminal-window">
        <div className="terminal-bar">
          <span></span>
          <span></span>
          <span></span>
          <strong>guardrail-agent</strong>
          <div className="terminal-live">
            <Zap size={13} />
            replay
          </div>
        </div>
        <div className="terminal-body">
          <p className="terminal-command">
            <span className="prompt">$</span> guardrail run --symbol {symbol} --risk {riskMode} --source cmc
            <span className="cursor"></span>
          </p>
          {terminalLines.map(([time, key, value], index) => (
            <p className="terminal-line" style={{ animationDelay: `${index * 90}ms` }} key={`${time}-${key}`}>
              <span className="timestamp">{time}</span>
              <span className={`log-key ${key}`}>{key}</span>
              <span>{value}</span>
            </p>
          ))}
          <div className="terminal-meters">
            <article>
              <span>Confidence</span>
              <strong>{confidence}%</strong>
              <div className="meter">
                <i style={{ width: `${confidence}%` }}></i>
              </div>
            </article>
            <article>
              <span>Risk Score</span>
              <strong>{riskScore}/100</strong>
              <div className="meter risk">
                <i style={{ width: `${riskScore}%` }}></i>
              </div>
            </article>
          </div>
          <div className="terminal-separator"></div>
          {recentDecisions.map((decision) => (
            <p className="terminal-history" key={`${decision.time}-${decision.riskScore}`}>
              <span className="muted">{decision.time}</span> {decision.regime} / {decision.strategy} /{' '}
              <span className={`inline-action ${decision.action}`}>{decision.action}</span>
            </p>
          ))}
        </div>
      </div>

      <aside className="operator-panel">
        <div className="panel-title">
          <Cpu size={18} />
          <h2>Operator snapshot</h2>
        </div>
        <div className="operator-grid">
          <article>
            <span>Signal</span>
            <strong>{latestDecision.action.toUpperCase()}</strong>
          </article>
          <article>
            <span>Return</span>
            <strong className={result.stats.totalReturnPct >= 0 ? 'positive' : 'negative'}>{formatPct(result.stats.totalReturnPct)}</strong>
          </article>
          <article>
            <span>Drawdown</span>
            <strong>{result.stats.maxDrawdownPct.toFixed(2)}%</strong>
          </article>
          <article>
            <span>Risk blocks</span>
            <strong>{result.stats.riskBlocks}</strong>
          </article>
        </div>
        <p>{source.note}</p>
        <div className="demo-guide">
          <strong>Silent demo guide</strong>
          <ol>
            <li>Switch BNB, CAKE, and TWT to show strategy changes.</li>
            <li>Switch risk modes to show the governor changing limits.</li>
            <li>Open Backtest to compare GuardRail against naive RSI.</li>
            <li>Open Skill Spec to inspect the CMC-style JSON output.</li>
            <li>Open Submit to verify repo, demo, and Track 2 package status.</li>
          </ol>
        </div>
      </aside>
    </section>
  )
}

function SkillPanel({ symbol, result, source }: { symbol: SymbolId; result: BacktestResult; source: MarketDataSource }) {
  const skillOutput = {
    skill: 'guardrail.strategy.v1',
    symbol,
    data: {
      provider: source.provider,
      mode: source.mode,
      candles: source.candles,
    },
    decision: {
      regime: result.currentSignal.regime,
      strategy: result.currentSignal.strategy,
      action: result.currentSignal.action,
      confidence: Number(result.currentSignal.confidence.toFixed(2)),
      positionPct: Number(result.currentSignal.positionPct.toFixed(2)),
      stopLossPct: result.currentSignal.stopLossPct,
      takeProfitPct: result.currentSignal.takeProfitPct,
    },
    risk: {
      maxDrawdownObservedPct: result.stats.maxDrawdownPct,
      riskOverrides: result.stats.riskBlocks,
    },
  }

  return (
    <section className="split-page">
      <div className="panel spec-panel">
        <div className="panel-title">
          <Brain size={18} />
          <h2>Skill architecture</h2>
        </div>
        <div className="flow-list">
          {[
            ['01', 'Normalize CMC market data', 'OHLCV, volume, and market cap are converted into a stable candle model.'],
            ['02', 'Classify market regime', 'Trend, range, volatility, liquidity, and risk-off states drive the strategy choice.'],
            ['03', 'Route strategy', 'Momentum, mean reversion, volatility breakout, or capital preservation.'],
            ['04', 'Apply risk governor', 'Drawdown, confidence, position size, stop loss, take profit, and cooldown controls can block trades.'],
          ].map(([step, title, body]) => (
            <article key={step}>
              <span>{step}</span>
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <section className="panel callout">
        <div className="panel-title">
          <TrendingUp size={18} />
          <h2>CMC skill output</h2>
        </div>
        <code>{JSON.stringify(skillOutput, null, 2)}</code>
      </section>
    </section>
  )
}

function FaqPanel() {
  const [openIndex, setOpenIndex] = useState(0)
  const items = [
    ['Is this Track 1 or Track 2?', 'Track 2. It is a backtestable Strategy Skill and does not execute live trades or require on-chain registration.'],
    ['Does it guarantee profit?', 'No. The claim is risk-aware strategy generation, benchmark visibility, and explainable trade refusal.'],
    ['Where is CoinMarketCap used?', 'The cache script uses CMC market data. The UI displays active CMC data mode, candle count, and fetch metadata.'],
    ['Why not only RSI or MACD?', 'GuardRail routes strategies by market regime and can block signals with a risk governor. The site compares it against naive RSI.'],
    ['What happens with a better CMC plan?', 'The same script uses historical OHLCV when the endpoint is available. No UI or strategy rewrite is needed.'],
  ]

  return (
    <section className="faq-stack">
      {items.map(([q, a], index) => (
        <article className={`faq-item ${openIndex === index ? 'open' : ''}`} key={q}>
          <button type="button" onClick={() => setOpenIndex(openIndex === index ? -1 : index)}>
            <span>{q}</span>
            <ChevronDown size={18} />
          </button>
          <div className="faq-answer">
            <p>{a}</p>
          </div>
        </article>
      ))}
    </section>
  )
}

function SubmissionPanel() {
  return (
    <section className="split-page">
      <div className="panel submission-card">
        <div className="panel-title">
          <ClipboardCheck size={18} />
          <h2>DoraHacks package</h2>
        </div>
        <ul className="check-list">
          {[
            'Public GitHub repository ready',
            'Production demo deployed',
            'Track 2 strategy spec included',
            'CMC data source visible in the UI',
            'Benchmark against naive RSI included',
          ].map((item) => (
            <li key={item}>
              <CheckCircle2 size={17} />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="panel link-card">
        <h2>Submission links</h2>
        <a href="https://github.com/eCoxvague/guardrail-strategy-skill" target="_blank">
          GitHub repository
        </a>
        <a href="https://bnb-hacka.vercel.app" target="_blank">
          Live demo
        </a>
        <p>Remaining item: record a short demo video and add the link to DoraHacks.</p>
      </div>
    </section>
  )
}

function BacktestPanel({
  result,
  latestEquity,
  risk,
  riskMode,
}: {
  result: BacktestResult
  latestEquity: number
  risk: (typeof riskConfigs)[RiskMode]
  riskMode: RiskMode
}) {
  const latestDecision = result.decisions[result.decisions.length - 1]

  return (
    <>
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
          <BenchmarkPanel result={result} />
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
        </aside>
      </section>
    </>
  )
}

function App() {
  const [symbol, setSymbol] = useState<SymbolId>('BNB')
  const [riskMode, setRiskMode] = useState<RiskMode>('balanced')
  const [activeTab, setActiveTab] = useState<AppTab>('terminal')
  const candles = useMemo(() => getMarketData(symbol), [symbol])
  const dataSource = useMemo(() => getMarketDataSource(symbol), [symbol])
  const result = useMemo(() => runBacktest(symbol, candles, riskMode), [symbol, candles, riskMode])
  const latestEquity = result.equityCurve[result.equityCurve.length - 1]?.equity ?? 10000
  const risk = riskConfigs[riskMode]

  return (
    <main className="app-shell">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">BNB Hack: AI Trading Agent Edition - Track 2</p>
          <h1>GuardRail Strategy Skill</h1>
          <p className="header-copy">Terminal-first demo for a CMC-backed, risk-aware trading strategy skill.</p>
        </div>
        <div className="status-pill">
          <ShieldCheck size={18} />
          Backtest only
        </div>
      </header>

      <section className="command-deck">
        <div className="tab-row" role="tablist" aria-label="Demo sections">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div className="control-strip" aria-label="Strategy controls">
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
              <button key={item} type="button" className={riskMode === item ? 'active' : ''} onClick={() => setRiskMode(item)}>
                <Gauge size={16} />
                {modeLabels[item]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeTab === 'terminal' && (
        <>
          <TerminalPanel symbol={symbol} riskMode={riskMode} result={result} source={dataSource} />
          <DataSourcePanel source={dataSource} />
        </>
      )}
      {activeTab === 'backtest' && <BacktestPanel result={result} latestEquity={latestEquity} risk={risk} riskMode={riskMode} />}
      {activeTab === 'skill' && <SkillPanel symbol={symbol} result={result} source={dataSource} />}
      {activeTab === 'faq' && <FaqPanel />}
      {activeTab === 'submission' && <SubmissionPanel />}
    </main>
  )
}

export default App
