import React from 'react';
import { Box, Text } from '../layout/Primitives';
import { FitnessDisplay } from './FitnessDisplay';
import { ConvergenceChart } from './ConvergenceChart';
import { RouteBreakdown } from './RouteBreakdown';
import { ConstraintStatus } from './ConstraintStatus';

export const RightPanel = ({
  hasRun,
  bestFitness,
  improvementPct,
  convergenceHistory,
  baselineHistory,
  routes,
  nodes,
  routeStats,
  constraintStatus,
}) => {
  return (
    <Box
      as="aside"
      className="no-scrollbar"
      style={{
        width: '300px',
        minWidth: '300px',
        maxWidth: '300px',
        height: '100%',
        backgroundColor: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {!hasRun ? (
        <Box
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <Text variant="body" size="14px" color="var(--muted)">
            Configure the network and run the optimizer.
          </Text>
        </Box>
      ) : (
        <Box>
          <FitnessDisplay
            bestFitness={bestFitness}
            improvementPct={improvementPct}
          />

          <ConvergenceChart
            convergenceHistory={convergenceHistory}
            baselineHistory={baselineHistory}
          />

          <RouteBreakdown
            routes={routes}
            nodes={nodes}
            routeStats={routeStats}
          />

          <ConstraintStatus
            constraintStatus={constraintStatus}
          />
        </Box>
      )}
    </Box>
  );
};
