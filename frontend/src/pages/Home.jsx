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
    navigate('/inbound')
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
    <div style={{ padding: '24px 0', fontFamily: 'var(--font-primary)' }}>
      {/* HEADER */}
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Operations and Inventory Overview</p>
      </header>

      {topDemandProduct && (
        <section style={{ marginBottom: '32px' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--dark-panel)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--sidebar-text)', margin: '0 0 4px 0' }}>HIGH-DEMAND PRODUCT</p>
                <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }} className="mono">{topDemandProduct.productName || topDemandProduct.sku}</h2>
              </div>
              <span style={{ 
                backgroundColor: topDemandProduct.stockoutRisk === 'critical' ? 'var(--danger)' : topDemandProduct.stockoutRisk === 'high' ? 'var(--warning)' : 'var(--success)',
                color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {topDemandProduct.stockoutRisk === 'critical' ? 'Critical' : topDemandProduct.stockoutRisk === 'high' ? 'High' : 'Medium'}
              </span>
            </div>
            <div style={{ padding: '24px', display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>Forecast Next 28 Days</p>
                <p style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>{formatDemand(topDemandProduct.sumForecast28d)}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>Current Stock</p>
                <p style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>{topDemandProduct.currentStock.toLocaleString()}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>Cover Days</p>
                <p style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>{topDemandProduct.daysRemaining == null ? '—' : topDemandProduct.daysRemaining.toFixed(1)}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>Lead Time</p>
                <p style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>{topDemandProduct.leadTimeDays} days</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-[#E8C77B] bg-[#FFF7E6] px-4 py-3 text-sm text-[#B7791F]">
          {error}
        </div>
      )}

      <section style={{ marginBottom: '32px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Critical Replenishment Candidates</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {autoReplenishRows.length > 0
                  ? `Identified ${autoReplenishRows.length} critical SKU(s).`
                  : 'No critical replenishment candidates currently detected by the inventory risk analysis.'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                onClick={addAutoReplenishmentToCart}
                style={{
                  backgroundColor: 'var(--blue-primary)', color: '#fff', border: 'none', borderRadius: '6px',
                  padding: '8px 16px', fontSize: '0.9rem', cursor: 'pointer'
                }}
              >
                Auto-add critical items
              </button>
              {actionMessage && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>{actionMessage}</p>
              )}
            </div>
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
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>Operational Metrics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { label: 'Total SKUs', value: loading ? '—' : String(totalSkus) },
            { label: 'Critical SKUs', value: loading ? '—' : String(criticalCount) },
            { label: 'Warning SKUs', value: loading ? '—' : String(warningCount) },
            { label: 'Safe SKUs', value: loading ? '—' : String(safeCount) },
            { label: 'Total Workers', value: loading ? '—' : String(workerStats.total) },
            { label: 'Available Workers', value: loading ? '—' : String(workerStats.available) },
            { label: 'Busy Workers', value: loading ? '—' : String(workerStats.busy) },
            { label: 'Active Tasks', value: loading ? '—' : String(taskStats.active) },
            { label: 'Completed Tasks', value: loading ? '—' : String(taskStats.completed) },
            { label: 'Worker Utilization', value: loading ? '—' : `${workerUtilization}%` }
          ].map((kpi, idx) => (
            <div key={idx} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>{kpi.label}</p>
              <p style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RECOMMENDED ACTION */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--danger)', borderRadius: '8px', padding: '20px' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: '0 0 16px 0', fontWeight: 500 }}>Recommended Actions</h2>
          {topActions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topActions.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>SKU: <span className="mono" style={{ color: 'var(--text-primary)' }}>{a.sku}</span></p>
                    <p style={{ fontSize: '13px', color: 'var(--danger)', margin: 0, fontWeight: 500 }}>{a.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>No critical actions</p>
          )}
        </div>
      </section>
    </div>
  )
}