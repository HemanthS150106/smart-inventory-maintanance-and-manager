/**
 * @param {Record<string, string>[]} rows Parsed forecasts.csv rows
 */
export function computeForecastKpis(rows) {
  const withForecast = rows.filter(
    (r) => r.date && r.forecast !== '' && r.forecast != null,
  )

  if (withForecast.length === 0) {
    return {
      avgDailyDemand: 0,
      forecast28DayTotal: 0,
      confidencePct: 0,
    }
  }

  /** Total predicted demand per calendar day (sum across SKUs / series). */
  const byDate = {}
  for (const r of withForecast) {
    const d = String(r.date).trim()
    const v = Number(r.forecast)
    if (Number.isNaN(v)) continue
    byDate[d] = (byDate[d] ?? 0) + v
  }

  const dailyTotals = Object.values(byDate)
  const avgDailyDemand =
    dailyTotals.length > 0
      ? dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length
      : 0

  const sortedDates = Object.keys(byDate).sort()
  const window = new Set(sortedDates.slice(0, 28))
  let forecast28DayTotal = 0
  for (const r of withForecast) {
    if (window.has(String(r.date).trim())) {
      const v = Number(r.forecast)
      if (!Number.isNaN(v)) forecast28DayTotal += v
    }
  }

  const scores = withForecast
    .map((r) => Number(r.confidence_score))
    .filter((n) => !Number.isNaN(n))
  const avgScore =
    scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0
  const confidencePct = avgScore * 100

  return { avgDailyDemand, forecast28DayTotal, confidencePct }
}
