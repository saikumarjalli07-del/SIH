import React from 'react';
import { Box, Stack, Text } from '../layout/Primitives';

export const AlgorithmSection = ({
  swarmSize,
  setSwarmSize,
  maxIterations,
  setMaxIterations,
  betaStart,
  setBetaStart,
  betaEnd,
  setBetaEnd,
  isRunning,
}) => {
  const getSliderTrack = (val, min, max) => {
    const pct = ((val - min) / (max - min)) * 100;
    return `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--border) ${pct}%, var(--border) 100%)`;
  };

  return (
    <Box style={{ marginBottom: '24px' }}>
      <Text
        variant="label"
        size="11px"
        color="var(--muted)"
        style={{ display: 'block', marginBottom: '8px' }}
      >
        Algorithm
      </Text>

      <Stack gap="14px">
        {/* Swarm size */}
        <Box>
          <Stack direction="row" justify="space-between" align="center" style={{ marginBottom: '4px' }}>
            <Text variant="body" size="13px" color="var(--muted)">
              Swarm size
            </Text>
            <Text variant="mono" size="12px" color="var(--text)">
              {swarmSize}
            </Text>
          </Stack>
          <input
            type="range"
            min={10}
            max={200}
            step={10}
            value={swarmSize}
            disabled={isRunning}
            onChange={(e) => setSwarmSize(Number(e.target.value))}
            style={{ background: getSliderTrack(swarmSize, 10, 200) }}
          />
        </Box>

        {/* Max iterations */}
        <Box>
          <Stack direction="row" justify="space-between" align="center" style={{ marginBottom: '4px' }}>
            <Text variant="body" size="13px" color="var(--muted)">
              Max iterations
            </Text>
            <Text variant="mono" size="12px" color="var(--text)">
              {maxIterations}
            </Text>
          </Stack>
          <input
            type="range"
            min={50}
            max={500}
            step={50}
            value={maxIterations}
            disabled={isRunning}
            onChange={(e) => setMaxIterations(Number(e.target.value))}
            style={{ background: getSliderTrack(maxIterations, 50, 500) }}
          />
        </Box>

        {/* Beta start */}
        <Box>
          <Stack direction="row" justify="space-between" align="center" style={{ marginBottom: '4px' }}>
            <Text variant="body" size="13px" color="var(--muted)">
              Beta start
            </Text>
            <Text variant="mono" size="12px" color="var(--text)">
              {betaStart.toFixed(1)}
            </Text>
          </Stack>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.1}
            value={betaStart}
            disabled={isRunning}
            onChange={(e) => setBetaStart(Number(e.target.value))}
            style={{ background: getSliderTrack(betaStart, 0.5, 1.5) }}
          />
        </Box>

        {/* Beta end */}
        <Box>
          <Stack direction="row" justify="space-between" align="center" style={{ marginBottom: '4px' }}>
            <Text variant="body" size="13px" color="var(--muted)">
              Beta end
            </Text>
            <Text variant="mono" size="12px" color="var(--text)">
              {betaEnd.toFixed(1)}
            </Text>
          </Stack>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.1}
            value={betaEnd}
            disabled={isRunning}
            onChange={(e) => setBetaEnd(Number(e.target.value))}
            style={{ background: getSliderTrack(betaEnd, 0.1, 0.9) }}
          />
        </Box>
      </Stack>
    </Box>
  );
};
