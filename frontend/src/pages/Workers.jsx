import { useEffect, useMemo, useState } from 'react'
import { computeInventoryInsights } from '../utils/inventoryInsights.js'
import { loadCsv } from '../utils/loadCsv.js'
import workerData from '../data/warehouse_workers_final.json'

const WORKERS = workerData.workers.map((worker) => ({
  id: worker.worker_id,
  name: worker.name,
  role: worker.role,
  shift: worker.shift,
  status: worker.status,
  tasksCompleted: worker.tasks_completed,
  age: worker.age,
  gender: worker.gender,
}))

const STATUS_MAP = {
  critical: { label: 'Critical', tone: 'bg-[#FFF7E6] text-[#B7791F]' },
  high: { label: 'High', tone: 'bg-amber-100 text-amber-800' },
  medium: { label: 'Medium', tone: 'bg-sky-100 text-sky-700' },
  low: { label: 'Low', tone: 'bg-emerald-100 text-emerald-800' },
}

function formatDemand(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export default function Workers() {
  const [inventoryRows, setInventoryRows] = useState([])
  const [forecastRows, setForecastRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('workerAssignments') || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      setLoading(true)
      try {
        const [forecastRes, inventoryRes] = await Promise.all([
          loadCsv('/api/forecast'),
          loadCsv('/data/raw/inventory.csv'),
        ])

        if (cancelled) return
        setForecastRows(forecastRes.data ?? [])
        setInventoryRows(inventoryRes.data ?? [])
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('workerAssignments', JSON.stringify(assignments))
    } catch {
      // ignore storage failures
    }
  }, [assignments])

  const insights = useMemo(
    () => computeInventoryInsights(inventoryRows, forecastRows),
    [inventoryRows, forecastRows],
  )

  const tasks = useMemo(() => {
    return [...insights]
      .sort((a, b) => b.sumForecast28d - a.sumForecast28d)
      .slice(0, 8)
      .map((item) => ({
        sku: item.sku,
        name: item.productName || item.sku,
        demand: item.sumForecast28d,
        currentStock: item.currentStock,
        daysRemaining: item.daysRemaining,
        risk: item.stockoutRisk,
      }))
  }, [insights])

  const workerSummary = useMemo(() => {
    return WORKERS.map((worker) => ({
      ...worker,
      assigned: tasks.filter((task) => assignments[task.sku] === worker.id).length,
    }))
  }, [assignments, tasks])

  const handleAssign = (taskSku, workerId) => {
    setAssignments((prev) => ({
      ...prev,
      [taskSku]: workerId || undefined,
    }))
  }

  const unassignedCount = tasks.filter((task) => !assignments[task.sku]).length
  const [showAllWorkers, setShowAllWorkers] = useState(false)
  const displayedWorkers = showAllWorkers ? WORKERS : WORKERS.slice(0, 10)

  return (
    <div className="space-y-8 pb-20">
      <header className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="si-page-title">Workers & Task Assignments</h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Team members</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{WORKERS.length}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Open tasks</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{unassignedCount}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">High demand tasks</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{tasks.length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">High-demand task queue</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">Realtime</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white text-slate-500 uppercase text-[10px] tracking-[0.18em]">
                  <tr>
                    <th className="px-4 py-4">Task</th>
                    <th className="px-4 py-4">Demand</th>
                    <th className="px-4 py-4">Stock</th>
                    <th className="px-4 py-4">Risk</th>
                    <th className="px-4 py-4">Worker</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-50 divide-y divide-slate-200">
                  {tasks.map((task) => {
                    const assignedWorker = WORKERS.find((worker) => assignments[task.sku] === worker.id)
                    return (
                      <tr key={task.sku} className="bg-white hover:bg-slate-50 transition">
                        <td className="px-4 py-4 align-middle">
                          <div className="font-semibold text-slate-900">{task.name}</div>
                          <div className="text-xs text-slate-500 mt-1">SKU {task.sku}</div>
                        </td>
                        <td className="px-4 py-4 align-middle text-slate-700">{formatDemand(task.demand)} u</td>
                        <td className="px-4 py-4 align-middle text-slate-700">{task.currentStock.toLocaleString()} u</td>
                        <td className="px-4 py-4 align-middle">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_MAP[task.risk]?.tone || STATUS_MAP.low.tone}`}>
                            {STATUS_MAP[task.risk]?.label || 'Low'}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <select
                            value={assignments[task.sku] || ''}
                            onChange={(event) => handleAssign(task.sku, event.target.value)}
                            className="si-input w-full"
                          >
                            <option value="">Unassigned</option>
                            {WORKERS.map((worker) => (
                              <option key={worker.id} value={worker.id}>
                                {worker.name}
                              </option>
                            ))}
                          </select>
                          {assignedWorker && (
                            <p className="mt-2 text-xs text-slate-500">Assigned to {assignedWorker.role}</p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900">Assignment summary</h2>
              {WORKERS.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllWorkers((value) => !value)}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  {showAllWorkers ? 'Show top 10' : `Show all ${WORKERS.length}`}
                </button>
              )}
            </div>
            <div className="mt-6 space-y-3">
              {displayedWorkers.map((worker) => {
                const summary = workerSummary.find((item) => item.id === worker.id)
                return (
                  <div key={worker.id} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{worker.name}</p>
                      <p className="text-xs text-slate-500">{worker.role}</p>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{summary?.assigned ?? 0} tasks</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Team capacity</h2>
            <div className="mt-6 grid gap-3">
              {displayedWorkers.map((worker) => {
                const summary = workerSummary.find((item) => item.id === worker.id)
                return (
                  <div key={worker.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{worker.name}</p>
                        <p className="text-xs text-slate-500">{worker.role}</p>
                      </div>
                      <div className={`text-sm font-semibold ${summary?.assigned >= 3 ? 'text-[#B7791F]' : 'text-emerald-700'}`}>
                        {summary?.assigned ?? 0} tasks
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white shadow-inner">
                      <div
                        className={`h-2 rounded-full ${summary?.assigned >= 3 ? 'bg-[#B7791F]' : 'bg-slate-700'}`}
                        style={{ width: `${Math.min(100, (summary?.assigned ?? 0) * 25)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </aside>
      </div>

      {loading && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">Loading worker workload…</div>
      )}
    </div>
  )
}
