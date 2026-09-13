import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { CATEGORIES } from '../lib/types'
import { formatDate, formatMoney } from '../lib/format'

export default function Transactions() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const transactions = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().toArray(),
    [],
  )

  const filtered = useMemo(() => {
    if (!transactions) return []
    return transactions.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [transactions, search, categoryFilter])

  async function updateCategory(id: number, category: string) {
    await db.transactions.update(id, { category })
  }

  if (!transactions) return null

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p>No transactions yet. Upload a statement to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Transactions</h1>
        <p className="text-slate-500 text-sm mt-1">{filtered.length} of {transactions.length} transactions</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description…"
          className="border rounded-md px-3 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-100 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium text-right">Amount</th>
              <th className="px-4 py-2 font-medium">Category</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 whitespace-nowrap text-slate-500">{formatDate(t.date)}</td>
                <td className="px-4 py-2">{t.description}</td>
                <td className={`px-4 py-2 text-right whitespace-nowrap font-medium ${t.amount < 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
                  {formatMoney(t.amount)}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={t.category}
                    onChange={(e) => t.id != null && updateCategory(t.id, e.target.value)}
                    className="border rounded-md px-2 py-1 text-xs bg-slate-50"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
