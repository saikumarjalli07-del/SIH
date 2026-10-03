import React from 'react';
import { Box, Text } from '../layout/Primitives';

export const FitnessDisplay = ({ bestFitness, improvementPct }) => {
  const isImprovement = (improvementPct ?? 0) >= 0;
  const arrow = isImprovement ? '↓' : '↑';
  const color = isImprovement ? 'var(--success)' : 'var(--alert)';
  const formattedPct = Math.abs(improvementPct || 0).toFixed(1);

  return (
    <Box style={{ marginBottom: '24px' }}>
      <Text
        variant="label"
        size="11px"
        color="var(--muted)"
        style={{ display: 'block', marginBottom: '6px' }}
      >
        Best fitness
      </Text>

      <Text
        variant="mono"
        size="32px"
        weight={700}
        color="var(--text)"
        style={{ display: 'block', lineHeight: 1.1, marginBottom: '6px' }}
      >
        {bestFitness !== null && bestFitness !== undefined ? bestFitness.toFixed(1) : '—'}
      </Text>

      <Text
        variant="body"
        size="12px"
        style={{ color, display: 'block' }}
      >
        {arrow} {formattedPct}% vs baseline Dijkstra
      </Text>
    </Box>
  );
};
