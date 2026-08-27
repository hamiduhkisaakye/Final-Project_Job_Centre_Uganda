'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from 'recharts';

export interface StageBar {
  label: string;
  count: number;
  color: string;
}

// One measure ("count") across ordered categories — an ordinal ramp, not a
// categorical set, per the dataviz skill's guidance for funnel/stage charts:
// bars share a progression hue except where a bar is a genuine status
// outcome (e.g. Hired/Rejected), which gets the app's real status color —
// always with a direct value label, since that's the secondary encoding
// that makes a status-adjacent hue pairing legal.
export default function StageBarChart({ data, height = 220 }: { data: StageBar[]; height?: number }) {
  if (data.every((d) => d.count === 0)) {
    return <div className="h-[220px] flex items-center justify-center text-sm text-muted">No applications yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#EAF2FA" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={{ stroke: '#D7E3F2' }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip
          cursor={{ fill: '#EAF2FA' }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D7E3F2', boxShadow: '0 4px 12px rgba(30,95,191,.12)' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#333333', fontWeight: 600 }} />
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
