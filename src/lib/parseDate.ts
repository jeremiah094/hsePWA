// Bank statements use inconsistent date formats. Try the common ones and
// fall back to native parsing before giving up.
export function parseDateToISO(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // ISO already: 2024-01-31
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return toISO(m[1], m[2], m[3])

  // 31/01/2024 or 01/31/2024 or 31-01-2024 (assume DD/MM/YYYY unless first part > 12)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    let [, a, b, y] = m
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y
    const first = Number(a)
    const second = Number(b)
    if (first > 12 && second <= 12) return toISO(y, b, a) // DD/MM/YYYY
    if (second > 12 && first <= 12) return toISO(y, a, b) // MM/DD/YYYY
    return toISO(y, a, b) // ambiguous: assume MM/DD/YYYY (US bank default)
  }

  // "Jan 31, 2024" / "31 Jan 2024"
  const parsed = Date.parse(s)
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed)
    return toISO(String(d.getFullYear()), String(d.getMonth() + 1), String(d.getDate()))
  }

  return null
}

function toISO(y: string, m: string, d: string): string {
  const yyyy = y.padStart(4, '0')
  const mm = m.padStart(2, '0')
  const dd = d.padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
