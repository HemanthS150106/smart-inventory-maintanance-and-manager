import { useEffect, useMemo, useState } from 'react'
import InsightCard from '../components/InsightCard.jsx'
import KpiCard from '../components/KpiCard.jsx'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const [forecastsRes, alertsRes, inventoryRes] = await Promise.all([
          loadCsv('/api/forecast'),
          loadCsv('/data/raw/alerts.csv'),
          loadCsv('/data/raw/inventory.csv'),
        ])

        if (cancelled) return

        const fData = forecastsRes.data ?? []
        const aData = (alertsRes.data ?? []).map(normalizeAlert)

        setForecastRows(fData)
        setKpis(computeForecastKpis(fData))
        setAlerts(aData)
        setInventoryRows(inventoryRes.data ?? [])
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

  // 🔥 ONLY KEEP THIS (needed for Recommended Action)
  const priorityOrder = { STOCKOUT: 1, RESTOCK: 2 }

  const topActions = [...alerts]
    .sort((a, b) => (priorityOrder[a.status] || 99) - (priorityOrder[b.status] || 99))
    .slice(0, 3)

  return (
    <div className="space-y-10">
      {/* HEADER */}
      <header>
        <h1 className="si-page-title">Home</h1>
       
      </header>

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* KPI */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Avg daily demand"
            value={loading || !kpis ? '—' : formatDemand(kpis.avgDailyDemand)}
            hint="Mean total forecasted units per day"
          />
          <KpiCard
            label="28-day forecast"
            value={loading || !kpis ? '—' : formatDemand(kpis.forecast28DayTotal)}
            hint="Total demand for next 28 days"
          />
          <KpiCard
            label="Confidence"
            value={loading || !kpis ? '—' : `${kpis.confidencePct.toFixed(1)}%`}
            hint="Average model confidence"
          />
        </div>
      </section>

      {/* INSIGHTS */}
      <section>
        <div className="mb-4 flex justify-between">
          <h2 className="si-section-title">Supply & forecast insights</h2>
          {!loading && (
            <p className="text-sm text-slate-500">
              Showing {visibleInsights.length} of {insights.length}
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading insights…</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 max-h-[70vh] overflow-y-auto">
            {visibleInsights.map((row) => (
              <InsightCard key={row.sku} {...row} />
            ))}
          </div>
        )}
      </section>

      {/* RECOMMENDED ACTION */}
      <section className="si-card p-5">
        <h2 className="si-section-title mb-3">Recommended action</h2>

        {topActions.length > 0 ? (
          <div className="space-y-4">
            {topActions.map((a, i) => (
              <div key={i}>
                <p className="text-sm text-slate-500">SKU</p>
                <p className="font-semibold">{a.sku}</p>
                <p className="text-red-600 font-bold">{a.recommendation}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No critical actions</p>
        )}
      </section>
    </div>
  )
}