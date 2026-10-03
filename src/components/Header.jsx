import React from 'react';
import { Box, Stack, Text } from './layout/Primitives';

export const Header = ({ activeView = 'graph', setActiveView }) => {
  return (
    <Box
      as="header"
      style={{
        height: '52px',
        minHeight: '52px',
        maxHeight: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        backgroundColor: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
        zIndex: 100,
      }}
    >
      {/* Left side: Brand */}
      <Stack direction="row" align="center" gap="8px">
        <Text
          variant="heading"
          size="18px"
          weight={700}
          color="var(--text)"
        >
          QuantaRoute
        </Text>
        <Text variant="body" size="13px" color="var(--muted)">
          ·
        </Text>
        <Text variant="body" size="13px" color="var(--muted)">
          VRP Optimizer
        </Text>
      </Stack>

      {/* Center: View Switcher */}
      <Stack
        direction="row"
        align="center"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '2px',
          gap: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveView && setActiveView('graph')}
          style={{
            background: activeView === 'graph' ? 'var(--surface-nested)' : 'transparent',
            color: activeView === 'graph' ? 'var(--accent)' : 'var(--muted)',
            border: activeView === 'graph' ? '1px solid var(--border)' : '1px solid transparent',
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: activeView === 'graph' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '10px' }}>☵</span> Topology Graph
        </button>

        <button
          type="button"
          onClick={() => setActiveView && setActiveView('dashboard')}
          style={{
            background: activeView === 'dashboard' ? 'var(--surface-nested)' : 'transparent',
            color: activeView === 'dashboard' ? 'var(--accent)' : 'var(--muted)',
            border: activeView === 'dashboard' ? '1px solid var(--border)' : '1px solid transparent',
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: activeView === 'dashboard' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '10px' }}>🌐</span> Fleet Map Dashboard
        </button>
      </Stack>

      {/* Right side: Meta */}
      <Stack direction="row" align="center" gap="8px">
        <Text variant="mono" size="11px" color="var(--muted)">
          PS #26137
        </Text>
        <Text variant="body" size="11px" color="var(--muted)">
          ·
        </Text>
        <Text variant="mono" size="11px" color="var(--muted)">
          SIH 2025
        </Text>
        <Text variant="body" size="11px" color="var(--muted)">
          ·
        </Text>
        <Text variant="body" size="11px" color="var(--muted)">
          Egreen Quanta
        </Text>
      </Stack>
    </Box>
  );
};
