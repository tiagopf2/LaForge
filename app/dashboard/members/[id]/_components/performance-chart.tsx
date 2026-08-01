'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

interface Record {
  id: string
  value: number
  recordedAt: string
  reps?: number | null
  sets?: number | null
  unit: string
}

export default function PerformanceChart({ records, movementName }: { records: Record[]; movementName: string }) {
  const sortedRecords = [...(records ?? [])].sort((a: Record, b: Record) =>
    new Date(a?.recordedAt ?? 0).getTime() - new Date(b?.recordedAt ?? 0).getTime()
  )

  const data = (sortedRecords ?? []).map((r: Record) => ({
    date: r?.recordedAt ? new Date(r.recordedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '',
    value: r?.value ?? 0,
    label: r?.unit === 'kg'
      ? `${r?.value ?? 0}kg${r?.reps ? ` x${r.reps}` : ''}${r?.sets ? ` (${r.sets}s)` : ''}`
      : `${r?.value ?? 0}s`,
  }))

  if ((data?.length ?? 0) < 2) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {(data?.length ?? 0) === 1
          ? `Latest: ${data?.[0]?.label ?? 'N/A'}`
          : 'Not enough data for chart'}
      </div>
    )
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
          <XAxis
            dataKey="date"
            tickLine={false}
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            label={{ value: 'Date', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }}
          />
          <YAxis
            tickLine={false}
            tick={{ fontSize: 10 }}
            label={{ value: records?.[0]?.unit === 'kg' ? 'kg' : 'sec', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
          />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(25, 95%, 53%)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'hsl(25, 95%, 53%)' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
