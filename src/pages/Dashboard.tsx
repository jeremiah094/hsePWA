import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../lib/db'
import { formatMoney, monthLabel } from '../lib/format'

const COLORS = [
  '#0f172a', '#38bdf8', '#f97316', '#22c55e', '#a855f7',
  '#eab308', '#ec4899', '#14b8a6', '#ef4444', '#6366f1',
  '#84cc16', '#f43f5e', '#64748b',
]

export default function Dashboard() {
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])

  const stats = useMemo(() => {
    if (!transactions || transactions.length === 0) return null

    let income = 0
    let expenses = 0
    const byCategory = new Map<string, number>()
    const byMonth = new Map<string, { in: number; out: number }>()

    for (const t of transactions) {
      if (t.amount > 0) income += t.amount
      else expenses += Math.abs(t.amount)

      if (t.amount < 0) {
        byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + Math.abs(t.amount))
      }

      const monthKey = t.date.slice(0, 7)
      const bucket = byMonth.get(monthKey) ?? { in: 0, out: 0 }
      if (t.amount > 0) bucket.in += t.amount
      else bucket.out += Math.abs(t.amount)
      byMonth.set(monthKey, bucket)
    }

    const categoryData = [...byCategory.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const monthData = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month: monthLabel(`${month}-01`), in: Math.round(v.in), out: Math.round(v.out) }))

    const topMerchants = [...transactions]
      .filter((t) => t.amount < 0)
      .reduce((map, t) => {
        map.set(t.description, (map.get(t.description) ?? 0) + Math.abs(t.amount))
        return map
      }, new Map<string, number>())

    const topMerchantsList = [...topMerchants.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    return { income, expenses, categoryData, monthData, topMerchantsList, count: transactions.length }
  }, [transactions])

  if (!transactions) return null

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 space-y-3">
        <p>No data yet — upload a bank statement to see your spending.</p>
        <Link to="/upload" className="inline-block bg-ink text-white px-4 py-2 rounded-md text-sm font-medium">
          Upload a statement
        </Link>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total income" value={formatMoney(stats.income)} tone="positive" />
        <StatCard label="Total spending" value={formatMoney(stats.expenses)} tone="negative" />
        <StatCard label="Net" value={formatMoney(stats.income - stats.expenses)} tone={stats.income >= stats.expenses ? 'positive' : 'negative'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-3">Spending by category</h2>
          {stats.categoryData.length === 0 ? (
            <p className="text-slate-400 text-sm">No expenses recorded.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={stats.categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {stats.categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-3">Income vs spending by month</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.monthData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="in" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="out" name="Spending" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">Top merchants</h2>
        {stats.topMerchantsList.length === 0 ? (
          <p className="text-slate-400 text-sm">No expenses recorded.</p>
        ) : (
          <ul className="divide-y text-sm">
            {stats.topMerchantsList.map(([name, value]) => (
              <li key={name} className="py-2 flex items-center justify-between">
                <span>{name}</span>
                <span className="font-medium">{formatMoney(value)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'negative' }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-slate-500 text-xs">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${tone === 'positive' ? 'text-emerald-600' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}
