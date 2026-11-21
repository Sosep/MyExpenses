import { useId, useMemo, useState } from 'react'
import type { PointerEvent } from 'react'
import { t } from '@lingui/core/macro'
import { formatDate } from '../format'
import { useMoney } from '../privacy'

export interface LineSeries {
  key: string
  label: string
  /** A CSS color from the design tokens (categorical palette). */
  color: string
  points: { date: string; valueMinor: number }[]
}

interface LineChartProps {
  series: LineSeries[]
  currency: string
  fractionDigits: number
  ariaLabel: string
  /** DAY/WEEK/MONTH; labels adapt to it. */
  granularity?: 'DAY' | 'WEEK' | 'MONTH'
  emptyMessage?: string
}

const WIDTH = 640
const HEIGHT = 240
const PAD_LEFT = 8
const PAD_RIGHT = 8
const PAD_TOP = 14
const PAD_BOTTOM = 26
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM

function labelFor(date: string, granularity: LineChartProps['granularity']): string {
  if (granularity === 'MONTH') {
    return formatDate(date, { month: 'short', year: '2-digit' })
  }
  if (granularity === 'WEEK') {
    return formatDate(date, { day: '2-digit', month: 'short' })
  }
  return formatDate(date, { day: '2-digit', month: 'short' })
}

/**
 * A small SVG line chart with a hover/touch tooltip, a toggleable legend and a
 * textual table with the same points. It has no chart dependency and uses only
 * the design tokens; every money string goes through the privacy scope so a
 * hidden total never leaks a digit.
 */
export function LineChart({
  series,
  currency,
  fractionDigits,
  ariaLabel,
  granularity = 'DAY',
  emptyMessage,
}: LineChartProps) {
  const money = useMoney('totals')
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  const visible = series.filter((entry) => !hiddenSeries.has(entry.key))
  const dates = series[0]?.points.map((point) => point.date) ?? []
  const values = visible.flatMap((entry) => entry.points.map((point) => point.valueMinor))

  const { min, max } = useMemo(() => {
    if (values.length === 0) return { min: 0, max: 1 }
    let low = Math.min(...values)
    let high = Math.max(...values)
    if (low === high) {
      const pad = Math.max(Math.abs(low) * 0.05, 1)
      low -= pad
      high += pad
    } else {
      const pad = (high - low) * 0.08
      low -= pad
      high += pad
    }
    return { min: low, max: high }
  }, [values])

  if (series.length === 0 || dates.length === 0) {
    return (
      <div className="empty chart-empty">
        <h3>{t`No history to draw yet`}</h3>
        <p>{emptyMessage ?? t`Record a movement and its balance will appear here.`}</p>
      </div>
    )
  }

  const x = (index: number) =>
    PAD_LEFT + (dates.length <= 1 ? PLOT_WIDTH / 2 : (index / (dates.length - 1)) * PLOT_WIDTH)
  const y = (value: number) =>
    PAD_TOP + ((max - value) / (max - min || 1)) * PLOT_HEIGHT

  const pathFor = (entry: LineSeries) =>
    entry.points
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)} ${y(point.valueMinor).toFixed(2)}`,
      )
      .join(' ')

  const areaFor = (entry: LineSeries) =>
    `${pathFor(entry)} L${x(entry.points.length - 1).toFixed(2)} ${
      PAD_TOP + PLOT_HEIGHT
    } L${x(0).toFixed(2)} ${PAD_TOP + PLOT_HEIGHT} Z`

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const relative = ((event.clientX - rect.left) / rect.width) * WIDTH
    const ratio = (relative - PAD_LEFT) / PLOT_WIDTH
    const index = Math.round(ratio * Math.max(dates.length - 1, 0))
    setActive(Math.min(Math.max(index, 0), dates.length - 1))
  }

  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => PAD_TOP + ratio * PLOT_HEIGHT)
  const tickIndexes =
    dates.length <= 6
      ? dates.map((_, index) => index)
      : [0, Math.round((dates.length - 1) / 3), Math.round((2 * (dates.length - 1)) / 3), dates.length - 1]

  return (
    <div className="line-chart">
      <div className="line-chart-plot">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
        >
          <defs>
            {visible.map((entry) => (
              <linearGradient
                key={entry.key}
                id={`${gradientId}-${entry.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={entry.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={entry.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {grid.map((line, index) => (
            <line
              key={line}
              className="line-chart-grid"
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={line}
              y2={line}
              data-last={index === grid.length - 1 ? '1' : undefined}
            />
          ))}
          {visible.length === 1 ? (
            <path
              d={areaFor(visible[0])}
              fill={`url(#${gradientId}-${visible[0].key})`}
              stroke="none"
            />
          ) : null}
          {visible.map((entry) => (
            <path
              key={entry.key}
              className="line-chart-line"
              d={pathFor(entry)}
              fill="none"
              stroke={entry.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            >
              <title>{entry.label}</title>
            </path>
          ))}
          {active !== null ? (
            <line
              className="line-chart-cursor"
              x1={x(active)}
              x2={x(active)}
              y1={PAD_TOP}
              y2={PAD_TOP + PLOT_HEIGHT}
            />
          ) : null}
          {active !== null
            ? visible.map((entry) =>
                entry.points[active] ? (
                  <circle
                    key={entry.key}
                    cx={x(active)}
                    cy={y(entry.points[active].valueMinor)}
                    r="3.5"
                    fill={entry.color}
                  />
                ) : null,
              )
            : null}
          {tickIndexes.map((index) => (
            <text
              key={index}
              className="line-chart-tick"
              x={x(index)}
              y={HEIGHT - 6}
              textAnchor={
                index === 0 ? 'start' : index === dates.length - 1 ? 'end' : 'middle'
              }
            >
              {labelFor(dates[index], granularity)}
            </text>
          ))}
        </svg>
        {active !== null ? (
          <div
            className="line-chart-tooltip"
            style={{
              left: `${(x(active) / WIDTH) * 100}%`,
            }}
            role="status"
          >
            <strong>{formatDate(dates[active], { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
            {visible.map((entry) => (
              <span key={entry.key}>
                <i className="dot" style={{ background: entry.color }} />
                {entry.label}: {money(entry.points[active]?.valueMinor ?? 0, currency, fractionDigits)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="chart-legend line-chart-legend">
        {series.map((entry) => {
          const hidden = hiddenSeries.has(entry.key)
          return (
            <button
              key={entry.key}
              type="button"
              className={`chart-legend-item ${hidden ? 'off' : ''}`}
              aria-pressed={!hidden}
              onClick={() =>
                setHiddenSeries((current) => {
                  const next = new Set(current)
                  if (next.has(entry.key)) next.delete(entry.key)
                  else next.add(entry.key)
                  return next
                })
              }
            >
              <i className="dot" style={{ background: entry.color }} />
              {entry.label}
            </button>
          )
        })}
      </div>
      <details className="chart-data">
        <summary>{t`View the data as a table`}</summary>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t`Date`}</th>
                {visible.map((entry) => (
                  <th key={entry.key}>{entry.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date, index) => (
                <tr key={date}>
                  <td>{date}</td>
                  {visible.map((entry) => (
                    <td key={entry.key} className="num">
                      {money(entry.points[index]?.valueMinor ?? 0, currency, fractionDigits)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
