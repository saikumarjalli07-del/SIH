import React from 'react';
import { Box, Stack, Text } from '../layout/Primitives';

export const ObjectiveWeightsSection = ({
  alpha,
  setAlpha,
  betaW,
  setBetaW,
  gamma,
  setGamma,
  isRunning,
}) => {
  return (
    <Box style={{ marginBottom: '24px' }}>
      <Text
        variant="label"
        size="11px"
        color="var(--muted)"
        style={{ display: 'block', marginBottom: '8px' }}
      >
        Objective Weights
      </Text>

      <Stack gap="12px">
        <Box>
          <Text
            variant="body"
            size="13px"
            color="var(--muted)"
            style={{ display: 'block', marginBottom: '4px' }}
          >
            Alpha (distance)
          </Text>
          <input
            type="number"
            step="0.1"
            min="0"
            value={alpha}
            disabled={isRunning}
            onChange={(e) => setAlpha(parseFloat(e.target.value) || 0)}
          />
        </Box>

        <Box>
          <Text
            variant="body"
            size="13px"
            color="var(--muted)"
            style={{ display: 'block', marginBottom: '4px' }}
          >
            Beta-w (time)
          </Text>
          <input
            type="number"
            step="0.1"
            min="0"
            value={betaW}
            disabled={isRunning}
            onChange={(e) => setBetaW(parseFloat(e.target.value) || 0)}
          />
        </Box>

        <Box>
          <Text
            variant="body"
            size="13px"
            color="var(--muted)"
            style={{ display: 'block', marginBottom: '4px' }}
          >
            Gamma (congestion)
          </Text>
          <input
            type="number"
            step="0.1"
            min="0"
            value={gamma}
            disabled={isRunning}
            onChange={(e) => setGamma(parseFloat(e.target.value) || 0)}
          />
        </Box>
      </Stack>
    </Box>
  );
};
