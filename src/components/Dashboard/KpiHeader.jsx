import React from 'react';
import { Box, Stack, Text } from '../layout/Primitives';

export const KpiHeader = ({
  numVehicles,
  totalDistance = 0,
  capacityUtilization = 0,
  improvementPct = 0,
  timeWindowViolations = 0,
  deliveredStops = 0,
  totalStops = 0,
}) => {
  // Environmental and logistics calculations
  // Baseline diesel delivery van: ~0.24 kg CO2 per km
  const kmSaved = (totalDistance * (Math.max(0, improvementPct) / 100));
  const co2SavedKg = Number((kmSaved * 0.24).toFixed(1));
  const fuelSavedLiters = Number((kmSaved * 0.11).toFixed(1));

  const kpis = [
    {
      label: 'Active Fleet',
      value: `${numVehicles} Vehicles`,
      sub: 'All dispatched from Depot',
      color: 'var(--text)',
    },
    {
      label: 'Optimized Route Dist.',
      value: `${totalDistance.toFixed(1)} km`,
      sub: `${Math.abs(improvementPct).toFixed(1)}% vs Dijkstra`,
      subColor: improvementPct >= 0 ? 'var(--success)' : 'var(--alert)',
    },
    {
      label: 'Capacity Utilization',
      value: `${capacityUtilization.toFixed(1)}%`,
      sub: 'Payload distribution',
      color: 'var(--text)',
    },
    {
      label: 'Carbon Offset (QPSO)',
      value: `-${co2SavedKg} kg CO₂`,
      sub: `~${fuelSavedLiters} L fuel saved`,
      color: 'var(--accent)',
      subColor: 'var(--success)',
    },
    {
      label: 'Delivery SLA',
      value: timeWindowViolations === 0 ? '100% On-Time' : `${timeWindowViolations} Delayed`,
      sub: `${deliveredStops} / ${totalStops} Stops Assigned`,
      color: timeWindowViolations === 0 ? 'var(--success)' : 'var(--alert)',
    },
  ];

  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      {kpis.map((kpi, idx) => (
        <Box
          key={`kpi-${idx}`}
          style={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
          }}
        >
          <Text
            variant="label"
            size="11px"
            color="var(--muted)"
            style={{ display: 'block', marginBottom: '4px' }}
          >
            {kpi.label}
          </Text>
          <Text
            variant="mono"
            size="16px"
            weight={700}
            style={{ color: kpi.color || 'var(--text)', display: 'block', marginBottom: '2px' }}
          >
            {kpi.value}
          </Text>
          <Text
            variant="body"
            size="11px"
            style={{ color: kpi.subColor || 'var(--muted)', display: 'block' }}
          >
            {kpi.sub}
          </Text>
        </Box>
      ))}
    </Box>
  );
};
