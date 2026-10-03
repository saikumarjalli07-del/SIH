import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { LeftPanel } from './components/LeftPanel/LeftPanel';
import { GraphCanvas } from './components/GraphCanvas/GraphCanvas';
import { RightPanel } from './components/RightPanel/RightPanel';
import { MapDashboard } from './components/Dashboard/MapDashboard';
import { sampleNodes, sampleEdges } from './data/sampleNetwork';
import { buildDistanceMatrix, evaluateRoutes } from './utils/graphUtils';
import { registerNodeCoord } from './data/cityData';

export function App() {
  // Navigation view state
  const [activeView, setActiveView] = useState('graph'); // 'graph' | 'dashboard'

  // Graph state
  const [nodes, setNodes] = useState(() => [...sampleNodes]);
  const [edges, setEdges] = useState(() => [...sampleEdges]);
  const [routes, setRoutes] = useState([]);

  // Config state
  const [numVehicles, setNumVehicles] = useState(3);
  const [vehicleCapacity, setVehicleCapacity] = useState(60);
  const [swarmSize, setSwarmSize] = useState(50);
  const [maxIterations, setMaxIterations] = useState(300);
  const [betaStart, setBetaStart] = useState(1.0);
  const [betaEnd, setBetaEnd] = useState(0.5);
  const [alpha, setAlpha] = useState(1.0);
  const [betaW, setBetaW] = useState(1.0);
  const [gamma, setGamma] = useState(0.5);

  // Optimizer state
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'complete'
  const [currentIteration, setCurrentIteration] = useState(0);
  const [convergedIteration, setConvergedIteration] = useState(0);
  const [currentBeta, setCurrentBeta] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasRun, setHasRun] = useState(false);

  // Result output state
  const [bestFitness, setBestFitness] = useState(null);
  const [improvementPct, setImprovementPct] = useState(0);
  const [convergenceHistory, setConvergenceHistory] = useState([]);
  const [baselineHistory, setBaselineHistory] = useState([]);
  const [routeStats, setRouteStats] = useState([]);
  const [constraintStatus, setConstraintStatus] = useState(null);

  const workerRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  // Initialize initial sample route metrics
  useEffect(() => {
    if (routes.length === 0 && nodes.length > 0) {
      // Zone-based default routes — strict geographic territories, zero shared nodes:
      // V1: North  — Depot → Paharganj(11) → Kamla Nagar(1) → Model Town(2) → Rohini(3) → Depot
      // V2: East+S — Depot → Laxmi Nagar(4) → Preet Vihar(5) → GK-I(7) → Saket(6) → Hauz Khas(8) → Depot
      // V3: West   — Depot → Rajouri Garden(10) → Janakpuri(9) → Depot
      const defaultRoutes = [
        [0, 11, 1, 2, 3, 0],
        [0, 4, 5, 7, 6, 8, 0],
        [0, 10, 9, 0],
      ];
      setRoutes(defaultRoutes);
      const { distMatrix, timeMatrix } = buildDistanceMatrix(nodes, edges);
      const evalResult = evaluateRoutes(defaultRoutes, nodes, distMatrix, timeMatrix, vehicleCapacity);
      setRouteStats(evalResult.routeDetails);
    }
  }, []);

  // Initialize Web Worker
  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('./workers/qpso.worker.js', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (e) => {
        const { type } = e.data;

        if (type === 'PROGRESS') {
          setCurrentIteration(e.data.iteration);
          setCurrentBeta(e.data.beta);
          if (e.data.bestRoutes && e.data.bestRoutes.length > 0) {
            setRoutes(e.data.bestRoutes);
          }
        } else if (type === 'COMPLETE') {
          clearInterval(timerRef.current);
          setStatus('complete');
          setHasRun(true);
          setBestFitness(e.data.bestFitness);
          setCurrentIteration(maxIterations);
          setConvergedIteration(e.data.totalIterations);
          setRoutes(e.data.bestRoutes);
          setConvergenceHistory(e.data.convergenceHistory || []);
          setBaselineHistory(e.data.baselineHistory || []);
          setImprovementPct(e.data.improvementPct ?? 0);
          setConstraintStatus(e.data.constraintStatus);
          setElapsedSeconds((e.data.elapsedMs || 0) / 1000);

          // Evaluate vehicle route distances
          const { distMatrix, timeMatrix } = buildDistanceMatrix(nodes, edges);
          const evalResult = evaluateRoutes(
            e.data.bestRoutes,
            nodes,
            distMatrix,
            timeMatrix,
            vehicleCapacity
          );
          setRouteStats(evalResult.routeDetails);
        }
      };

      workerRef.current.onerror = (err) => {
        console.error('QPSO Worker error:', err);
        clearInterval(timerRef.current);
        setStatus('idle');
      };
    } catch (err) {
      console.error('Failed to create Web Worker:', err);
    }

    return () => {
      if (workerRef.current) workerRef.current.terminate();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [maxIterations, vehicleCapacity]);

  // Run QPSO optimizer
  const handleRun = useCallback(() => {
    if (nodes.length < 2 || status === 'running') return;

    setStatus('running');
    setHasRun(true);
    setCurrentIteration(0);
    setCurrentBeta(betaStart);
    setElapsedSeconds(0);
    startTimeRef.current = performance.now();

    // Start live timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const now = performance.now();
      setElapsedSeconds((now - startTimeRef.current) / 1000);
    }, 100);

    // Send payload to worker
    workerRef.current.postMessage({
      type: 'RUN',
      config: {
        nodes,
        edges,
        numVehicles,
        vehicleCapacity,
        swarmSize,
        maxIterations,
        betaStart,
        betaEnd,
        alpha,
        betaW,
        gamma,
      },
    });
  }, [
    nodes,
    edges,
    numVehicles,
    vehicleCapacity,
    swarmSize,
    maxIterations,
    betaStart,
    betaEnd,
    alpha,
    betaW,
    gamma,
    status,
  ]);

  // Network modification handlers
  const handleLoadSample = useCallback(() => {
    setNodes([...sampleNodes]);
    setEdges([...sampleEdges]);
    const defaultRoutes = [
      [0, 11, 1, 2, 3, 0],
      [0, 4, 5, 7, 6, 8, 0],
      [0, 10, 9, 0],
    ];
    setRoutes(defaultRoutes);
    const { distMatrix, timeMatrix } = buildDistanceMatrix(sampleNodes, sampleEdges);
    const evalResult = evaluateRoutes(defaultRoutes, sampleNodes, distMatrix, timeMatrix, vehicleCapacity);
    setRouteStats(evalResult.routeDetails);
    setStatus('idle');
    setHasRun(false);
  }, [vehicleCapacity]);

  const handleClearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setRoutes([]);
    setRouteStats([]);
    setStatus('idle');
    setHasRun(false);
  }, []);

  const handleAddNode = useCallback((x, y) => {
    setNodes((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((n) => n.id)) + 1 : 0;
      const isFirst = prev.length === 0;
      const newNode = {
        id: nextId,
        x,
        y,
        demand: isFirst ? 0 : 10,
        label: isFirst ? 'Depot' : `N${nextId}`,
        isDepot: isFirst,
        timeWindow: isFirst ? undefined : [0, 90],
        serviceTime: isFirst ? 0 : 5,
      };
      return [...prev, newNode];
    });
  }, []);

  const handleUpdateNode = useCallback((nodeId, updates) => {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id === nodeId) {
          return { ...node, ...updates };
        }
        if (updates.isDepot) {
          return { ...node, isDepot: false };
        }
        return node;
      })
    );
  }, []);

  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.from !== nodeId && e.to !== nodeId));
    setRoutes([]);
    setRouteStats([]);
  }, []);

  const handleAddEdge = useCallback((fromId, toId, weight) => {
    setEdges((prev) => {
      const existing = prev.find((e) => e.from === fromId && e.to === toId);
      if (existing) {
        return prev.map((e) =>
          e.from === fromId && e.to === toId
            ? { ...e, weight, travelTime: Number((weight * 1.2).toFixed(1)) }
            : e
        );
      }
      return [
        ...prev,
        {
          id: `e-${fromId}-${toId}-${Date.now()}`,
          from: fromId,
          to: toId,
          weight,
          travelTime: Number((weight * 1.2).toFixed(1)),
          congestion: 1.0,
        },
      ];
    });
  }, []);

  const handleNodeDrag = useCallback((nodeId, newX, newY) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId ? { ...node, x: newX, y: newY } : node
      )
    );
  }, []);

  // Add node from map click — also auto-wires 2 nearest edges and assigns to nearest route
  const handleAddMapNode = useCallback((id, canvasX, canvasY, demand, timeWindow) => {
    const newNode = {
      id,
      x: Math.max(20, Math.min(800, canvasX)),
      y: Math.max(20, Math.min(500, canvasY)),
      demand,
      label: `N${id}`,
      isDepot: false,
      timeWindow,
      serviceTime: 5,
    };

    setNodes((prevNodes) => {
      const updated = [...prevNodes, newNode];

      // Auto-connect: add edges to the 2 nearest existing nodes
      const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
      const sorted = [...prevNodes]
        .map(n => ({ node: n, d: dist(n, newNode) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);

      setEdges((prevEdges) => {
        const newEdges = sorted.map(({ node: n, d }) => ({
          id: `e-${n.id}-${id}-auto`,
          from: n.id,
          to: id,
          weight: Number((d / 10).toFixed(1)),
          travelTime: Number((d / 10 * 1.2).toFixed(1)),
          congestion: 1.0,
        }));
        return [...prevEdges, ...newEdges];
      });

      // Assign to nearest vehicle route (insert before the return-to-depot)
      setRoutes((prevRoutes) => {
        if (prevRoutes.length === 0) return prevRoutes;
        const depotNode = prevNodes.find(n => n.isDepot);
        if (!depotNode) return prevRoutes;
        // Find which route's last real stop is geographically closest
        let bestRouteIdx = 0;
        let bestDist = Infinity;
        prevRoutes.forEach((route, rIdx) => {
          // Last non-depot stop
          const stops = route.filter(nId => {
            const node = prevNodes.find(n => n.id === nId);
            return node && !node.isDepot;
          });
          if (stops.length === 0) return;
          const lastStop = prevNodes.find(n => n.id === stops[stops.length - 1]);
          if (!lastStop) return;
          const d = dist(lastStop, newNode);
          if (d < bestDist) { bestDist = d; bestRouteIdx = rIdx; }
        });
        return prevRoutes.map((route, rIdx) => {
          if (rIdx !== bestRouteIdx) return route;
          // Insert before the final depot return
          const insertAt = route.length - 1;
          return [...route.slice(0, insertAt), id, ...route.slice(insertAt)];
        });
      });

      return updated;
    });
  }, []);

  // Import CSV — appends nodes and auto-wires them
  const handleImportCSV = useCallback((csvNodes) => {
    setNodes((prev) => {
      const maxId = prev.length > 0 ? Math.max(...prev.map((n) => n.id)) : -1;
      const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

      const newNodes = csvNodes.map((cn, i) => {
        const id = maxId + 1 + i;
        if (cn.lat !== undefined && cn.lng !== undefined) {
          registerNodeCoord(id, cn.lat, cn.lng);
          const depotLat = 28.6315, depotLng = 77.2167;
          const scale = 2200;
          const canvasX = Math.round(360 + (cn.lng - depotLng) * scale);
          const canvasY = Math.round(215 - (cn.lat - depotLat) * scale);
          return {
            id, demand: cn.demand || 10, label: `N${id}`,
            x: Math.max(20, Math.min(800, canvasX)),
            y: Math.max(20, Math.min(500, canvasY)),
            isDepot: false, timeWindow: cn.timeWindow || [0, 90], serviceTime: 5,
          };
        }
        const angle = (i * 2 * Math.PI) / csvNodes.length;
        const r = 160;
        return {
          id, demand: cn.demand || 10, label: `N${id}`,
          x: Math.round(360 + Math.cos(angle) * r),
          y: Math.round(215 + Math.sin(angle) * r),
          isDepot: false, timeWindow: cn.timeWindow || [0, 90], serviceTime: 5,
        };
      });

      const allNodes = [...prev, ...newNodes];

      // Auto-wire each new node to its 2 nearest existing neighbours
      setEdges((prevEdges) => {
        const extraEdges = [];
        newNodes.forEach((nn) => {
          const sorted = [...prev]
            .map(n => ({ node: n, d: dist(n, nn) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 2);
          sorted.forEach(({ node: n, d }) => {
            extraEdges.push({
              id: `e-${n.id}-${nn.id}-auto`,
              from: n.id, to: nn.id,
              weight: Number((d / 10).toFixed(1)),
              travelTime: Number((d / 10 * 1.2).toFixed(1)),
              congestion: 1.0,
            });
          });
        });
        return [...prevEdges, ...extraEdges];
      });

      return allNodes;
    });
    setRoutes([]);
    setRouteStats([]);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg)',
      }}
    >
      {/* Header (52px) */}
      <Header activeView={activeView} setActiveView={setActiveView} />

      {/* Main Workspace Body */}
      {activeView === 'graph' ? (
        <div
          style={{
            display: 'flex',
            flex: 1,
            height: 'calc(100vh - 52px - 36px)',
            overflow: 'hidden',
          }}
        >
          <LeftPanel
            nodeCount={nodes.length}
            edgeCount={edges.length}
            onLoadSample={handleLoadSample}
            onClearCanvas={handleClearCanvas}
            onImportCSV={handleImportCSV}
            numVehicles={numVehicles}
            setNumVehicles={setNumVehicles}
            vehicleCapacity={vehicleCapacity}
            setVehicleCapacity={setVehicleCapacity}
            swarmSize={swarmSize}
            setSwarmSize={setSwarmSize}
            maxIterations={maxIterations}
            setMaxIterations={setMaxIterations}
            betaStart={betaStart}
            setBetaStart={setBetaStart}
            betaEnd={betaEnd}
            setBetaEnd={setBetaEnd}
            alpha={alpha}
            setAlpha={setAlpha}
            betaW={betaW}
            setBetaW={setBetaW}
            gamma={gamma}
            setGamma={setGamma}
            onRun={handleRun}
            isRunning={status === 'running'}
          />

          <GraphCanvas
            nodes={nodes}
            edges={edges}
            routes={routes}
            isRunning={status === 'running'}
            currentIteration={currentIteration}
            maxIterations={maxIterations}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onAddEdge={handleAddEdge}
            onNodeDrag={handleNodeDrag}
          />

          <RightPanel
            hasRun={hasRun}
            bestFitness={bestFitness}
            improvementPct={improvementPct}
            convergenceHistory={convergenceHistory}
            baselineHistory={baselineHistory}
            routes={routes}
            nodes={nodes}
            routeStats={routeStats}
            constraintStatus={constraintStatus}
          />
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flex: 1,
            height: 'calc(100vh - 52px - 36px)',
            overflow: 'hidden',
          }}
        >
          <MapDashboard
            nodes={nodes}
            edges={edges}
            routes={routes}
            routeStats={routeStats}
            numVehicles={numVehicles}
            vehicleCapacity={vehicleCapacity}
            improvementPct={improvementPct}
            timeWindowViolations={constraintStatus?.timeWindowViolations || 0}
            onAddMapNode={handleAddMapNode}
            onImportCSV={handleImportCSV}
          />
        </div>
      )}

      {/* Status Bar (36px) */}
      <StatusBar
        status={status}
        currentIteration={currentIteration}
        maxIterations={maxIterations}
        convergedIteration={convergedIteration}
        beta={currentBeta}
        elapsedSeconds={elapsedSeconds}
      />
    </div>
  );
}

export default App;
