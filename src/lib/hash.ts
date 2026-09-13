// Small stable string hash (djb2) — good enough for transaction dedup fingerprints.
export function hashRow(...parts: Array<string | number>): string {
  const input = parts.join('|')
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}
