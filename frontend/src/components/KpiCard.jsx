import Card from './Card.jsx'

/**
 * @param {{ label: string, value: string, hint?: string }} props
 */
export default function KpiCard({ label, value, hint }) {
  return (
    <Card className="p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-sm text-slate-500">{hint}</p>
      ) : null}
    </Card>
  )
}
