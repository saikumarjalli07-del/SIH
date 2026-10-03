import React from 'react';
import { Box, Stack, Text } from '../layout/Primitives';

export const ConstraintStatus = ({ constraintStatus }) => {
  const {
    capacitySatisfied = true,
    capacityViolations = 0,
    timeWindowViolations = 0,
    allNodesVisited = true,
    unvisitedCount = 0,
  } = constraintStatus || {};

  const constraints = [
    {
      id: 'capacity',
      label: 'Capacity',
      satisfied: capacitySatisfied && capacityViolations === 0,
      statusText: capacitySatisfied && capacityViolations === 0 ? 'Satisfied' : `${capacityViolations} exceeded`,
    },
    {
      id: 'time-windows',
      label: 'Time windows',
      satisfied: timeWindowViolations === 0,
      statusText: timeWindowViolations === 0 ? 'Satisfied' : `${timeWindowViolations} violated`,
    },
    {
      id: 'nodes-visited',
      label: 'All nodes visited',
      satisfied: allNodesVisited && unvisitedCount === 0,
      statusText: allNodesVisited && unvisitedCount === 0 ? 'Yes' : `${unvisitedCount} unvisited`,
    },
  ];

  return (
    <Box style={{ marginBottom: '16px' }}>
      <Text
        variant="label"
        size="11px"
        color="var(--muted)"
        style={{ display: 'block', marginBottom: '8px' }}
      >
        Constraints
      </Text>

      <Stack gap="10px">
        {constraints.map((c) => {
          const dotColor = c.satisfied ? 'var(--success)' : 'var(--alert)';
          const textColor = c.satisfied ? 'var(--success)' : 'var(--alert)';

          return (
            <Stack
              key={c.id}
              direction="row"
              align="center"
              justify="space-between"
            >
              <Stack direction="row" align="center" gap="8px">
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    flexShrink: 0,
                  }}
                />
                <Text variant="body" size="13px" color="var(--text)">
                  {c.label}
                </Text>
              </Stack>

              <Text
                variant="body"
                size="12px"
                style={{ color: textColor }}
              >
                {c.statusText}
              </Text>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
};
