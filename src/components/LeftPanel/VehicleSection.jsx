import React from 'react';
import { Box, Stack, Text } from '../layout/Primitives';

export const VehicleSection = ({
  numVehicles,
  setNumVehicles,
  vehicleCapacity,
  setVehicleCapacity,
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
        Vehicles
      </Text>

      <Stack gap="12px">
        <Box>
          <Text
            variant="body"
            size="13px"
            color="var(--muted)"
            style={{ display: 'block', marginBottom: '4px' }}
          >
            Number of vehicles
          </Text>
          <input
            type="number"
            min={1}
            max={10}
            value={numVehicles}
            disabled={isRunning}
            onChange={(e) => setNumVehicles(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
          />
        </Box>

        <Box>
          <Text
            variant="body"
            size="13px"
            color="var(--muted)"
            style={{ display: 'block', marginBottom: '4px' }}
          >
            Vehicle capacity
          </Text>
          <input
            type="number"
            min={1}
            value={vehicleCapacity}
            disabled={isRunning}
            onChange={(e) => setVehicleCapacity(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </Box>
      </Stack>
    </Box>
  );
};
