import React from 'react';
import { Box, Stack, Text } from './layout/Primitives';

export const StatusBar = ({
  status, // 'idle' | 'running' | 'complete'
  currentIteration = 0,
  maxIterations = 300,
  convergedIteration = 0,
  beta = null,
  elapsedSeconds = 0,
}) => {
  return (
    <Box
      as="footer"
      style={{
        height: '36px',
        minHeight: '36px',
        maxHeight: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        backgroundColor: 'var(--bg)',
        borderTop: '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      {/* Left section */}
      <Box style={{ minWidth: '180px', display: 'flex', alignItems: 'center' }}>
        {status === 'idle' && (
          <Text variant="body" size="13px" color="var(--muted)">
            Ready
          </Text>
        )}
        {status === 'running' && (
          <Text variant="mono" size="12px" color="var(--text)">
            Iteration {currentIteration} / {maxIterations}
          </Text>
        )}
        {status === 'complete' && (
          <Text variant="body" size="13px" color="var(--success)">
            Converged at iteration {convergedIteration || currentIteration}
          </Text>
        )}
      </Box>

      {/* Centre section */}
      <Box style={{ minWidth: '100px', display: 'flex', justifyContent: 'center' }}>
        {status === 'running' && beta !== null && (
          <Text variant="mono" size="12px" color="var(--muted)">
            β  {beta.toFixed(3)}
          </Text>
        )}
      </Box>

      {/* Right section */}
      <Box style={{ minWidth: '100px', display: 'flex', justifyContent: 'flex-end' }}>
        <Text variant="mono" size="12px" color="var(--muted)">
          {elapsedSeconds.toFixed(1)}s
        </Text>
      </Box>
    </Box>
  );
};
