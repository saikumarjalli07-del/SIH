import React from 'react';
import { Box } from '../layout/Primitives';
import { NetworkSection } from './NetworkSection';
import { VehicleSection } from './VehicleSection';
import { AlgorithmSection } from './AlgorithmSection';
import { ObjectiveWeightsSection } from './ObjectiveWeightsSection';
import { RunControls } from './RunControls';

export const LeftPanel = ({
  nodeCount,
  edgeCount,
  onLoadSample,
  onClearCanvas,
  onImportCSV,
  numVehicles,
  setNumVehicles,
  vehicleCapacity,
  setVehicleCapacity,
  swarmSize,
  setSwarmSize,
  maxIterations,
  setMaxIterations,
  betaStart,
  setBetaStart,
  betaEnd,
  setBetaEnd,
  alpha,
  setAlpha,
  betaW,
  setBetaW,
  gamma,
  setGamma,
  onRun,
  isRunning,
}) => {
  return (
    <Box
      as="aside"
      className="no-scrollbar"
      style={{
        width: '260px',
        minWidth: '260px',
        maxWidth: '260px',
        height: '100%',
        backgroundColor: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      <NetworkSection
        nodeCount={nodeCount}
        edgeCount={edgeCount}
        onLoadSample={onLoadSample}
        onClearCanvas={onClearCanvas}
        onImportCSV={onImportCSV}
        isRunning={isRunning}
      />

      <VehicleSection
        numVehicles={numVehicles}
        setNumVehicles={setNumVehicles}
        vehicleCapacity={vehicleCapacity}
        setVehicleCapacity={setVehicleCapacity}
        isRunning={isRunning}
      />

      <AlgorithmSection
        swarmSize={swarmSize}
        setSwarmSize={setSwarmSize}
        maxIterations={maxIterations}
        setMaxIterations={setMaxIterations}
        betaStart={betaStart}
        setBetaStart={setBetaStart}
        betaEnd={betaEnd}
        setBetaEnd={setBetaEnd}
        isRunning={isRunning}
      />

      <ObjectiveWeightsSection
        alpha={alpha}
        setAlpha={setAlpha}
        betaW={betaW}
        setBetaW={setBetaW}
        gamma={gamma}
        setGamma={setGamma}
        isRunning={isRunning}
      />

      <RunControls
        onRun={onRun}
        isRunning={isRunning}
        disabled={nodeCount < 2}
      />
    </Box>
  );
};
