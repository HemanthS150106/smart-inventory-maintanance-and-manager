/**
 * Aggregate forecast CSV rows by calendar day (sum across SKUs / series).
 * @param {Record<string, string>[]} rows
 */
export function buildDailyForecastSeries(rows) {
  const byDate = {}

  for (const r of rows) {
    const d = String(r.date ?? '').trim()
    if (!d) continue

    if (!byDate[d]) {
      byDate[d] = { forecast: 0, lower: 0, upper: 0 }
    }

    const f = Number(r.forecast)
    const lo = Number(r.lower_bound)
    const hi = Number(r.upper_bound)

    if (!Number.isNaN(f)) byDate[d].forecast += f
    if (!Number.isNaN(lo)) byDate[d].lower += lo
    if (!Number.isNaN(hi)) byDate[d].upper += hi
  }

  const rawDates = Object.keys(byDate).sort()

  const shortLabel = (iso) => {
    const parts = iso.split('-')
    if (parts.length >= 3) return `${parts[1]}/${parts[2]}`
    return iso
  }

  return {
    rawDates,
    labels: rawDates.map(shortLabel),
    forecast: rawDates.map((d) => byDate[d].forecast),
    lower: rawDates.map((d) => byDate[d].lower),
    upper: rawDates.map((d) => byDate[d].upper),
  }
}

/**
 * @param {Record<string, string>[]} rows
 * @param {ReturnType<typeof buildDailyForecastSeries>} series
 */
export function computeForecastPageStats(rows, series) {
  const { rawDates, forecast } = series

  let peakIdx = 0
  let peakVal = 0
  for (let i = 0; i < forecast.length; i++) {
    if (forecast[i] > peakVal) {
      peakVal = forecast[i]
      peakIdx = i
    }
  }

  const scores = rows
    .map((r) => Number(r.confidence_score))
    .filter((n) => !Number.isNaN(n))
  const avgConfidencePct =
    scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100
      : 0

  const modelCounts = {}
  for (const r of rows) {
    const m = String(r.model ?? '').trim() || 'unknown'
    modelCounts[m] = (modelCounts[m] ?? 0) + 1
  }
  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]

  const sum = forecast.reduce((a, b) => a + b, 0)
  const horizonDays = rawDates.length

  /** Simple trend: compare mean of first 7 vs last 7 daily totals. */
  let trendPct = 0
  if (forecast.length >= 14) {
    const first = forecast.slice(0, 7)
    const last = forecast.slice(-7)
    const a1 = first.reduce((x, y) => x + y, 0) / first.length
    const a2 = last.reduce((x, y) => x + y, 0) / last.length
    trendPct = a1 > 0 ? ((a2 - a1) / a1) * 100 : 0
  }

  return {
    horizonDays,
    totalForecast: sum,
    avgDaily: horizonDays > 0 ? sum / horizonDays : 0,
    peakDate: rawDates[peakIdx] ?? '—',
    peakValue: peakVal,
    avgConfidencePct,
    topModel: topModel ? { name: topModel[0], count: topModel[1] } : null,
    trendPct,
  }
}

/**
 * @param {ReturnType<typeof computeForecastPageStats>} stats
 */
export function buildModelInsightsParagraph(stats) {
  const parts = []
  if (stats.topModel) {
    parts.push(
      `Projections in this dataset are produced primarily by **${stats.topModel.name}**, covering ${stats.topModel.count.toLocaleString()} forecast rows.`,
    )
  }
  parts.push(
    `Average model confidence is **${stats.avgConfidencePct.toFixed(1)}%** across the horizon.`,
  )
  if (stats.horizonDays > 0) {
    parts.push(
      `The plotted horizon spans **${stats.horizonDays}** calendar days, with network-level demand peaking on **${stats.peakDate}** (${stats.peakValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} units in the aggregate).`,
    )
  }
  if (Math.abs(stats.trendPct) >= 1) {
    const dir = stats.trendPct > 0 ? 'rising' : 'falling'
    parts.push(
      `Comparing the first and last week of the series, aggregate demand appears **${dir}** (≈${Math.abs(stats.trendPct).toFixed(1)}% change in daily means).`,
    )
  }
  return parts.join(' ')
}

/**
 * @param {ReturnType<typeof computeForecastPageStats>} stats
 */
export function buildBusinessRecommendations(stats) {
  const items = []

  if (stats.trendPct > 5) {
    items.push(
      'Demand is trending up toward the end of the horizon—pull forward replenishment for high-velocity SKUs and validate capacity with suppliers.',
    )
  } else if (stats.trendPct < -5) {
    items.push(
      'Aggregate demand softens late in the horizon—avoid over-ordering on promotional stock and rebalance safety stock downward where policy allows.',
    )
  }

  if (stats.avgConfidencePct < 45) {
    items.push(
      'Confidence scores are relatively low; require human approval on purchase orders generated from these forecasts until models are retuned or features refreshed.',
    )
  } else if (stats.avgConfidencePct >= 75) {
    items.push(
      'Confidence is strong for this export—safe to use automated reorder suggestions as a default, with spot checks on top-decile SKUs by value.',
    )
  }

  items.push(
    'Treat the shaded band (aggregate lower and upper bounds) as a stress envelope: size safety stock so critical SKUs survive upper-bound demand for at least one lead-time cycle.',
  )

  items.push(
    'Cross-check the peak day against marketing and seasonality calendars; if unexplained, flag data quality or external demand shocks before locking the plan.',
  )

  return items
}
