import React, { useState, useEffect, useMemo } from 'react';
import { Box } from '../layout/Primitives';
import { KpiHeader } from './KpiHeader';
import { CityMap } from './CityMap';
import { FleetController } from './FleetController';
import { registerNodeCoord } from '../../data/cityData';

export const MapDashboard = ({
  nodes = [],
  edges = [],
  routes = [],
  routeStats = [],
  numVehicles = 3,
  vehicleCapacity = 60,
  improvementPct = 0,
  timeWindowViolations = 0,
  onAddMapNode,
  onImportCSV,
}) => {
  const [isSimulating, setIsSimulating] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [showTraffic, setShowTraffic] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [addMode, setAddMode] = useState(false);

  // Animated simulation loop
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      setSimulationProgress((prev) => {
        const next = prev + 0.003 * simSpeed;
        return next >= 1 ? 0 : next;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [isSimulating, simSpeed]);

  // Aggregate telemetry metrics
  const totalDistance = useMemo(() => routeStats.reduce((sum, r) => sum + (r.distance || 0), 0), [routeStats]);
  const customerNodes = useMemo(() => nodes.filter((n) => !n.isDepot), [nodes]);
  const totalDemand = useMemo(() => customerNodes.reduce((sum, n) => sum + (n.demand || 0), 0), [customerNodes]);

  const capacityUtilization = useMemo(() => {
    const totalCap = numVehicles * vehicleCapacity;
    if (totalCap === 0) return 0;
    return Math.min(100, Number(((totalDemand / totalCap) * 100).toFixed(1)));
  }, [numVehicles, vehicleCapacity, totalDemand]);

  const assignedCustomerCount = useMemo(() => {
    const set = new Set();
    routes.forEach((route) => route.forEach((id) => {
      const node = nodes.find((n) => n.id === id);
      if (node && !node.isDepot) set.add(id);
    }));
    return set.size;
  }, [routes, nodes]);

  // Called when user clicks the map in addMode
  const handleMapClick = (lat, lng, demand, timeWindow) => {
    const nextId = nodes.length > 0 ? Math.max(...nodes.map((n) => n.id)) + 1 : 1;
    // Register real geo coords so marker appears at the exact clicked spot
    registerNodeCoord(nextId, lat, lng);
    // Convert lat/lng to rough canvas x/y (relative to depot at 360,215)
    const depotLat = 28.6315, depotLng = 77.2167;
    const scale = 2200; // pixels per degree
    const canvasX = Math.round(360 + (lng - depotLng) * scale);
    const canvasY = Math.round(215 - (lat - depotLat) * scale);
    onAddMapNode && onAddMapNode(nextId, canvasX, canvasY, demand, timeWindow);
    setAddMode(false);
  };

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg)',
      }}
    >
      {/* KPI Ribbon */}
      <KpiHeader
        numVehicles={numVehicles}
        totalDistance={totalDistance}
        capacityUtilization={capacityUtilization}
        improvementPct={improvementPct}
        timeWindowViolations={timeWindowViolations}
        deliveredStops={assignedCustomerCount}
        totalStops={customerNodes.length}
      />

      {/* Add-Stop toggle bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 16px',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          type="button"
          onClick={() => setAddMode((v) => !v)}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            fontFamily: 'var(--font-body)',
            fontWeight: addMode ? 700 : 400,
            backgroundColor: addMode ? 'var(--accent)' : 'var(--surface-nested)',
            color: addMode ? '#0F0F0F' : 'var(--muted)',
            border: addMode ? '1px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {addMode ? '✛ Click map to place stop' : '✛ Add Stop on Map'}
        </button>
        {addMode && (
          <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
            Press Esc or click the button again to cancel
          </span>
        )}
      </div>

      {/* Main Split */}
      <Box style={{ display: 'flex', flex: 1, height: 'calc(100% - 110px)', overflow: 'hidden' }}>
        <Box style={{ flex: 1, height: '100%', position: 'relative' }}>
          <CityMap
            nodes={nodes}
            routes={routes}
            simulationProgress={simulationProgress}
            isSimulating={isSimulating}
            showTraffic={showTraffic}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
            addMode={addMode}
            onMapClick={handleMapClick}
          />
        </Box>

        <FleetController
          routes={routes}
          routeStats={routeStats}
          nodes={nodes}
          vehicleCapacity={vehicleCapacity}
          isSimulating={isSimulating}
          setIsSimulating={setIsSimulating}
          simSpeed={simSpeed}
          setSimSpeed={setSimSpeed}
          simulationProgress={simulationProgress}
          setSimulationProgress={setSimulationProgress}
          showTraffic={showTraffic}
          setShowTraffic={setShowTraffic}
          selectedVehicle={selectedVehicle}
          setSelectedVehicle={setSelectedVehicle}
          onImportCSV={onImportCSV}
        />
      </Box>
    </Box>
  );
};
