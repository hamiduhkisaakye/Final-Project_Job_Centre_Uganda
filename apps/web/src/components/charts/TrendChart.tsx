'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

// Generic "X over time" chart — one axis, thin 2px lines, recessive
// grid/axis ink, tooltip + legend always on (dataviz skill: never a
// dual-axis chart; legend present for >=2 series, none needed for one).
export default function TrendChart({
  data,
  series,
  height = 220,
}: {
  data: Record<string, string | number>[];
  series: TrendSeries[];
  height?: number;
}) {
  if (data.length === 0) {
    return <div className="h-[220px] flex items-center justify-center text-sm text-muted">No data yet for this period.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#EAF2FA" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#6B7A8D' }}
          axisLine={{ stroke: '#D7E3F2' }}
          tickLine={false}
          tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        />
        <YAxis tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D7E3F2', boxShadow: '0 4px 12px rgba(30,95,191,.12)' }}
          labelFormatter={(d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={s.color}
            fillOpacity={0.12}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
