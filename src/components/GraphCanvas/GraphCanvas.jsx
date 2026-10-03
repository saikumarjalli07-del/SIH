import React, { useRef, useState, useEffect } from 'react';
import { RouteLayer } from './RouteLayer';
import { useD3Graph } from './useD3Graph';

export const GraphCanvas = ({
  nodes = [],
  edges = [],
  routes = [],
  isRunning = false,
  currentIteration = 0,
  maxIterations = 300,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onAddEdge,
  onNodeDrag,
}) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [edgePending, setEdgePending] = useState(null); // { fromNode, toNode, x, y }
  const [edgeWeightInput, setEdgeWeightInput] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // { x, y, nodeId }

  // Custom D3 graph hook for drag behaviors
  const { isDraggingRef } = useD3Graph({
    svgRef,
    nodes,
    edges,
    selectedNodeId,
    onNodeDrag,
  });

  // Handle canvas background click to create node or deselect
  const handleCanvasClick = (e) => {
    // If context menu is open, close it
    if (contextMenu) {
      setContextMenu(null);
      return;
    }
    // If edge pending input is open, close it
    if (edgePending) {
      setEdgePending(null);
      setSelectedNodeId(null);
      return;
    }
    // Don't add node if user was dragging or clicked on a node/edge
    if (isDraggingRef.current) return;
    if (e.target.closest('.node-group') || e.target.closest('.edge-group')) return;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);

      // Create new node at cursor
      onAddNode(x, y);
      setSelectedNodeId(null);
    }
  };

  // Node click handler for edge creation
  const handleNodeClick = (e, node) => {
    e.stopPropagation();
    if (isDraggingRef.current) return;
    if (contextMenu) setContextMenu(null);

    if (selectedNodeId === null) {
      setSelectedNodeId(node.id);
    } else if (selectedNodeId === node.id) {
      setSelectedNodeId(null); // Deselect if clicking the same node
    } else {
      // Connect selectedNodeId -> node.id
      const fromNode = nodes.find((n) => n.id === selectedNodeId);
      const toNode = node;
      if (fromNode && toNode) {
        const midX = Math.round((fromNode.x + toNode.x) / 2);
        const midY = Math.round((fromNode.y + toNode.y) / 2);
        const dx = fromNode.x - toNode.x;
        const dy = fromNode.y - toNode.y;
        const defaultDist = Number((Math.sqrt(dx * dx + dy * dy) / 10).toFixed(1));

        setEdgePending({
          from: fromNode.id,
          to: toNode.id,
          x: midX,
          y: midY,
        });
        setEdgeWeightInput(String(defaultDist));
      }
      setSelectedNodeId(null);
    }
  };

  // Node right click for context menu
  const handleNodeContextMenu = (e, node) => {
    e.preventDefault();
    e.stopPropagation();

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setContextMenu({
        nodeId: node.id,
        x,
        y,
      });
    }
  };

  // Confirm edge creation
  const handleConfirmEdge = (e) => {
    if (e) e.preventDefault();
    if (edgePending) {
      const weight = parseFloat(edgeWeightInput) || 10.0;
      onAddEdge(edgePending.from, edgePending.to, weight);
      setEdgePending(null);
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleWindowClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [contextMenu]);

  // Context menu actions
  const handleSetDepot = (nodeId) => {
    onUpdateNode(nodeId, { isDepot: true, isDestination: false, demand: 0 });
    setContextMenu(null);
  };

  const handleSetDestination = (nodeId) => {
    onUpdateNode(nodeId, { isDepot: false, isDestination: true });
    setContextMenu(null);
  };

  const handleDeleteNodeAction = (nodeId) => {
    onDeleteNode(nodeId);
    setContextMenu(null);
  };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      style={{
        flex: 1,
        height: '100%',
        backgroundColor: 'var(--bg)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'crosshair',
        userSelect: 'none',
      }}
    >
      {/* Top 2px progress bar while running */}
      {isRunning && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '2px',
            width: `${Math.min(100, Math.max(2, (currentIteration / maxIterations) * 100))}%`,
            backgroundColor: 'var(--accent)',
            zIndex: 10,
            transition: 'width 0.1s linear',
          }}
        />
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          {/* Subtle noise filter (opacity 0.03) */}
          <filter id="paperNoise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.03 0"
            />
          </filter>

          {/* Regular edge arrowhead marker */}
          <marker
            id="arrow-edge"
            viewBox="0 -4 8 8"
            refX="18"
            refY="0"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0,-3L6,0L0,3" fill="none" stroke="var(--border)" strokeWidth="1.2" />
          </marker>

          {/* Route markers */}
          <marker
            id="arrow-route-v1"
            viewBox="0 -4 8 8"
            refX="16"
            refY="0"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,-3L6,0L0,3" fill="none" stroke="var(--accent)" strokeWidth="1.8" />
          </marker>

          <marker
            id="arrow-route-v2"
            viewBox="0 -4 8 8"
            refX="16"
            refY="0"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,-3L6,0L0,3" fill="none" stroke="var(--success)" strokeWidth="1.8" />
          </marker>

          <marker
            id="arrow-route-v3"
            viewBox="0 -4 8 8"
            refX="16"
            refY="0"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,-3L6,0L0,3" fill="none" stroke="var(--muted)" strokeWidth="1.5" />
          </marker>
        </defs>

        {/* Paper noise texture overlay */}
        <rect width="100%" height="100%" fill="#ffffff" filter="url(#paperNoise)" pointerEvents="none" />

        {/* Edges Layer */}
        <g className="edges-layer">
          {edges.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;

            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;

            return (
              <g key={edge.id || `e-${edge.from}-${edge.to}`} className="edge-group">
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#2E2E2E"
                  strokeWidth="1"
                  markerEnd="url(#arrow-edge)"
                />
                <text
                  x={midX}
                  y={midY - 4}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontFamily="var(--font-mono)"
                  fontSize="9px"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {edge.weight}
                </text>
              </g>
            );
          })}
        </g>

        {/* Dynamic Route Layer (V1, V2, V3+) */}
        <RouteLayer routes={routes} nodes={nodes} isAnimating={!isRunning && routes.length > 0} />

        {/* Nodes Layer */}
        <g className="nodes-layer">
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isDepot = Boolean(node.isDepot);
            const isDest = Boolean(node.isDestination);

            return (
              <g
                key={node.id}
                id={`node-group-${node.id}`}
                data-node-id={node.id}
                className="node-group"
                style={{ cursor: 'pointer' }}
                onClick={(e) => handleNodeClick(e, node)}
                onContextMenu={(e) => handleNodeContextMenu(e, node)}
              >
                {/* Node Shape */}
                {isDepot ? (
                  // Depot: rect 20x20
                  <rect
                    x={node.x - 10}
                    y={node.y - 10}
                    width={20}
                    height={20}
                    fill="var(--surface)"
                    stroke={isSelected ? 'var(--text)' : 'var(--accent)'}
                    strokeWidth={isSelected ? 2 : 2}
                  />
                ) : isDest ? (
                  // Destination: circle r=12
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={12}
                    fill="var(--surface)"
                    stroke={isSelected ? 'var(--text)' : 'var(--accent)'}
                    strokeWidth={2}
                  />
                ) : (
                  // Regular node: circle r=10
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={10}
                    fill="var(--surface)"
                    stroke={isSelected ? 'var(--text)' : 'var(--border)'}
                    strokeWidth={isSelected ? 2 : 1.5}
                  />
                )}

                {/* Node ID label */}
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--muted)"
                  fontFamily="var(--font-mono)"
                  fontSize="10px"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.id}
                </text>

                {/* Demand label below node */}
                {!isDepot && node.demand !== undefined && (
                  <text
                    x={node.x}
                    y={node.y + 20}
                    textAnchor="middle"
                    fill="var(--muted)"
                    fontFamily="var(--font-mono)"
                    fontSize="9px"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.demand}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Inline Edge Weight Input */}
      {edgePending && (
        <form
          onSubmit={handleConfirmEdge}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: `${edgePending.x - 30}px`,
            top: `${edgePending.y - 14}px`,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <input
            type="number"
            autoFocus
            step="0.1"
            value={edgeWeightInput}
            onChange={(e) => setEdgeWeightInput(e.target.value)}
            onBlur={() => handleConfirmEdge()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEdgePending(null);
            }}
            placeholder="Weight"
            style={{
              width: '60px',
              padding: '2px 4px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--accent)',
              color: 'var(--text)',
              borderRadius: 'var(--radius-sm)',
            }}
          />
        </form>
      )}

      {/* Minimal Node Context Menu */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '4px 0',
            zIndex: 40,
            minWidth: '130px',
            boxShadow: 'none',
          }}
        >
          <div
            onClick={() => handleSetDepot(contextMenu.nodeId)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontFamily: 'var(--font-body)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-nested)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Set as depot
          </div>
          <div
            onClick={() => handleSetDestination(contextMenu.nodeId)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontFamily: 'var(--font-body)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-nested)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Set as destination
          </div>
          <div
            onClick={() => handleDeleteNodeAction(contextMenu.nodeId)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontFamily: 'var(--font-body)',
              color: 'var(--alert)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-nested)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Delete node
          </div>
        </div>
      )}
    </div>
  );
};
