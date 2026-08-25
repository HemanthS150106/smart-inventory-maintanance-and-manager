/** @typedef {'critical' | 'high' | 'medium' | 'low'} StockoutRisk */

const RISK_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

/**
 * @param {Record<string, string>[]} forecastRows
 */
function globalForecastDateWindow(forecastRows) {
  const dates = [
    ...new Set(
      forecastRows
        .map((r) => String(r.date ?? '').trim())
        .filter(Boolean),
    ),
  ].sort()
  return new Set(dates.slice(0, 28))
}

/**
 * Forecast key: `id` or `sku` in CSV.
 * @param {Record<string, string>} row
 */
function forecastSkuKey(row) {
  return String(row.id ?? row.sku ?? '').trim()
}

/**
 * Inventory key: `sku_id` or `sku`.
 * @param {Record<string, string>} row
 */
function inventorySkuKey(row) {
  return String(row.sku_id ?? row.sku ?? '').trim()
}

/**
 * Combine inventory + forecasts into per-SKU supply metrics.
 * @param {Record<string, string>[]} inventoryRows
 * @param {Record<string, string>[]} forecastRows
 */
export function computeInventoryInsights(inventoryRows, forecastRows) {
  const windowDates = globalForecastDateWindow(forecastRows)

  /** @type {Map<string, Record<string, string>[]>} */
  const bySku = new Map()
  for (const r of forecastRows) {
    const k = forecastSkuKey(r)
    if (!k) continue
    if (!bySku.has(k)) bySku.set(k, [])
    bySku.get(k).push(r)
  }

  /** @type {ReturnType<typeof buildOneInsight>[]} */
  const out = []

  for (const inv of inventoryRows) {
    const sku = inventorySkuKey(inv)
    if (!sku) continue

    const fr = bySku.get(sku) ?? []
    const insight = buildOneInsight(inv, fr, windowDates)
    if (insight) out.push(insight)
  }

  out.sort(
    (a, b) => RISK_ORDER[a.stockoutRisk] - RISK_ORDER[b.stockoutRisk],
  )
  return out
}

/**
 * @param {Record<string, string>} inv
 * @param {Record<string, string>[]} fr
 * @param {Set<string>} windowDates
 */
function buildOneInsight(inv, fr, windowDates) {
  const sku = inventorySkuKey(inv)
  const productName = String(inv.product_name ?? '').trim() || null

  const stock = Number(inv.current_stock)
  const reorderPoint = Number(inv.reorder_point)
  const safetyStock = Number(inv.safety_stock)
  const leadRaw = inv.lead_time_days
  const leadTimeDays =
    leadRaw !== undefined && leadRaw !== '' && !Number.isNaN(Number(leadRaw))
      ? Number(leadRaw)
      : 7
  const zoneInfo = String(inv.store_id ?? inv.sku_id ?? '').trim()

  if (Number.isNaN(stock)) return null

  const dateSet = new Set(
    fr.map((r) => String(r.date ?? '').trim()).filter(Boolean),
  )
  const nDays = dateSet.size

  let totalForecast = 0
  let sum28 = 0
  for (const r of fr) {
    const v = Number(r.forecast)
    if (Number.isNaN(v)) continue
    totalForecast += v
    const d = String(r.date ?? '').trim()
    if (windowDates.has(d)) sum28 += v
  }

  const avgDailyDemand = windowDates.size > 0 ? sum28 / windowDates.size : 0
  const daysRemaining =
    avgDailyDemand > 0 ? stock / avgDailyDemand : null

  const daysShort =
    daysRemaining == null ? null : Math.max(0, leadTimeDays - daysRemaining)

  const belowReorder =
    !Number.isNaN(reorderPoint) && stock < reorderPoint
  const forecastExceedsStock = sum28 > stock
  const criticalLeadTime =
    daysRemaining !== null &&
    daysRemaining < leadTimeDays &&
    avgDailyDemand > 0

  const reorderQuantity =
    !Number.isNaN(reorderPoint) && reorderPoint > stock
      ? Math.max(Math.round(reorderPoint - stock), 0)
      : 0

  const stockoutDate = computeStockoutDate(stock, fr)
  const lastForecastTimestamp = computeLastForecastDate(fr)

  /** @type {StockoutRisk} */
  let stockoutRisk = 'low'
  if (stock <= 0 || criticalLeadTime) {
    stockoutRisk = 'critical'
  } else if (belowReorder) {
    stockoutRisk = 'high'
  } else if (forecastExceedsStock) {
    stockoutRisk = 'medium'
  }

  const autoReplenishEligible =
    stockoutRisk === 'critical' &&
    daysRemaining !== null &&
    leadTimeDays != null &&
    daysRemaining < leadTimeDays &&
    reorderQuantity > 0

  let headlineDays
  if (stock <= 0) {
    headlineDays = 'Out of stock.'
  } else if (daysRemaining === null) {
    headlineDays =
      'Not enough forecast history to estimate days on hand.'
  } else {
    headlineDays = `Stock will last ${daysRemaining >= 100 ? Math.round(daysRemaining) : daysRemaining.toFixed(1)} days.`
  }

  const restockMessage = forecastExceedsStock
    ? 'Restock recommended because forecast exceeds stock.'
    : null

  const warningReorder = belowReorder
    ? 'Warning: on-hand is below the reorder point.'
    : null

  const criticalMessage = criticalLeadTime
    ? `Critical: projected cover (${daysRemaining != null ? daysRemaining.toFixed(1) : '—'} days) is shorter than lead time (${leadTimeDays} days).`
    : null

  const statusLabel = stock <= 0
    ? 'Stockout'
    : criticalLeadTime
      ? 'Critical replenishment'
      : belowReorder
        ? 'Reorder soon'
        : forecastExceedsStock
          ? 'Monitor inventory'
          : 'Stable'

  return {
    sku,
    productName,
    currentStock: stock,
    reorderPoint: Number.isNaN(reorderPoint) ? null : reorderPoint,
    reorderQuantity,
    safetyStock: Number.isNaN(safetyStock) ? null : safetyStock,
    leadTimeDays,
    avgDailyDemand,
    daysRemaining,
    daysShort,
    sumForecast28d: sum28,
    stockoutRisk,
    belowReorder,
    forecastExceedsStock,
    criticalLeadTime,
    headlineDays,
    restockMessage,
    warningReorder,
    criticalMessage,
    zoneInfo,
    stockoutDate,
    lastForecastTimestamp,
    statusLabel,
    autoReplenishEligible,
    hasForecast: fr.length > 0,
  }
}

/**
 * @param {number} stock
 * @param {Record<string, string>[]} fr
 */
function computeStockoutDate(stock, fr) {
  if (stock <= 0) return null

  const dailyByDate = new Map()
  for (const row of fr) {
    const date = String(row.date ?? '').trim()
    if (!date) continue
    const forecast = Number(row.forecast)
    if (Number.isNaN(forecast)) continue
    dailyByDate.set(date, (dailyByDate.get(date) || 0) + forecast)
  }

  const dates = [...dailyByDate.keys()]
    .filter((d) => Boolean(d))
    .sort((a, b) => new Date(a) - new Date(b))

  let remaining = stock
  for (const date of dates) {
    remaining -= dailyByDate.get(date) ?? 0
    if (remaining <= 0) {
      return date
    }
  }
  return null
}

/**
 * @param {Record<string, string>[]} fr
 */
function computeLastForecastDate(fr) {
  let latest = null
  for (const row of fr) {
    const date = String(row.date ?? '').trim()
    if (!date) continue
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) continue
    if (!latest || parsed > latest) latest = parsed
  }
  return latest ? latest.toISOString().slice(0, 10) : null
}
