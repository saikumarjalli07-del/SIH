import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Box, Text } from '../layout/Primitives';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '6px 8px',
          borderRadius: 'var(--radius)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--text)',
        }}
      >
        <div style={{ color: 'var(--muted)', marginBottom: '2px' }}>
          Iter {label}
        </div>
        {payload.map((entry, idx) => (
          <div key={`item-${idx}`} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const ConvergenceChart = ({ convergenceHistory = [], baselineHistory = [] }) => {
  // Format data for Recharts
  const data = [];
  const maxLen = Math.max(convergenceHistory.length, baselineHistory.length);

  // Sample points if too dense to keep rendering instantaneous
  const step = maxLen > 100 ? Math.ceil(maxLen / 60) : 1;

  for (let i = 0; i < maxLen; i += step) {
    data.push({
      iteration: i + 1,
      QPSO: convergenceHistory[i] !== undefined ? convergenceHistory[i] : null,
      'PSO Baseline': baselineHistory[i] !== undefined ? baselineHistory[i] : null,
    });
  }

  // Ensure last point is always included
  if (maxLen > 0 && (maxLen - 1) % step !== 0) {
    data.push({
      iteration: maxLen,
      QPSO: convergenceHistory[maxLen - 1] ?? null,
      'PSO Baseline': baselineHistory[maxLen - 1] ?? null,
    });
  }

  return (
    <Box style={{ marginBottom: '24px' }}>
      <Text
        variant="label"
        size="11px"
        color="var(--muted)"
        style={{ display: 'block', marginBottom: '8px' }}
      >
        Convergence
      </Text>

      <Box
        style={{
          width: '100%',
          height: '160px',
          background: 'transparent',
          position: 'relative',
        }}
      >
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 10, left: -24, bottom: 0 }}
            >
              <XAxis
                dataKey="iteration"
                stroke="var(--muted)"
                tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                stroke="var(--muted)"
                tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                name="QPSO"
                type="monotone"
                dataKey="QPSO"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                name="PSO baseline"
                type="monotone"
                dataKey="PSO Baseline"
                stroke="var(--muted)"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="mono" size="11px" color="var(--muted)">
              No data
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
