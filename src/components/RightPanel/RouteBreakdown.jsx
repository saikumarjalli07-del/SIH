import React from 'react';
import { Box, Stack, Text } from '../layout/Primitives';

export const RouteBreakdown = ({ routes = [], nodes = [], routeStats = [] }) => {
  return (
    <Box style={{ marginBottom: '24px' }}>
      <Text
        variant="label"
        size="11px"
        color="var(--muted)"
        style={{ display: 'block', marginBottom: '8px' }}
      >
        Routes
      </Text>

      <Stack gap="8px">
        {routes.map((route, idx) => {
          // Format sequence: depot → 3 → 7 → ... → depot
          const sequence = route
            .map((nodeId) => {
              const node = nodes.find((n) => n.id === nodeId);
              if (node && node.isDepot) return 'depot';
              return String(nodeId);
            })
            .join(' → ');

          // Get vehicle distance
          const stat = routeStats[idx];
          const distStr = stat ? `${stat.distance.toFixed(1)} km` : '';

          return (
            <Box
              key={`route-row-${idx}`}
              style={{
                paddingBottom: '6px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <Text
                variant="mono"
                size="11px"
                color="var(--text)"
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                }}
              >
                <span style={{ color: 'var(--muted)', marginRight: '8px' }}>
                  V{idx + 1}
                </span>
                {sequence}
              </Text>

              {distStr && (
                <Text
                  variant="mono"
                  size="11px"
                  color="var(--muted)"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {distStr}
                </Text>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};
