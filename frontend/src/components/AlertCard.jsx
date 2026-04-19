import Card from './Card.jsx'

const severityStyles = {
  critical: {
    bar: 'bg-red-600',
    badge: 'bg-red-50 text-red-800 ring-red-200',
    border: 'border-l-red-600',
  },
  high: {
    bar: 'bg-amber-600',
    badge: 'bg-amber-50 text-amber-900 ring-amber-200',
    border: 'border-l-amber-500',
  },
  medium: {
    bar: 'bg-yellow-500',
    badge: 'bg-yellow-50 text-yellow-900 ring-yellow-200',
    border: 'border-l-yellow-500',
  },
  low: {
    bar: 'bg-blue-600',
    badge: 'bg-blue-50 text-blue-800 ring-blue-200',
    border: 'border-l-blue-500',
  },
  info: {
    bar: 'bg-slate-400',
    badge: 'bg-slate-50 text-slate-700 ring-slate-200',
    border: 'border-l-slate-400',
  },
}

/**
 * @param {{ sku: string, status: string, recommendation: string, severity: keyof typeof severityStyles }} props
 */
export default function AlertCard({ sku, status, recommendation, severity }) {
  const s = severityStyles[severity] ?? severityStyles.info

  return (
    <Card
      staticSurface
      className={`border-l-4 ${s.border} p-5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-mono text-xs text-slate-500 sm:text-sm">{sku}</p>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.badge}`}
        >
          <span
            className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${s.bar}`}
            aria-hidden
          />
          {status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        {recommendation}
      </p>
    </Card>
  )
}
