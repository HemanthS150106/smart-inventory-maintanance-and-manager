/**
 * Map CSV row to alert view model (supports repo schema + spec-style columns).
 * @param {Record<string, string>} row
 */
export function normalizeAlert(row) {
  const sku = row.sku_id ?? row.sku ?? ''
  const status = row.alert_type ?? row.status ?? '—'
  const recommendation = row.recommendation ?? ''

  let priority = Number(row.priority ?? row.severity)
  if (Number.isNaN(priority)) {
    const sev = String(row.severity ?? '').toLowerCase()
    priority =
      sev === 'critical'
        ? 5
        : sev === 'high'
          ? 4
          : sev === 'medium'
            ? 3
            : sev === 'low'
              ? 2
              : 1
  }

  const severity =
    priority >= 5
      ? 'critical'
      : priority >= 4
        ? 'high'
        : priority >= 3
          ? 'medium'
          : priority >= 2
            ? 'low'
            : 'info'

  return { sku, status, recommendation, severity, priority }
}
