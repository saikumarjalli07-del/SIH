import React, { useState } from 'react';
import { Box, Text } from '../layout/Primitives';

export const RunControls = ({ onRun, isRunning, disabled }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box style={{ marginTop: 'auto', paddingTop: '16px' }}>
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning || disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '100%',
          backgroundColor: isRunning || disabled
            ? 'var(--border)'
            : isHovered
            ? 'var(--accent-hover)'
            : 'var(--accent)',
          color: isRunning || disabled ? 'var(--muted)' : '#0F0F0F',
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '14px',
          padding: '10px',
          borderRadius: 'var(--radius)',
          border: 'none',
          cursor: isRunning || disabled ? 'not-allowed' : 'pointer',
          display: 'block',
          textAlign: 'center',
          transition: 'background-color 0.15s ease',
        }}
      >
        Run QPSO
      </button>

      {isRunning && (
        <Text
          variant="body"
          size="13px"
          color="var(--muted)"
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: '8px',
          }}
        >
          Running...
        </Text>
      )}
    </Box>
  );
};
