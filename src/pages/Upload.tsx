import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, clearAllData } from '../lib/db'
import { importStatementFile, type ImportResult } from '../lib/importStatement'
import Dropzone from '../components/Dropzone'
import { formatDate } from '../lib/format'

export default function Upload() {
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const statements = useLiveQuery(() => db.statements.orderBy('uploadedAt').reverse().toArray(), [])

  async function handleFiles(files: File[]) {
    setBusy(true)
    const newResults: ImportResult[] = []
    for (const file of files) {
      const result = await importStatementFile(file)
      newResults.push(result)
    }
    setResults(newResults)
    setBusy(false)
  }

  async function handleClear() {
    if (!confirm('Delete all imported statements and transactions from this browser?')) return
    await clearAllData()
    setResults([])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Upload statements</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload a few bank statements (CSV or PDF) to see them parsed into transactions.
        </p>
      </div>

      <Dropzone onFiles={handleFiles} busy={busy} />

      {results.length > 0 && (
        <div className="bg-white border rounded-lg divide-y">
          {results.map((r, i) => (
            <div key={i} className="px-4 py-3 text-sm flex items-center justify-between">
              <span className="font-medium">{r.fileName}</span>
              {r.error ? (
                <span className="text-red-600">{r.error}</span>
              ) : (
                <span className="text-slate-500">
                  {r.imported} imported
                  {r.duplicates > 0 ? `, ${r.duplicates} duplicate${r.duplicates === 1 ? '' : 's'} skipped` : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Imported statements</h2>
          {statements && statements.length > 0 && (
            <button onClick={handleClear} className="text-sm text-red-600 hover:underline">
              Clear all data
            </button>
          )}
        </div>
        {!statements || statements.length === 0 ? (
          <p className="text-slate-400 text-sm">No statements imported yet.</p>
        ) : (
          <table className="w-full text-sm bg-white border rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">File</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Uploaded</th>
                <th className="px-4 py-2 font-medium text-right">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {statements.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2">{s.fileName}</td>
                  <td className="px-4 py-2 uppercase text-slate-500">{s.fileType}</td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(s.uploadedAt.slice(0, 10))}</td>
                  <td className="px-4 py-2 text-right">{s.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
