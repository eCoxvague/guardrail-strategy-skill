export type SymbolId = 'BNB' | 'CAKE' | 'TWT'

export type Candle = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  marketCap: number
}

export type MarketRegime =
  | 'Trend Expansion'
  | 'Range Rotation'
  | 'High Volatility'
  | 'Low Liquidity'
  | 'Risk-Off'

export type StrategyId =
  | 'Momentum Follow'
  | 'Mean Reversion'
  | 'Volatility Breakout'
  | 'Capital Preservation'

export type SignalAction = 'buy' | 'sell' | 'hold'

export type TradeSignal = {
  action: SignalAction
  confidence: number
  strategy: StrategyId
  regime: MarketRegime
  reason: string
  positionPct: number
  stopLossPct: number
  takeProfitPct: number
}

export type RiskMode = 'defensive' | 'balanced' | 'growth'

export type RiskConfig = {
  maxDrawdownPct: number
  maxPositionPct: number
  minConfidence: number
  stopLossPct: number
  takeProfitPct: number
  cooldownAfterLosses: number
}

export type AgentDecision = {
  time: string
  symbol: SymbolId
  action: SignalAction
  strategy: StrategyId
  regime: MarketRegime
  confidence: number
  approved: boolean
  riskScore: number
  reason: string
}

export type Trade = {
  entryTime: string
  exitTime: string
  entryPrice: number
  exitPrice: number
  sizeUsd: number
  pnlUsd: number
  pnlPct: number
  strategy: StrategyId
  exitReason: string
}

export type EquityPoint = {
  time: string
  price: number
  equity: number
  drawdownPct: number
  action: SignalAction
}

export type BacktestStats = {
  totalReturnPct: number
  maxDrawdownPct: number
  winRatePct: number
  profitFactor: number
  tradeCount: number
  exposurePct: number
  riskBlocks: number
  sharpeLike: number
}

export type BenchmarkStats = {
  name: string
  totalReturnPct: number
  maxDrawdownPct: number
  tradeCount: number
  winRatePct: number
}

export type MarketDataSource = {
  provider: 'CoinMarketCap' | 'Demo'
  mode: 'historical-ohlcv' | 'latest-quote-calibrated' | 'deterministic-sample'
  fetchedAt?: string
  candles: number
  note: string
}

export type BacktestResult = {
  symbol: SymbolId
  stats: BacktestStats
  benchmark: BenchmarkStats
  equityCurve: EquityPoint[]
  trades: Trade[]
  decisions: AgentDecision[]
  currentSignal: TradeSignal
  thesis: string[]
}
