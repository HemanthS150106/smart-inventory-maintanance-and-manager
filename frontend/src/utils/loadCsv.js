import Papa from 'papaparse'

/**
 * @param {string} path Absolute path e.g. "/data/alerts.csv"
 * @returns {Promise<{ data: Record<string, string>[], errors: Papa.ParseError[] }>}
 */
export async function loadCsv(path) {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`)
  }
  const text = await res.text()
  return Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  })
}
