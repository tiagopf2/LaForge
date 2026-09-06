'use client'

import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

interface Record {
  id: string
  value: number
  recordedAt: string
  reps?: number | null
  sets?: number | null
  unit: string
}

/** Most ticks a chart this size can print before the labels collide. */
const MAX_TICKS = 6

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: '2-digit' }

export default function PerformanceChart({ records, movementName }: { records: Record[]; movementName: string }) {
  const data = useMemo(() => {
    return (records ?? [])
      .map((r: Record) => ({
        // The axis plots real time, not the row order, so two results a day
        // apart sit a day apart and two months apart sit two months apart.
        ts: new Date(r?.recordedAt ?? 0).getTime(),
        value: r?.value ?? 0,
        label:
          r?.unit === 'kg'
            ? `${r?.value ?? 0}kg${r?.reps ? ` x${r.reps}` : ''}${r?.sets ? ` (${r.sets}s)` : ''}`
            : `${r?.value ?? 0}s`,
      }))
      .filter((d) => Number.isFinite(d.ts))
      .sort((a, b) => a.ts - b.ts)
  }, [records])

  // A range spanning more than one calendar year needs the year on the tick to
  // stay unambiguous; within one year it is noise.
  const spansYears =
    data.length > 1 &&
    new Date(data[0].ts).getFullYear() !== new Date(data[data.length - 1].ts).getFullYear()

  // One tick per distinct day, thinned to what fits. Ticking every point
  // repeated the same date once per result whenever a member was logged more
  // than once in a day.
  const ticks = useMemo(() => thin(firstPerDay(data), MAX_TICKS), [data])

  const formatTick = (ts: number) =>
    new Date(ts).toLocaleDateString('en-GB', spansYears ? DAY_MONTH_YEAR : DAY_MONTH)

  if (data.length < 2) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {data.length === 1
          ? `Latest: ${data[0]?.label ?? 'N/A'} · ${formatTick(data[0].ts)}`
          : 'Not enough data for chart'}
      </div>
    )
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={ticks}
            tickFormatter={formatTick}
            tickLine={false}
            tick={{ fontSize: 10 }}
            label={{ value: 'Date', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }}
          />
          <YAxis
            tickLine={false}
            tick={{ fontSize: 10 }}
            label={{ value: records?.[0]?.unit === 'kg' ? 'kg' : 'sec', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
          />
          <Tooltip
            contentStyle={{ fontSize: 11 }}
            labelFormatter={(ts) =>
              new Date(Number(ts)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            }
            formatter={(value, _name, item) => [item?.payload?.label ?? `${value ?? 0}`, movementName]}
          />
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

/** The first timestamp of each calendar day present in the data. */
function firstPerDay(data: { ts: number }[]): number[] {
  const seen = new Set<string>()
  const out: number[] = []
  for (const point of data) {
    const day = new Date(point.ts).toDateString()
    if (seen.has(day)) continue
    seen.add(day)
    out.push(point.ts)
  }
  return out
}

/** Evenly drops values until at most `max` remain, always keeping both ends. */
function thin(values: number[], max: number): number[] {
  if (values.length <= max) return values
  const step = (values.length - 1) / (max - 1)
  const picked = new Set<number>()
  for (let i = 0; i < max; i += 1) picked.add(values[Math.round(i * step)])
  return [...picked].sort((a, b) => a - b)
}
