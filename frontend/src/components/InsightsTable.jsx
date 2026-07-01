import React from 'react'

function RiskBadge({ risk }) {
  const map = {
    critical: 'bg-red-50 text-red-700 ring-red-200',
    high: 'bg-amber-50 text-amber-800 ring-amber-200',
    medium: 'bg-amber-50 text-amber-800 ring-amber-200',
    low: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  }
  const label = risk === 'critical' ? 'Critical' : risk === 'low' ? 'Low' : 'Warning'
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${map[risk] || map.low}`}>
      {label}
    </span>
  )
}

function StatusBadge({ status, risk }) {
  const map = {
    'Stockout': 'bg-red-50 text-red-700 ring-red-200',
    'Critical replenishment': 'bg-red-50 text-red-700 ring-red-200',
    'Reorder soon': 'bg-amber-50 text-amber-800 ring-amber-200',
    'Monitor inventory': 'bg-amber-50 text-amber-800 ring-amber-200',
    'Stable': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  }
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${map[status] || map.Stable}`}>
      {status}
    </span>
  )
}

export default function InsightsTable({ rows, onSortKey, query, riskFilter }) {
  // rows already precomputed with necessary fields
  const filtered = rows.filter((r) => {
    if (query && !r.sku.toLowerCase().includes(query.toLowerCase())) return false
    if (riskFilter && riskFilter !== 'ALL') {
      if (riskFilter === 'CRITICAL' && r.stockoutRisk !== 'critical') return false
      if (riskFilter === 'WARNING' && r.stockoutRisk === 'low') return false
      if (riskFilter === 'SAFE' && r.stockoutRisk !== 'low') return false
    }
    return true
  })

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-white">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">SKU</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Zone</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Risk</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Status</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Cover Days</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Reorder Qty</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Forecast (28d)</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {filtered.map((r) => (
            <tr key={r.sku} className={r.stockoutRisk === 'critical' ? 'bg-red-50/20' : r.stockoutRisk === 'low' ? 'bg-emerald-50/5' : ''}>
              <td className="px-3 py-3 align-middle text-sm font-mono text-slate-700">{r.sku}</td>
              <td className="px-3 py-3 align-middle text-sm text-slate-700">{r.zoneInfo || 'N/A'}</td>
              <td className="px-3 py-3 align-middle text-sm"><RiskBadge risk={r.stockoutRisk} /></td>
              <td className="px-3 py-3 align-middle text-sm"><StatusBadge status={r.statusLabel} risk={r.stockoutRisk} /></td>
              <td className="px-3 py-3 align-middle text-sm text-right">{r.daysRemaining == null ? '—' : r.daysRemaining.toFixed(1)}</td>
              <td className="px-3 py-3 align-middle text-sm text-right">{r.reorderQuantity > 0 ? r.reorderQuantity.toLocaleString() : '0'}</td>
              <td className="px-3 py-3 align-middle text-sm text-right">{r.sumForecast28d.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
