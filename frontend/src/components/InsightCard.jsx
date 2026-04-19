import Card from './Card.jsx'

const riskStyles = {
  critical: {
    border: 'border-l-red-600',
    badge: 'bg-red-50 text-red-800 ring-red-200',
    label: 'Critical',
  },
  high: {
    border: 'border-l-amber-500',
    badge: 'bg-amber-50 text-amber-900 ring-amber-200',
    label: 'High',
  },
  medium: {
    border: 'border-l-yellow-500',
    badge: 'bg-yellow-50 text-yellow-900 ring-yellow-200',
    label: 'Medium',
  },
  low: {
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    label: 'Low',
  },
}

export default function InsightCard({
  sku,
  productName,
  stockoutRisk,
  headlineDays,
  restockMessage,
  warningReorder,
  criticalMessage,
  currentStock,
  sumForecast28d,
  hasForecast,
}) {
  const r = riskStyles[stockoutRisk] ?? riskStyles.low

  return (
    <Card staticSurface className={`border-l-4 p-5 ${r.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-slate-500 sm:text-sm">{sku}</p>
          {productName ? (
            <p className="mt-0.5 text-sm font-medium text-slate-800">
              {productName}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${r.badge}`}
        >
          Stockout risk: {r.label}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-slate-900">{headlineDays}</p>

      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {criticalMessage ? (
          <li className="font-medium text-red-700">{criticalMessage}</li>
        ) : null}
        {warningReorder ? (
          <li className="text-amber-800">{warningReorder}</li>
        ) : null}
        {restockMessage ? (
          <li className="font-medium text-[var(--si-primary)]">
            {restockMessage}
          </li>
        ) : null}
        {hasForecast ? (
          <li className="text-slate-500">
            On hand:{' '}
            <span className="font-medium text-slate-700">{currentStock}</span>
            {' · '}
            28d forecast sum:{' '}
            <span className="font-medium text-slate-700">
              {sumForecast28d.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}
            </span>
          </li>
        ) : (
          <li className="text-slate-500">
            No matching forecast series for this SKU in{' '}
            <code className="text-xs">forecasts.csv</code>.
          </li>
        )}
      </ul>
    </Card>
  )
}
