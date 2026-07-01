import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import InsightCard from '../components/InsightCard.jsx'
import Card from '../components/Card.jsx'
import KpiCard from '../components/KpiCard.jsx'
import InsightsTable from '../components/InsightsTable.jsx'
import { normalizeAlert } from '../utils/alertModel.js'
import { computeForecastKpis } from '../utils/forecastMetrics.js'
import { computeInventoryInsights } from '../utils/inventoryInsights.js'
import { loadCsv } from '../utils/loadCsv.js'

function formatDemand(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

const INSIGHTS_VISIBLE = 24

export default function Home() {
  const [kpis, setKpis] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [forecastRows, setForecastRows] = useState([])
  const [inventoryRows, setInventoryRows] = useState([])
  const [workerStats, setWorkerStats] = useState({
    total: 0, available: 0, busy: 0
  })
  const [taskStats, setTaskStats] = useState({
    active: 0, completed: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const [forecastsRes, alertsRes, inventoryRes, workersRes, tasksRes] = await Promise.all([
          loadCsv('/api/forecast'),
          loadCsv('/data/raw/alerts.csv'),
          loadCsv('/data/raw/inventory.csv'),
          fetch('/api/workers').then(r => r.json()).catch(() => ({ success: false, workers: [] })),
          fetch('/api/tasks').then(r => r.json()).catch(() => ({ success: false, tasks: [] })),
        ])

        if (cancelled) return

        const fData = forecastsRes.data ?? []
        const aData = (alertsRes.data ?? []).map(normalizeAlert)

        setForecastRows(fData)
        setKpis(computeForecastKpis(fData))
        setAlerts(aData)
        setInventoryRows(inventoryRes.data ?? [])

        const workers = workersRes.workers || [];
        setWorkerStats({
          total: workers.length,
          available: workers.filter(w => w.status === 'Available').length,
          busy: workers.filter(w => w.status === 'Busy').length
        });

        const tasks = tasksRes.tasks || [];
        setTaskStats({
          active: tasks.filter(t => t.status !== 'Completed').length,
          completed: tasks.filter(t => t.status === 'Completed').length
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const insights = useMemo(
    () => computeInventoryInsights(inventoryRows, forecastRows),
    [inventoryRows, forecastRows],
  )

  const visibleInsights = insights.slice(0, INSIGHTS_VISIBLE)

  // Utilization %
  const workerUtilization = workerStats.total > 0
    ? Math.round((workerStats.busy / workerStats.total) * 100) : 0;

  // 🔥 ONLY KEEP THIS (needed for Recommended Action)
  const priorityOrder = { STOCKOUT: 1, RESTOCK: 2 }

  const topActions = [...alerts]
    .sort((a, b) => (priorityOrder[a.status] || 99) - (priorityOrder[b.status] || 99))
    .slice(0, 3)

  // KPI counts
  const totalSkus = insights.length
  const criticalCount = insights.filter((i) => i.stockoutRisk === 'critical').length
  const warningCount = insights.filter((i) => i.stockoutRisk === 'high' || i.stockoutRisk === 'medium').length
  const safeCount = insights.filter((i) => i.stockoutRisk === 'low').length

  // Table data: compute priority score = leadTime - coverDays (daysRemaining)
  const tableRows = insights.map((i) => ({
    ...i,
    priorityScore: (i.leadTimeDays || 0) - (i.daysRemaining == null ? 0 : i.daysRemaining),
  }))

  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const navigate = useNavigate()

  const autoReplenishRows = useMemo(
    () => insights.filter((item) => item.autoReplenishEligible),
    [insights],
  )

  const availableAutoReplenishQty = useMemo(
    () => autoReplenishRows.reduce((sum, item) => sum + (item.reorderQuantity || 0), 0),
    [autoReplenishRows],
  )

  const addAutoReplenishmentToCart = () => {
    if (autoReplenishRows.length === 0) {
      setActionMessage('No critical replenishment candidates available at this time.')
      return
    }

    let cart = []
    try {
      const stored = localStorage.getItem('inventoryCart')
      cart = stored ? JSON.parse(stored) : []
    } catch (e) {
      cart = []
    }

    const updated = [...cart]
    autoReplenishRows.forEach((item) => {
      const qty = Math.max(1, item.reorderQuantity || 1)
      const displayName = item.productName || item.sku
      const existing = updated.find((c) => c.item_id === item.sku)
      if (existing) {
        existing.qty = Math.max(existing.qty || 0, qty)
        existing.shortage = Math.max(existing.shortage || 0, qty)
      } else {
        updated.push({
          item_id: item.sku,
          display_name: displayName,
          shortage: qty,
          weight: 0,
          size: '',
          qty,
        })
      }
    })

    localStorage.setItem('inventoryCart', JSON.stringify(updated))
    setActionMessage(`Added ${autoReplenishRows.length} critical replenishment item(s) to the order cart.`)
    navigate('/orders')
  }

  const topDemandProduct = useMemo(() => {
    if (insights.length === 0) return null

    const getRiskPriority = (item) => {
      if (item.stockoutRisk === 'critical') return 3
      if (item.stockoutRisk === 'high') return 2
      if (item.stockoutRisk === 'medium') return 1
      return 0
    }

    return [...insights].sort((a, b) => {
      const riskDiff = getRiskPriority(b) - getRiskPriority(a)
      if (riskDiff !== 0) return riskDiff
      return b.sumForecast28d - a.sumForecast28d
    })[0]
  }, [insights])

  // Sort: critical items first, then by priorityScore desc
  tableRows.sort((a, b) => {
    if (a.stockoutRisk === 'critical' && b.stockoutRisk !== 'critical') return -1
    if (b.stockoutRisk === 'critical' && a.stockoutRisk !== 'critical') return 1
    return (b.priorityScore ?? 0) - (a.priorityScore ?? 0)
  })

  const highDemandRows = useMemo(() => {
    return [...tableRows].sort((a, b) => b.sumForecast28d - a.sumForecast28d).slice(0, 10)
  }, [tableRows])

  const displayRows = showAllProducts ? tableRows : highDemandRows

  return (
    <div className="space-y-10">
      {/* HEADER */}
      <header>
        <h1 className="si-page-title">Home</h1>
       
      </header>

      {topDemandProduct && (
        <section className="grid gap-4 xl:grid-cols-[1.33fr_0.67fr]">
          <div className="bg-gradient-to-br from-slate-900 via-indigo-800 to-indigo-600 text-white rounded-3xl p-6 shadow-2xl border border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-300">Top high-demand product</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight">{topDemandProduct.productName || topDemandProduct.sku}</h2>
              </div>
              <span className="rounded-full bg-white/12 px-3 py-1 text-sm font-semibold uppercase tracking-[0.16em] text-slate-100">
                {topDemandProduct.stockoutRisk === 'critical' ? 'Critical' : topDemandProduct.stockoutRisk === 'high' ? 'High' : 'Medium'}
              </span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs uppercase text-slate-300 tracking-[0.18em]">Forecast next 28 days</p>
                <p className="mt-2 text-3xl font-semibold">{formatDemand(topDemandProduct.sumForecast28d)}</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs uppercase text-slate-300 tracking-[0.18em]">Current stock</p>
                <p className="mt-2 text-3xl font-semibold">{topDemandProduct.currentStock.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs uppercase text-slate-300 tracking-[0.18em]">Cover days</p>
                <p className="mt-2 text-3xl font-semibold">{topDemandProduct.daysRemaining == null ? '—' : topDemandProduct.daysRemaining.toFixed(1)}</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs uppercase text-slate-300 tracking-[0.18em]">Lead time</p>
                <p className="mt-2 text-3xl font-semibold">{topDemandProduct.leadTimeDays} days</p>
              </div>
            </div>
          </div>

        </section>
      )}

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Critical replenishment candidates</h2>
            <p className="mt-2 text-sm text-slate-600">
              {autoReplenishRows.length > 0
                ? `Identified ${autoReplenishRows.length} critical SKU(s).`
                : 'No critical replenishment candidates currently detected by the inventory risk analysis.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 text-right">
            <div className="text-sm text-slate-500">
              {autoReplenishRows.length > 0
                ? `${availableAutoReplenishQty.toLocaleString()} units recommended total`
                : 'No items require immediate replenishment.'}
            </div>
            <button
              type="button"
              onClick={addAutoReplenishmentToCart}
              className="si-btn si-btn--primary"
            >
              Auto-add critical replenishment items
            </button>
            {actionMessage && (
              <p className="text-sm text-slate-500">{actionMessage}</p>
            )}
          </div>
        </div>
      </section>

      {/* INSIGHTS TABLE */}
      <section>
        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_auto] xl:grid-cols-[1fr_auto_auto] items-center">
          <div>
            <h2 className="si-section-title">Supply & forecast insights</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
              {showAllProducts ? 'Viewing all products' : 'Viewing top 10 high demand'}
            </div>
            <button
              type="button"
              onClick={() => setShowAllProducts((prev) => !prev)}
              className="si-btn si-btn--ghost"
            >
              {showAllProducts ? 'Show top 10 only' : 'Show all products'}
            </button>
          </div>
        </div>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU"
              className="si-input w-48"
            />
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="si-input">
              <option value="ALL">All risks</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
            </select>
          </div>
          <div className="text-sm text-slate-500">
            {showAllProducts
              ? `Showing all ${displayRows.length} products. Use the top 10 view to focus on high-demand items.`
              : 'Showing the top 10 products with the highest forecast demand.'}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading insights…</p>
        ) : (
          <div className="space-y-4">
            <InsightsTable rows={displayRows} query={query} riskFilter={riskFilter} />
          </div>
        )}
      </section>

      {/* TOP KPIS */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total SKUs" value={loading ? '—' : String(totalSkus)} />
          <KpiCard label="Critical" value={loading ? '—' : String(criticalCount)} />
          <KpiCard label="Warning" value={loading ? '—' : String(warningCount)} />
          <KpiCard label="Low risk" value={loading ? '—' : String(safeCount)} />
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Workers
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {loading ? '—' : String(workerStats.total)}
            </p>
          </Card>
          <Card className="p-6 border-l-4 border-emerald-500">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Available Workers
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl">
              {loading ? '—' : String(workerStats.available)}
            </p>
          </Card>
          <Card className="p-6 border-l-4 border-amber-500">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Busy Workers
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 sm:text-3xl">
              {loading ? '—' : String(workerStats.busy)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active Tasks
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {loading ? '—' : String(taskStats.active)}
            </p>
          </Card>
          <Card className="p-6 border-l-4 border-emerald-500">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Completed Tasks
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl">
              {loading ? '—' : String(taskStats.completed)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Worker Utilization
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {loading ? '—' : `${workerUtilization}%`}
            </p>
          </Card>
        </div>
      </section>

      {/* RECOMMENDED ACTION (highlighted) */}
      <section>
        <div className="si-card p-5 border-l-4 border-red-600 bg-red-50/40">
          <h2 className="si-section-title mb-2">Recommended action</h2>
          {topActions.length > 0 ? (
            <div className="space-y-3">
              {topActions.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-600">SKU</p>
                    <p className="font-semibold">{a.sku}</p>
                    <p className="text-red-700 font-bold">{a.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No critical actions</p>
          )}
        </div>
      </section>
    </div>
  )
}