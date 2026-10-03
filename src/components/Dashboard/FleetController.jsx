import React, { useRef, useState } from 'react';
import { Box, Stack, Text } from '../layout/Primitives';
import { cityZones, getVehicleColor } from '../../data/cityData';

export const FleetController = ({
  routes = [],
  routeStats = [],
  nodes = [],
  vehicleCapacity = 60,
  isSimulating,
  setIsSimulating,
  simSpeed,
  setSimSpeed,
  simulationProgress,
  setSimulationProgress,
  showTraffic,
  setShowTraffic,
  selectedVehicle,
  setSelectedVehicle,
  onImportCSV,
}) => {
  const fileInputRef = useRef(null);
  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvError('');
    setCsvSuccess('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.trim().split('\n').filter(Boolean);
        const dataLines = /[a-zA-Z]/.test(lines[0]) ? lines.slice(1) : lines;
        const parsed = dataLines.map((line, i) => {
          const cols = line.split(',').map(c => c.trim());
          if (cols.length >= 5 && !isNaN(cols[0]) && !isNaN(cols[1])) {
            const [lat, lng, demand, twS, twE] = cols.map(Number);
            return { lat, lng, demand: demand || 10, timeWindow: [twS ?? 0, twE ?? 90] };
          }
          const [demand, twS, twE] = [Number(cols[0]) || 10, Number(cols[1] ?? 0), Number(cols[2] ?? 90)];
          return { demand, timeWindow: [twS, twE] };
        });
        onImportCSV && onImportCSV(parsed);
        setCsvSuccess(`✓ ${parsed.length} stops imported`);
        setTimeout(() => setCsvSuccess(''), 3000);
      } catch (err) {
        setCsvError(err.message || 'Invalid file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Box
      className="no-scrollbar"
      style={{
        width: '320px',
        minWidth: '320px',
        maxWidth: '320px',
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
      {/* Zone & Status Banner */}
      <Box style={{ marginBottom: '16px' }}>
        <Stack direction="row" justify="space-between" align="center" style={{ marginBottom: '4px' }}>
          <Text variant="label" size="11px" color="var(--muted)">
            Operating Zone
          </Text>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              backgroundColor: 'var(--surface-nested)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--success)',
            }}
          >
            LIVE SYNC
          </span>
        </Stack>
        <Text variant="heading" size="16px" weight={700} color="var(--text)">
          {cityZones.delhi.name}
        </Text>
      </Box>

      {/* ── Import Stops ── */}
      <Box style={{ marginBottom: '20px', padding: '10px 12px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <Text variant="label" size="11px" color="var(--muted)" style={{ display: 'block', marginBottom: '8px' }}>
          Import Delivery Stops
        </Text>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%', padding: '7px 10px',
            backgroundColor: 'var(--accent)', color: '#0F0F0F',
            fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '12px',
            border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
            marginBottom: '6px',
          }}
        >
          ⬆ Upload CSV / Excel
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
        <Text variant="mono" size="10px" color="var(--muted)" style={{ lineHeight: 1.5 }}>
          Format A: demand, twStart, twEnd{' '}<br />
          Format B: lat, lng, demand, twStart, twEnd
        </Text>
        {csvSuccess && <Text variant="mono" size="11px" color="var(--success)" style={{ display: 'block', marginTop: '4px' }}>{csvSuccess}</Text>}
        {csvError  && <Text variant="mono" size="11px" color="var(--alert)"   style={{ display: 'block', marginTop: '4px' }}>⚠ {csvError}</Text>}
      </Box>

      {/* Playback & Telemetry Controls */}
      <Box style={{ marginBottom: '24px' }}>
        <Text variant="label" size="11px" color="var(--muted)" style={{ display: 'block', marginBottom: '8px' }}>
          Fleet Dispatch Simulation
        </Text>

        <Stack gap="10px">
          <Stack direction="row" gap="8px" align="center">
            <button
              type="button"
              onClick={() => setIsSimulating(!isSimulating)}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: isSimulating ? 'var(--alert)' : 'var(--accent)',
                color: '#0F0F0F',
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
            >
              {isSimulating ? '❚❚ Pause' : '▶ Play Simulation'}
            </button>

            <button
              type="button"
              onClick={() => setSimulationProgress(0)}
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--surface-nested)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '12px',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </Stack>

          {/* Speed selector */}
          <Stack direction="row" justify="space-between" align="center">
            <Text variant="body" size="12px" color="var(--muted)">
              Simulation Speed
            </Text>
            <Stack direction="row" gap="4px">
              {[1, 2, 5].map((speed) => (
                <button
                  key={`speed-${speed}`}
                  type="button"
                  onClick={() => setSimSpeed(speed)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: simSpeed === speed ? 'var(--accent)' : 'var(--surface-nested)',
                    color: simSpeed === speed ? '#0F0F0F' : 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  {speed}x
                </button>
              ))}
            </Stack>
          </Stack>

          {/* Simulation Progress Slider */}
          <Box>
            <Stack direction="row" justify="space-between" align="center" style={{ marginBottom: '4px' }}>
              <Text variant="body" size="12px" color="var(--muted)">
                Route Progress
              </Text>
              <Text variant="mono" size="11px" color="var(--text)">
                {Math.round(simulationProgress * 100)}%
              </Text>
            </Stack>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={simulationProgress}
              onChange={(e) => setSimulationProgress(parseFloat(e.target.value))}
            />
          </Box>

          {/* Traffic Congestion Toggle */}
          <Stack direction="row" justify="space-between" align="center" style={{ marginTop: '4px' }}>
            <Text variant="body" size="12px" color="var(--muted)">
              Traffic Congestion Overlay
            </Text>
            <button
              type="button"
              onClick={() => setShowTraffic(!showTraffic)}
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                backgroundColor: showTraffic ? 'var(--alert)' : 'var(--surface-nested)',
                color: showTraffic ? '#fff' : 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              {showTraffic ? 'Active' : 'Off'}
            </button>
          </Stack>
        </Stack>
      </Box>

      {/* Vehicle Dispatch Cards */}
      <Box style={{ flex: 1 }}>
        <Stack direction="row" justify="space-between" align="center" style={{ marginBottom: '8px' }}>
          <Text variant="label" size="11px" color="var(--muted)">
            Vehicle Fleets ({routes.length})
          </Text>
          {selectedVehicle !== null && (
            <span
              onClick={() => setSelectedVehicle(null)}
              style={{
                fontSize: '11px',
                color: 'var(--accent)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Show All
            </span>
          )}
        </Stack>

        <Stack gap="8px">
          {routes.map((route, idx) => {
            const stat = routeStats[idx];
            const color = getVehicleColor(idx);
            const isSelected = selectedVehicle === idx;
            const stopsCount = Math.max(0, route.length - 2);

            return (
              <Box
                key={`veh-card-${idx}`}
                onClick={() => setSelectedVehicle(isSelected ? null : idx)}
                style={{
                  padding: '10px 12px',
                  backgroundColor: isSelected ? 'var(--surface-nested)' : 'var(--bg)',
                  border: isSelected ? `1px solid ${color}` : '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Stack direction="row" justify="space-between" align="center" style={{ marginBottom: '4px' }}>
                  <Stack direction="row" align="center" gap="6px">
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: color,
                      }}
                    />
                    <Text variant="mono" size="13px" weight={700} color="var(--text)">
                      Vehicle #{idx + 1}
                    </Text>
                  </Stack>
                  <Text variant="mono" size="12px" color="var(--text)">
                    {stat ? `${stat.distance} km` : '—'}
                  </Text>
                </Stack>

                <Stack direction="row" justify="space-between" align="center">
                  <Text variant="body" size="12px" color="var(--muted)">
                    {stopsCount} delivery stops
                  </Text>
                  <Text variant="mono" size="11px" color="var(--muted)">
                    Load: {stat ? `${stat.load}/${vehicleCapacity}` : `0/${vehicleCapacity}`}
                  </Text>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
};
